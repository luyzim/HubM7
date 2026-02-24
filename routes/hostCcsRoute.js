import express from "express";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.use(express.json({ limit: "256kb" })); // evita payload gigante

router.post("/", (req, res) => {
  try {
    const { group, identifier, ips } = req.body;

    // Validação básica e defensiva (evita undefined e formatos bizarros)
    if (
      typeof group !== "string" ||
      typeof identifier !== "string" ||
      !ips ||
      !ips.internet ||
      !ips.mpls
    ) {
      return res.status(400).json({ error: "Dados incompletos ou inválidos." });
    }

    const ipList = [
      ips.internet?.mkt,
      ips.internet?.gary,
      ips.internet?.plankton,
      ips.internet?.wan,
      ips.internet?.lan,
      ips.mpls?.mkt,
      ips.mpls?.gary,
      ips.mpls?.plankton,
      ips.mpls?.wan,
      ips.mpls?.lan,
    ];

    // Verifica se todos os IPs existem e são string (evita quebrar o Python e evita lixo)
    //const missing = ipList.findIndex((v) => typeof v !== "string" || !v.trim());
    //if (missing !== -1) {
     // return res.status(400).json({ error: "Lista de IPs inválida/incompleta." });
    //}

    const scriptPath = path.join(__dirname, "..", "scripts", "createHostCcs.py");

    // Ideal: apontar explicitamente o python do venv ou o python launcher do Windows.
    // Ex: set PYTHON_BIN=py  (ou caminho do venv: .venv\Scripts\python.exe)
    const PYTHON_BIN = process.env.PYTHON_BIN || "python";

    // spawn com args separados: nada de montar string de comando
    const args = [scriptPath, group, identifier, ...ipList];

    const child = spawn(PYTHON_BIN, args, {
      cwd: path.join(__dirname, ".."),
      shell: false, // importante: sem shell
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    });

    let stdout = "";
    let stderr = "";

    // Limite de output para evitar DoS por flood de stdout
    const MAX_OUT = 1024 * 1024; // 1MB
    const killWith = (msg) => {
      try { child.kill("SIGKILL"); } catch (_) {}
      return res.status(500).json({ error: msg });
    };

    const timer = setTimeout(() => {
      return killWith("Timeout executando o script Python.");
    }, 30_000); // 30s

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > MAX_OUT) return killWith("Saída do script excedeu o limite.");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > MAX_OUT) return killWith("Erro do script excedeu o limite.");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      console.error("[PY] spawn error:", err);
      return res.status(500).json({ error: "Falha ao iniciar o Python.", details: String(err) });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);

      if (signal) {
        return res.status(500).json({ error: "Processo Python finalizado.", signal });
      }

      if (code !== 0) {
        // tenta interpretar stderr como JSON primeiro
        try {
          const errorJson = JSON.parse(stderr || "{}");
          return res.status(500).json(errorJson);
        } catch {
          return res.status(500).json({
            error: "Erro ao executar o script.",
            code,
            details: stderr || stdout,
          });
        }
      }

      // sucesso: stdout deve ser JSON
      try {
        const results = JSON.parse(stdout);
        console.log("Criado Hosts para", group, identifier);
        return res.json(results);
      } catch (e) {
        return res.status(500).json({
          error: "Erro ao processar a resposta do script.",
          details: stdout,
        });
      }
    });
  } catch (e) {
    console.error("[ROUTE] erro:", e);
    return res.status(500).json({ error: "Erro interno." });
  }
});

export default router;