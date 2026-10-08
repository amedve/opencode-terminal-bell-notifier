/**
 * OpenCode terminal bell notifier plugin
 *
 * The plugin uses OSC 9 terminal escape sequences to display native desktop
 * notifications in terminal emulators that support OSC 9 or audible/visual bell,
 * whichever is supported by the terminal emulator.
 *
 * Notifies on:
 * - Task completion (`session.execution.succeeded`, with `session.idle` as fallback)
 * - Errors (`session.execution.failed`)
 * - Permission requests (`permission.asked` event)
 * - Agent questions (`form.created` event)
 */
import { Plugin } from "@opencode/plugin";
import { execFile } from "node:child_process";
import { closeSync, openSync, writeSync } from "node:fs";

/**
 * Plain ptys (e.g. `pts/1`) held by the running OpenCode TUI processes.
 *
 * `opencode serve --service` is skipped: it owns no terminal. Only the
 * interactive TUI processes point at a real pty.
 */
const tuiPtys = (): Promise<string[]> =>
  new Promise((resolve) => {
    execFile(
      "ps",
      ["-eo", "tty,args"],
      { timeout: 3000, maxBuffer: 1 << 20 },
      (err, out) => {
        if (err) return resolve([]);
        resolve([
          ...new Set(
            String(out)
              .split("\n")
              .filter(
                (line) =>
                  line.includes("opencode") &&
                  !line.includes("serve --service"),
              )
              .map((line) => line.trim().split(/\s+/)[0] ?? "")
              .filter((tty) => /^pts\/\d+$/.test(tty)),
          ),
        ]);
      },
    );
  });

/**
 * Send an OSC 9 notification to every OpenCode TUI pty.
 *
 * OpenCode 2 plugins run inside the background service, whose stdout is not the
 * terminal (it is `/dev/null`), so writing to `process.stdout` is discarded.
 * Writing the sequence to the TUI's pty makes the client terminal render it.
 * Terminals without OSC 9 still receive the trailing BEL byte (`\x07`).
 */
const notify = async (message: string): Promise<void> => {
  const ptys = await tuiPtys();
  for (const tty of ptys) {
    try {
      const fd = openSync(`/dev/${tty}`, "w");
      try {
        writeSync(fd, `\x1b]9;${message}\x07`);
      } finally {
        closeSync(fd);
      }
    } catch {
      // The pty may have disappeared between listing and writing.
    }
  }
};

export default Plugin.define({
  id: "opencode-terminal-bell-notifier",
  async setup(ctx) {
    /**
     * Returns true if the session is a primary (top-level) session,
     * i.e. not a subagent/Task-tool session.
     * Fails open: returns true on errors so notifications are not silently lost.
     */
    const isPrimarySession = async (sessionID?: string): Promise<boolean> => {
      if (!sessionID) return true;
      try {
        const session = await ctx.session.get({ sessionID });
        return !session?.parentID;
      } catch {
        return true;
      }
    };

    const controller = new AbortController();
    // One notification per finished run; cleared when the next run starts.
    const doneNotified = new Set<string>();
    // De-duplicate permission prompts and forms until they are answered.
    const seen = new Set<string>();

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          try {
            const data: any = (event as any).data ?? {};
            switch (event.type) {
              case "session.execution.started":
                if (data.sessionID) doneNotified.delete(data.sessionID);
                break;

              // OpenCode 2 signals a finished run with
              // `session.execution.succeeded`. `session.idle` is kept as a
              // fallback; whichever arrives first notifies only once per run.
              case "session.execution.succeeded":
              case "session.idle": {
                const sessionID: string | undefined = data.sessionID;
                if (sessionID && doneNotified.has(sessionID)) break;
                if (sessionID) doneNotified.add(sessionID);
                if (!(await isPrimarySession(sessionID))) break;
                await notify("Task complete");
                break;
              }

              case "session.execution.failed":
                if (!(await isPrimarySession(data.sessionID))) break;
                await notify("Session error");
                break;

              case "permission.asked":
                if (data.id && seen.has(`permission:${data.id}`)) break;
                if (data.id) seen.add(`permission:${data.id}`);
                if (!(await isPrimarySession(data.sessionID))) break;
                await notify("Permission requested");
                break;

              case "permission.replied":
                if (data.requestID) seen.delete(`permission:${data.requestID}`);
                break;

              case "form.created": {
                const form = data.form;
                if (!form?.id || seen.has(`form:${form.id}`)) break;
                seen.add(`form:${form.id}`);
                if (!(await isPrimarySession(form.sessionID))) break;
                await notify("Question asked");
                break;
              }

              case "form.replied":
              case "form.cancelled":
                if (data.id) seen.delete(`form:${data.id}`);
                break;
            }
          } catch {
            // Never let a single handler break the subscription.
          }
        }
      } catch {
        // Stream ended: the plugin was unloaded or the server is shutting down.
      }
    })();

    // Stop the subscription when the plugin unloads.
    return () => controller.abort();
  },
});