const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const router = express.Router();

const DATA_DIR_CISCO = path.join(__dirname, "..", "data", "cisco");


router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "indexCiscoCcs.html"));
});


router.post("/", (req, res) => {
  try {
    const data = req.body?.data || req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Body inválido: esperado objeto com campos." });
    }

    const tplName = "ciscoModelo.txt";

    const payload = { ...data, TEMPLATE: tplName };

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const child = spawn(pythonCmd, ["-u", "scripts/automacaoCcs.py", "--cmd", "cisco", "--mode", "stdin"], {
      cwd: path.join(__dirname, ".."),
      stdio: ["pipe","pipe","pipe"],
      env: { ...process.env, TPL_DIR: DATA_DIR_CISCO }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();

    let out = "", err = "";
    child.stdout.on("data", c => out += c.toString());
    child.stderr.on("data", c => err += c.toString());

    child.on("close", code => {
      if (code !== 0) return res.status(500).json({ ok:false, code, error: err || "Falha no mainApi.py" });
      try { res.json(JSON.parse(out)); }
      catch { res.json({ ok:true, raw: out.trim() }); }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;