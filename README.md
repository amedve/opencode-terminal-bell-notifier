# opencode-terminal-bell-notifier

Zero-dependency [OpenCode](https://opencode.ai) plugin that sends desktop notifications using [OSC 9](https://ghostty.org/docs/vt/osc/9) terminal escape sequences.

No `osascript`, no `notify-send`, no npm dependencies. Just a single escape sequence written to the terminal that your terminal emulator interprets as a notification.

> **Compatibility:** this release targets the OpenCode **2.x** plugin API (`@opencode/plugin`). OpenCode 1.x is not supported by this version.

## Install

Add to your `opencode.json` (OpenCode 2.x):

```json
{
  "plugins": ["opencode-terminal-bell-notifier@latest"]
}
```

Restart OpenCode.

## What it does

Sends a terminal notification when:

- The agent finishes a task (`session.execution.succeeded`, with `session.idle` as a fallback)
- The agent asks a question (`form.created`)
- Permission is requested (`permission.asked`)
- An error occurs (`session.execution.failed`)

## How it works

The plugin writes an OSC 9 escape sequence:

```
\x1b]9;<message>\x07
```

Under OpenCode 2, plugins run inside the background service, whose stdout is not a terminal (it is `/dev/null`), so writing to `process.stdout` is discarded. The plugin instead locates the pty held by the OpenCode TUI process and writes the sequence there.

Terminal emulators that support OSC 9 (Ghostty, iTerm2, kitty, foot, Windows Terminal, Warp) display this as a native desktop notification. Terminals without OSC 9 support still fire the trailing BEL byte (`\x07`) as an audible or visual bell.

## How it differs from other notification plugins

Most notification plugins shell out to platform-specific tools (`osascript` on macOS, `notify-send` on Linux) or pull in npm packages like `node-notifier`. This plugin does none of that:

- No npm runtime dependencies
- No platform-specific notification binaries (a single `ps` call is used only to locate the TUI pty on OpenCode 2)
- No platform detection
- No permission prompts except native OS notifications permission
- Works on any OS as long as the terminal supports OSC 9 or BEL

The tradeoff is that notifications are handled entirely by the terminal emulator, so behavior (sound, badge, banner) depends on your terminal's settings.

If your terminal is in the foreground, it may or may not suppress the notification. Check your terminal's documentation for notification configuration options.

## Terminal support

| Terminal             | OSC 9 notifications | BEL fallback   |
| -------------------- | ------------------- | -------------- |
| Ghostty              | ✅                  | ✅             |
| iTerm2               | ✅                  | ✅             |
| kitty                | ✅                  | ✅             |
| foot                 | ✅                  | ✅             |
| Windows Terminal     | ✅                  | ✅             |
| WezTerm              | ✅                  | ✅             |
| Warp                 | ✅                  | ✅             |
| Terminal.app         | ❌                  | ✅             |
| Alacritty            | ❌                  | ⚠️ visual only |
| GNOME Terminal / VTE | ❌                  | ⚠️ audio only  |
| Konsole              | ❌                  | ✅             |
| xfce4-terminal       | ❌                  | ✅             |
| urxvt                | ❌                  | ✅             |
| ConEmu               | ❌                  | ✅             |
| mintty               | ❌                  | ✅             |
| Tabby                | ❌                  | ⚠️ buggy       |

## License

MIT
