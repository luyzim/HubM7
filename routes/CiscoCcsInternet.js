import express from "express";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PY_CMD = process.platform === "win32" ? "python" : "python3";
const SPAWN_OPTS = {
  cwd: path.join(__dirname, ".."),
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
};



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
    if (code !== 0) {
      return res.status(500).json({ ok: false, code, error: err || "Falha ao executar o script Python." });
    }

    try {
      const result = JSON.parse(out);
      console.log('Resposta do script automacaoCcs.py:', result); // Log da resposta completa
      if (result.status === "error") {
        // Erro de validação retornado pelo script, ex: IP inválido.
        return res.status(400).json({ ok: false, error: result.error || "Erro nos dados fornecidos." });
      }
      // Sucesso
      res.json(result);
    } catch (e) {
      // Erro ao analisar o JSON de resposta do script.
      res.status(500).json({ ok: false, error: "Falha ao processar a resposta do script.", raw: out });
    }
  });
}

router.post("/", (req, res) => {
  const data = req.body?.data || req.body;
  runTemplate(res, data, "ciscoModelo.txt", "cisco");
    console.log('Gerado Script Cisco:', data.NOME_PA, data.NUM_PA, data.VRF, data.IP_VALIDO);

});

router.post("/mensagem", (req, res) => {
  const data = req.body?.data || req.body;
  runTemplate(res, data, "mensagemInternet.txt", "mensagem");
  console.log('Gerado Script Mensagem') ;
});

export default router;
