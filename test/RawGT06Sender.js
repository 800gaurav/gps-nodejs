const net = require("net");
const readline = require("readline");

class RawGT06Sender {
  constructor(host = "localhost", port = 5023) {
    this.host = host;
    this.port = port;
    this.socket = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.connect(this.port, this.host, () => {
        console.log(`✅ Connected to ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on("data", (data) => {
        console.log("📥 RX:", data.toString("hex"));
      });

      this.socket.on("error", (err) => {
        console.error("❌ Socket error:", err.message);
        reject(err);
      });

      this.socket.on("close", () => {
        console.log("🔌 Connection closed");
      });
    });
  }

  sendHex(hex) {
    const clean = hex.replace(/\s+/g, "");
    const buf = Buffer.from(clean, "hex");
    console.log("📤 TX:", buf.toString("hex"));
    this.socket.write(buf);
  }

  disconnect() {
    if (this.socket) this.socket.destroy();
  }
}

// Interactive CLI mode
async function interactive() {
  const sender = new RawGT06Sender();
  await sender.connect();

  console.log("\n🧪 GT06 Raw Packet Tester");
  console.log("Type hex packets and press Enter");
  console.log("Type 'quit' to exit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("line", (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === "quit") {
      sender.disconnect();
      rl.close();
      process.exit(0);
    }

    try {
      sender.sendHex(cmd);
    } catch (e) {
      console.log("❌ Invalid hex");
    }
  });
}

if (require.main === module) {
  interactive();
}

module.exports = RawGT06Sender;
