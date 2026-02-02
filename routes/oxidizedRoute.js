import express from "express";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const TEMPLATES_DIR = path.join(__dirname, "..", "data", "oxidized");

// GET /api/oxidized/templates - Listar todos os templates .txt
router.get("/templates", async (req, res) => {
    try {
        console.log("Tentando ler o diretório de templates em:", TEMPLATES_DIR);
        const files = await fs.readdir(TEMPLATES_DIR);
        const txtTemplates = files.filter(file => file.endsWith('.txt'));
        res.json(txtTemplates);
    } catch (error) {
        console.error("Erro ao listar templates:", error);
        res.status(500).json({ error: "Não foi possível carregar os templates." });
    }
});

// GET /api/oxidized/placeholders/:templateName - Obter placeholders de um template específico
router.get("/placeholders/:templateName", async (req, res) => {
    const { templateName } = req.params;
    // Sanitize templateName to prevent directory traversal attacks
    if (!templateName || !templateName.endsWith('.txt') || templateName.includes('..')) {
        return res.status(400).json({ error: "Nome de template inválido." });
    }

    try {
        const filePath = path.join(TEMPLATES_DIR, templateName);
        const content = await fs.readFile(filePath, "utf-8");
        const placeholders = content.match(/{([^}]+)}/g) || [];
        // Remove as chaves e obtém valores únicos
        const uniquePlaceholders = [...new Set(placeholders.map(p => p.slice(1, -1)))];
        res.json(uniquePlaceholders);
    } catch (error) {
        console.error(`Erro ao ler placeholders para ${templateName}:`, error);
        res.status(404).json({ error: "Template não encontrado ou ilegível." });
    }
});




router.post("/generate", (req, res) => {
  // O corpo da requisição deve conter:
  // {
  //   "template_principal": "NomeDoTemplate.txt",
  //   "template_secundario": "OutroTemplate.txt", // Opcional
  //   "dados": { "placeholder1": "valor1", "placeholder2": "valor2" }
  // }
  const apiData = req.body;

  if (!apiData || typeof apiData !== "object" || !apiData.template_principal || !apiData.dados) {
    return res.status(400).json({ 
      error: "Corpo da requisição inválido. 'template_principal' e 'dados' são obrigatórios." 
    });
  }

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const scriptPath = path.join(__dirname, "..", "scripts", "bkpOxidized.py");
  
  const child = spawn(pythonCmd, ["-u", scriptPath], {
    cwd: path.join(__dirname, ".."),
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Envia os dados da API para o stdin do script Python
  child.stdin.write(JSON.stringify(apiData));
  child.stdin.end();

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => stdout += data.toString());
  child.stderr.on("data", (data) => stderr += data.toString());

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(`Erro ao executar script bkpOxidized.py: ${stderr}`);
      return res.status(500).json({ 
        ok: false, 
        code, 
        error: "Erro no servidor ao executar o script de automação.",
        details: stderr 
      });
    }
    
    // O script Python imprime o conteúdo gerado no stdout no modo API
    res.json({ 
      ok: true, 
      message: "Configuração gerada e salva com sucesso.",
      generated_config: stdout.trim()
    });
  });

  child.on("error", (err) => {
    console.error(`Falha ao iniciar o processo do script: ${err.message}`);
    res.status(500).json({
      ok: false,
      error: "Falha ao iniciar o processo do script.",
      details: err.message
    });
  });
});

export default router;
