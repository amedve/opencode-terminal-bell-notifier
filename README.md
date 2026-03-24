# opencode-terminal-bell-notifier

Zero-dependency [OpenCode](https://opencode.ai) plugin that sends desktop notifications using [OSC 9](https://ghostty.org/docs/vt/osc/9) terminal escape sequences.

No `osascript`, no `notify-send`, no external binaries, no npm dependencies. Just a single escape sequence written to stdout that your terminal emulator interprets as a notification.

## Install

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-terminal-bell-notifier"]
}
```

Restart OpenCode.

## What it does

Sends a terminal notification when:

- The agent finishes a task
- The agent asks a question
- Permission is requested
- An error occurs

## How it works

The plugin writes an OSC 9 escape sequence directly to stdout:

```
\x1b]9;<message>\x07
```

Terminal emulators that support OSC 9 (Ghostty, iTerm2, kitty, foot, Windows Terminal, Warp) display this as a native desktop notification. Terminals without OSC 9 support still fire the trailing BEL byte (`\x07`) as an audible or visual bell.

## How it differs from other notification plugins

Most notification plugins shell out to platform-specific tools (`osascript` on macOS, `notify-send` on Linux) or pull in npm packages like `node-notifier`. This plugin does none of that:

- No runtime dependencies
- No child processes
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
