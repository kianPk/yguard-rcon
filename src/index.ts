import net from "node:net";

export type RconOptions = {
  host: string;
  port?: number;
  password: string;
  timeoutMs?: number;
};

const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

export class RconClient {
  private readonly host: string;
  private readonly port: number;
  private readonly password: string;
  private readonly timeoutMs: number;
  private socket: net.Socket | null = null;
  private reqId = 1;
  private buf = Buffer.alloc(0);
  private pending = new Map<
    number,
    { resolve: (s: string) => void; reject: (e: Error) => void; chunks: string[] }
  >();

  constructor(opts: RconOptions) {
    this.host = opts.host;
    this.port = opts.port ?? 27015;
    this.password = opts.password;
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port }, async () => {
        this.socket = socket;
        try {
          await this.auth();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      socket.on("data", (chunk) => this.onData(chunk));
      socket.on("error", reject);
      socket.setTimeout(this.timeoutMs, () => {
        reject(new Error("RCON connect timeout"));
        socket.destroy();
      });
    });
  }

  async command(cmd: string): Promise<string> {
    if (!this.socket) throw new Error("Not connected");
    const id = this.nextId();
    const sentinel = this.nextId();

    const body = await new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, chunks: [] });
      this.write(id, SERVERDATA_EXECCOMMAND, cmd);
      // Empty packet: Source ends multi-packet responses after this id replies.
      this.write(sentinel, SERVERDATA_EXECCOMMAND, "");
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`RCON command timeout: ${cmd}`));
        }
      }, this.timeoutMs);
    });

    return body;
  }

  end(): void {
    this.socket?.destroy();
    this.socket = null;
    this.pending.clear();
  }

  private auth(): Promise<void> {
    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
        chunks: []
      });
      this.write(id, SERVERDATA_AUTH, this.password);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("RCON auth timeout"));
        }
      }, this.timeoutMs);
    });
  }

  private write(id: number, type: number, body: string): void {
    const bodyBuf = Buffer.from(body, "utf8");
    const size = 4 + 4 + bodyBuf.length + 2;
    const packet = Buffer.alloc(4 + size);
    packet.writeInt32LE(size, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    bodyBuf.copy(packet, 12);
    packet.writeInt16LE(0, 12 + bodyBuf.length);
    this.socket!.write(packet);
  }

  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 4) {
      const size = this.buf.readInt32LE(0);
      if (this.buf.length < 4 + size) return;
      const packet = this.buf.subarray(4, 4 + size);
      this.buf = this.buf.subarray(4 + size);

      const id = packet.readInt32LE(0);
      const type = packet.readInt32LE(4);
      const body = packet.subarray(8, packet.length - 2).toString("utf8");

      if (type === SERVERDATA_AUTH_RESPONSE) {
        const p = this.pending.get(id);
        if (!p) continue;
        this.pending.delete(id);
        if (id === -1) p.reject(new Error("RCON auth failed"));
        else p.resolve("");
        continue;
      }

      if (type === SERVERDATA_RESPONSE_VALUE) {
        // Sentinel empty command echoes with empty body → flush pending command
        const match =
          this.pending.get(id) ??
          [...this.pending.entries()].find(([, v]) => v.chunks.length >= 0)?.[1];

        // Prefer exact id; if this is the trailing empty ack, settle oldest pending with chunks
        if (this.pending.has(id)) {
          const p = this.pending.get(id)!;
          if (body.length === 0 && p.chunks.length > 0) {
            this.pending.delete(id);
            p.resolve(p.chunks.join(""));
          } else if (body.length) {
            p.chunks.push(body);
          }
        } else if (body.length === 0) {
          // Empty response for sentinel — finalize first open command
          const first = this.pending.entries().next().value as
            | [number, { resolve: (s: string) => void; reject: (e: Error) => void; chunks: string[] }]
            | undefined;
          if (first) {
            const [pid, p] = first;
            this.pending.delete(pid);
            p.resolve(p.chunks.join(""));
          }
        } else if (match) {
          match.chunks.push(body);
        }
      }
    }
  }

  private nextId(): number {
    this.reqId = (this.reqId + 1) & 0x0fffffff;
    return this.reqId;
  }
}
