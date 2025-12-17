import express from "express";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


router.post("/run", (req, res) => {
  const { template_name, texto_para_inserir } = req.body;

  if (!template_name || !texto_para_inserir) {
    return res.status(400).json({ 
      error: "Corpo da requisição inválido. 'template_name' e 'texto_para_inserir' são obrigatórios." 
    });
  }

  // Log de governança p/ saber o que está chegando
  console.log("[ComandosOxidized] template_name:", template_name);
  console.log("[ComandosOxidized] texto_para_inserir typeof:", typeof texto_para_inserir);
  console.log("[ComandosOxidized] texto_para_inserir raw:", texto_para_inserir);

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const scriptPath = path.join(__dirname, "..", "scripts", "comandosOxidized.py");

  // Se já vier string, usa; se vier objeto, serializa em JSON
  const payloadStr = 
    typeof texto_para_inserir === "string"
      ? texto_para_inserir
      : JSON.stringify(texto_para_inserir);

  const child = spawn(pythonCmd, [scriptPath, template_name, payloadStr], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => (stdout += data.toString()));
  child.stderr.on("data", (data) => (stderr += data.toString()));

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(`[ComandosOxidized] Script failed with exit code: ${code}`);
      console.error(`[ComandosOxidized] Stderr: ${stderr}`);
      console.error(`[ComandosOxidized] Stdout: ${stdout}`);

      const errorDetails = stderr || stdout;

      return res.status(500).json({
        ok: false,
        code,
        error: "Erro no servidor ao executar o script de automação.",
        details: errorDetails.trim(),
      });
    }

    res.json({
      ok: true,
      message: "Comando executado com sucesso.",
      output: stdout.trim(),
    });
  });

  child.on("error", (err) => {
    console.error(`Falha ao iniciar o processo do script: ${err.message}`);
    res.status(500).json({
      ok: false,
      error: "Falha ao iniciar o processo do script.",
      details: err.message,
    });
  });
});

export default router;
