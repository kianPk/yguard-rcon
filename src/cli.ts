import { RconClient } from "./index.js";

const [host, portStr, ...cmdParts] = process.argv.slice(2);
const password = process.env.RCON_PASSWORD;

if (!host || !password || cmdParts.length === 0) {
  console.error("Usage: RCON_PASSWORD=xxx node dist/cli.js <host> <port> <command...>");
  process.exit(1);
}

const rcon = new RconClient({
  host,
  port: Number(portStr || 27015),
  password
});

await rcon.connect();
const out = await rcon.command(cmdParts.join(" "));
process.stdout.write(out.endsWith("\n") ? out : out + "\n");
rcon.end();
