import express from "express";
import path from "path";
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PY_CMD = process.platform === "win32" ? "python" : "python3";
const SPAWN_OPTS = {
  cwd: path.join(__dirname, ".."),
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
};

// <--- COLOQUE A FUNÇÃO parseInterfaceOutput AQUI --- >
// (Copie a função parseInterfaceOutput definida no Passo 2 para cá)


router.post("/run-and-save-interfaces", async (req, res) => {
  const { ip, command } = req.body;

  if (!ip || !command) {
    return res.status(400).send("IP e Comando são obrigatórios");
  }

  const scriptPath = path.join(__dirname, "..", "scripts", "comandosMkt.py"); // Ou o script Python relevante
  const args = [scriptPath, ip, command];

  const py = spawn(PY_CMD, args, SPAWN_OPTS);

  let fullStdout = "";
  let fullStderr = "";

  py.stdout.on("data", (data) => { fullStdout += data.toString("utf-8"); });
  py.stderr.on("data", (data) => { fullStderr += data.toString("utf-8"); });

  py.on("close", async (code) => {
    if (code !== 0) {
      console.error("Script python falhou com código ${code}: ${fullStderr}");
      return res.status(500).json({ error: "Script Python falhou", details: fullStderr });
    }

    try {
      // 1. Analisar a saída
      const parsedData = parseInterfaceOutput(fullStdout, ip, command);

      if (parsedData.length === 0) {
        return res.status(404).json({ message: "Nenhuma informação de interface encontrada na saída do comando." });
      }

      // 2. Salvar no banco de dados
      const result = await prisma.interfaceData.createMany({
       data: parsedData,
        // skipDuplicates: true, // Adicione se quiser ignorar entradas duplicadas (pode precisar de um campo único) 
      });

      // 3. Enviar resposta de sucesso
      res.json({ message: `${result.count} registros de interface salvos com sucesso.`, data: parsedData });

     } 
        
      catch (error) {
          res.status(500).json({ error: "Falha ao salvar os dados no banco.", details: error.message });
        }
});
    }); 



router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "commandMkt.html"));
});

router.get("/commands", async (req, res) => {
  try {
    const commands = await prisma.commands_mkt.findMany();
    res.json(commands);
  } catch (error) {
    console.error("Erro ao buscar comandos:", error);
    res.status(500).json({ error: "Falha ao buscar comandos do banco de dados." });
  }
});


router.post("/run", (req, res) => {
  const { ip, command } = req.body;

  if (!ip || !command) {
    return res.status(400).send("IP e Comando são obrigatórios");
  }

  const scriptPath = path.join(__dirname, "..", "scripts", "comandosMkt.py");
  const args = [scriptPath, ip, command];

  const py = spawn(PY_CMD, args, SPAWN_OPTS);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  let stdoutBuf = ""; // buffer para stdout
  let stderrBuf = ""; // buffer para stderr

  // Expressão Regular para detectar logs do Python (ex: " - INFO - ", " - WARNING - ")
  const logRegex = /\s-\s(INFO|ERROR|DEBUG|WARNING)\s-\s/;

  // Filtra o stdout: logs vão pro servidor, resto vai pro front
  py.stdout.on("data", (data) => {
    stdoutBuf += data.toString("utf-8");
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, idx).replace(/\r$/, "");
      stdoutBuf = stdoutBuf.slice(idx + 1);

      if (logRegex.test(line)) {
        console.log(`[Python LOG] ${line}`); // Logs só no servidor
      } else {
        res.write(line + "\n"); // Envia o resto para o front
      }
    }
  });

  // Filtra o stderr: logs vão pro servidor, resto (erros) vai pro front
  py.stderr.on("data", (data) => {
    stderrBuf += data.toString("utf-8");
    let idx;
    while ((idx = stderrBuf.indexOf("\n")) >= 0) {
      const line = stderrBuf.slice(0, idx).replace(/\r$/, "");
      stderrBuf = stderrBuf.slice(idx + 1);

      if (logRegex.test(line)) {
        console.log(`[Python LOG] ${line}`); // Logs só no servidor
      } else {
        console.error(`[Python STDERR] ${line}`); // Loga erro no servidor
        res.write(`[ERRO] ${line}\n`);      // Envia erro para o front
      }
    }
  });

  py.on("close", (code) => {
    // Processa o resto do buffer de stdout
    if (stdoutBuf.trim()) {
      const line = stdoutBuf.trim();
       if (!logRegex.test(line)) {
        res.write(line + "\n");
      } else {
        console.log(`[Python LOG] ${line}`);
      }
    }

    // Processa o resto do buffer de stderr
    if (stderrBuf.trim()) {
      const line = stderrBuf.trim();
      if (!logRegex.test(line)) {
          console.error(`[Python STDERR] ${line}`);
          res.write(`[ERRO] ${line}\n`);
      } else {
          console.log(`[Python LOG] ${line}`);
      }
    }

    if (code !== 0) {
      const finalMessage = `\nScript finalizado com código de erro ${code}\n`;
      console.error(finalMessage.trim());
      res.write(finalMessage);
    }

    res.end();
  });
});


export default router;