# YGuard RCON

Tiny **TypeScript** RCON client built for CS2 / Source dedicated servers — the same protocol YGuard panel plugins talk over when pushing bans, cvars, and live prefs.

Zero dependencies. Works in Node 18+.

## Install

```bash
npm i
npm run build
```

## Quick start

```ts
import { RconClient } from "./dist/index.js";

const rcon = new RconClient({
  host: "127.0.0.1",
  port: 27015,
  password: process.env.RCON_PASSWORD!
});

await rcon.connect();
console.log(await rcon.command("status"));
console.log(await rcon.command("css_players"));
await rcon.end();
```

## API

| Method | Description |
|--------|-------------|
| `connect()` | TCP + SERVERDATA_AUTH |
| `command(cmd)` | SERVERDATA_EXECCOMMAND → response body |
| `end()` | Close socket |

## Why

Panel → game node sync (VIP flags, FF/bhop prefs, admin bans) needs a boring, reliable RCON client. This one mirrors how YGuard nodes expect replies — multi-packet bodies concatenated until the empty SERVERDATA_RESPONSE_VALUE sentinel.

## License

MIT · Kian Zarandi ([@kianPk](https://github.com/kianPk))
