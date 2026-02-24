import express from "express";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuração do Python ---
const PY_CMD = process.platform === "win32" ? "python" : "python3";
const SCRIPT_PATH = path.join(__dirname, "..", "scripts", "ccsFortgate.py");

const SPAWN_OPTS = {
  cwd: path.join(__dirname, ".."), // Executar a partir da raiz do projeto
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
};

// Mapeamento dos tipos de template para os caminhos dos arquivos
const templatePaths = {
  internet: path.join(__dirname, "..", "data", "ccs", "ccsFotgateModelo.conf"),
  mpls: path.join(__dirname, "..", "data", "ccs", "ccsFotgateModeloMpls.conf"),
  "mpls/24": path.join(__dirname, "..", "data", "ccs", "ccsFotgateModeloMpls-24.conf"),
};

// --- Rota para servir a página HTML ---


// --- Rota para gerar a configuração ---
router.post("/", (req, res) => {
  const data = req.body?.data;

  // Validação básica do corpo da requisição
  if (!data || typeof data !== "object") {
    return res.status(400).json({ 
      ok: false,
      error: "Dados inválidos." 
    });
  }

  // Converte o tipo de template para minúsculas para encontrar o caminho do template
  const templateType = (data.VRF || "internet").toLowerCase();
  const templatePath = templatePaths[templateType];

  if (!templatePath) {
    return res.status(400).json({ ok: false, error: `Tipo de template inválido ou não suportado: ${templateType}` });
  }

  // Garante que o valor da VRF esteja em maiúsculas antes de passar para o script
  if (data.VRF) {
    data.VRF = data.VRF.toUpperCase();
  } else {
    data.VRF = "INTERNET";
  }

  const child = spawn(PY_CMD, ["-u", SCRIPT_PATH, "--template", templatePath], SPAWN_OPTS);

  // Enviar dados para o script Python via stdin
  child.stdin.write(JSON.stringify(data));
  child.stdin.end();

  let out = "";
  let err = "";
  child.stdout.on("data", (chunk) => (out += chunk.toString()));
  child.stderr.on("data", (chunk) => (err += chunk.toString()));

  child.on("close", (code) => {
    // Se o script Python retornar um erro (ex: IP inválido)
    if (code !== 0) {
      console.error(`Erro no script ccsFortgate.py (código ${code}): ${err}`);
      return res.status(500).json({ 
        ok: false, 
        code, 
        error: err || "Ocorreu uma falha ao gerar a configuração." 
      });
    }

    // O script foi executado com sucesso
    const unidadeNome = data.SINGULAR || 'fortigate_conf';
    const numPa = data.NUM_PA || '1';
    const filename = `${unidadeNome}-${templateType}-${numPa}.conf`; // Nome do arquivo inclui o tipo de template
    
    res.json({
      ok: true,
      raw: out,
      filename: filename,
      message: "Configuração gerada com sucesso!"
    });
    console.log('[OK]Gerada config FORTIGATE para', unidadeNome, 'Tipo:', templateType);
  });

  child.on("error", (spawnError) => {
    console.error("Falha ao iniciar o processo filho (spawn):", spawnError);
    res.status(500).json({ 
      ok: false, 
      error: "Falha interna do servidor ao executar o script." 
    });
  });
});

export default router;
