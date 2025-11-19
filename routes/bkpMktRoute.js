const express = require("express");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const morgan = require("morgan");

const router = express.Router();

// ...existing code...

// Simple SSE clients list
const sseClients = new Set();

function sendSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (err) {
      // ignore write errors, client will be cleaned on close
    }
  }
}


const TPL_DIR = path.join(__dirname, "..", "data");

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "bkpMkt.html"));
});


router.post("/", (req, res) => {
  const data = req.body?.data || req.body;
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Body inválido" });
  }

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const child = spawn(pythonCmd, ["-u", "scripts/automacaoBkpMkt.py", "--cmd", "mkt", "--mode", "stdin"], {
    cwd: path.join(__dirname, ".."),
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, TPL_DIR },
  });

  const tplName = "/data/mktModeloBkp.txt";
  const payload = { ...data, TEMPLATE: tplName };
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  let out = "", err = "";
  child.stdout.on("data", (c) => out += c.toString());
  child.stderr.on("data", (c) => err += c.toString());

  child.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ ok: false, code, error: err });
    try { res.json(JSON.parse(out)); }
    catch { res.json({ ok: true, raw: out.trim() }); }
  });
});

module.exports = router;