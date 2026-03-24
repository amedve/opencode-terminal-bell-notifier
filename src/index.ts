/**
 * OpenCode terminal bell notifier plugin
 *
 * The plugin is using OSC 9 terminal escape sequences to display native desktop
 * notifications in terminal emulators that support OSC 9 or audible/visual bell,
 * whichever is supported by the terminal emulator.
 *
 * Notifies on:
 * - Task completion (`session.idle`)
 * - Errors (`session.error`)
 * - Permission requests (`permission.asked` event)
 * - Agent questions (`tool.execute.before` when tool is "question")
 */
import type { Plugin } from "@opencode-ai/plugin";

const notify = (message: string) => {
  process.stdout.write(`\x1b]9;${message}\x07`);
};

export const TerminalBellNotifierPlugin: Plugin = async ({ client }) => {
  /**
   * Returns true if the session is a primary (top-level) session,
   * i.e. not a subagent/Task-tool session.
   * Fails open: returns true on errors so notifications are not silently lost.
   */
  const isPrimarySession = async (sessionID: string): Promise<boolean> => {
    try {
      const res = await client.session.get({ path: { id: sessionID } });
      return !res.data?.parentID;
    } catch {
      return true;
    }
  };

  return {
    event: async ({ event }) => {
      const eventSessionID = (event.properties as { sessionID: string })
        .sessionID;
      switch (event.type as string) {
        case "session.idle":
          if (!(await isPrimarySession(eventSessionID))) return;
          await notify("Task complete");
          break;
        case "session.error":
          if (eventSessionID && !(await isPrimarySession(eventSessionID)))
            return;
          await notify("Session error");
          break;
        case "permission.asked":
          await notify("Permission requested");
          break;
      }
    },
    "tool.execute.before": async (input) => {
      if (input.tool === "question") {
        if (!(await isPrimarySession(input.sessionID))) return;
        await notify("Question asked");
      }
    },
  };
};
