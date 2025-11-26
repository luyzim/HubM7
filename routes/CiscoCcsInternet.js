const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const router = express.Router();

const PY_CMD = process.platform === "win32" ? "python" : "python3";
const SPAWN_OPTS = {
  cwd: path.join(__dirname, ".."),
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
};

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "indexCiscoCcs.html"));
});

function runTemplate(res, data, templateName, cmd) {
  if (!data || typeof data !== "object") {
    return res.status(400).json({ error: "Body invalido: esperado objeto com campos." });
  }

  const child = spawn(PY_CMD, ["-u", "scripts/automacaoCcs.py", "--cmd", cmd, "--mode", "stdin"], SPAWN_OPTS);
  const payload = { ...data, TEMPLATE: templateName };
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  let out = "", err = "";
  child.stdout.on("data", (c) => out += c.toString());
  child.stderr.on("data", (c) => err += c.toString());

  child.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ ok: false, code, error: err || "Falha no automacaoCcs.py" });
    try { res.json(JSON.parse(out)); }
    catch { res.json({ ok: true, raw: out.trim() }); }
  });
}

router.post("/", (req, res) => {
  const data = req.body?.data || req.body;
  runTemplate(res, data, "ciscoModelo.txt", "cisco");
});

router.post("/mensagem", (req, res) => {
  const data = req.body?.data || req.body;
  runTemplate(res, data, "mensagemInternet.txt", "mensagem");
});

module.exports = router;
