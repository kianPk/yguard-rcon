import { RconClient } from "./index.js";

function usage(): never {
  console.error(`Usage: RCON_PASSWORD=xxx node dist/cli.js [options] <host> <port> <command...>

Options:
  --dry-run          Print command(s) without sending
  --timeout <ms>     Socket/command timeout (default 5000)
  --json             Emit JSON { ok, host, port, command, response }
  Semicolon-separated commands run sequentially.`);
  process.exit(1);
}

const raw = process.argv.slice(2);
let dryRun = false;
let jsonMode = false;
let timeoutMs = 5000;
const positional: string[] = [];

for (let i = 0; i < raw.length; i++) {
  const a = raw[i];
  if (a === "--dry-run") dryRun = true;
  else if (a === "--json") jsonMode = true;
  else if (a === "--timeout") {
    timeoutMs = Number(raw[++i]);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      console.error("Invalid --timeout");
      process.exit(1);
    }
  } else if (a === "--help" || a === "-h") usage();
  else positional.push(a);
}

const [host, portStr, ...cmdParts] = positional;
const password = process.env.RCON_PASSWORD;
const port = Number(portStr || 27015);

if (!host || cmdParts.length === 0) usage();
if (!dryRun && !password) {
  console.error("RCON_PASSWORD is required (unless --dry-run)");
  process.exit(1);
}

const commandLine = cmdParts.join(" ");
const commands = commandLine.split(";").map((c) => c.trim()).filter(Boolean);

type JsonRow = {
  ok: boolean;
  host: string;
  port: number;
  command: string;
  response: string;
  error?: string;
};

const rows: JsonRow[] = [];

if (dryRun) {
  for (const command of commands) {
    const row: JsonRow = { ok: true, host, port, command, response: "(dry-run)" };
    rows.push(row);
    if (!jsonMode) console.log(`[dry-run] ${host}:${port} > ${command}`);
  }
  if (jsonMode) {
    console.log(JSON.stringify(commands.length === 1 ? rows[0] : rows, null, 2));
  }
  process.exit(0);
}

const rcon = new RconClient({ host, port, password: password!, timeoutMs });

try {
  await rcon.connect();
  for (const command of commands) {
    try {
      const response = await rcon.command(command);
      const row: JsonRow = { ok: true, host, port, command, response };
      rows.push(row);
      if (!jsonMode) process.stdout.write(response.endsWith("\n") ? response : response + "\n");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      rows.push({ ok: false, host, port, command, response: "", error: msg });
      if (!jsonMode) console.error(msg);
    }
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (jsonMode) {
    console.log(JSON.stringify({ ok: false, host, port, command: commandLine, response: "", error: msg }, null, 2));
  } else {
    console.error(msg);
  }
  process.exit(1);
} finally {
  rcon.end();
}

if (jsonMode) {
  console.log(JSON.stringify(commands.length === 1 ? rows[0] : rows, null, 2));
}

process.exit(rows.every((r) => r.ok) ? 0 : 1);
