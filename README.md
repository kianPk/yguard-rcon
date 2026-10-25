# YGuard RCON

Tiny **TypeScript** RCON client built for CS2 / Source dedicated servers — the same protocol YGuard panel plugins talk over when pushing bans, cvars, and live prefs.

Zero dependencies. Works in Node 18+.

## Features

- `connect` / `command` / `end` Source RCON client
- CLI `--dry-run`, `--timeout <ms>`, `--json`
- Semicolon-separated multi-command runs

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) (current **1.1.0**).

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
await rcon.end();
```

```bash
RCON_PASSWORD=xxx node dist/cli.js --json 127.0.0.1 27015 'status; css_players'
RCON_PASSWORD=xxx node dist/cli.js --dry-run 127.0.0.1 27015 status
```

## License

MIT · Kian Zarandi ([@kianPk](https://github.com/kianPk))
