import express from "express";
import path from "path";
import { spawn } from "child_process";
import net from "net";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= SSE CLIENTS =================

const sseClients = new Set();

function sendSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (err) {
      // cliente morreu, será limpo no close
    }
  }
}

// ================= /get =================





// ================= /run =================
router.post("/run", (req, res) => {
  console.log(`[POST] /api/unimed/run - IP: ${req.body?.ip}`);
  try {
    const ip = req.body?.ip;
    if (!ip) {
      return res.status(400).json({ error: "IP não fornecido" });
    }
    if (net.isIP(ip) !== 4) {
      return res.status(400).json({ error: "Apenas IPv4 permitido" });
    }

    // 🔹 RESPONDE IMEDIATO PRO FRONT
    res.status(202).json({
      success: true,
      message: "Automação iniciada. Acompanhe pelo painel.",
      ip,
    });

    // 🔹 avisa via SSE que começou
    sendSseEvent("automation", {
      ip,
      status: "started",
      message: "Trabalhando nisto...",
    });

    // 🔹 caminho robusto do script Python
    const scriptPath = path.join(
      __dirname,
      "..",
      "scripts",
      "automacaoUnimed.py"
    );
    // ajusta aqui se o script estiver em outra pasta

    const processo = spawn("python", [scriptPath, ip], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let error = "";

    processo.stdout.on("data", (data) => {
      output += data.toString();
    });

    processo.stderr.on("data", (data) => {
      error += data.toString();
    });

    processo.on("error", (e) => {
      console.error(`[PY START ERROR] ${e.message} (ip=${ip})`);
      sendSseEvent("automation", {
        ip,
        status: "finished",
        success: false,
        message: `Falha ao iniciar automação: ${e.message}`,
      });
    });

    const KILL_AFTER_MS = 120_000;
    const killer = setTimeout(() => {
      console.warn(`[TIMEOUT] Matando automacaoUnimed.py (ip=${ip})`);
      processo.kill("SIGKILL");
    }, KILL_AFTER_MS);

    processo.once("close", (code, signal) => {
      clearTimeout(killer);

      if (signal === "SIGKILL") {
        console.error(
          `[TIMEOUT] automacaoUnimed.py excedeu ${KILL_AFTER_MS}ms (ip=${ip})`
        );
        sendSseEvent("automation", {
          ip,
          status: "finished",
          success: false,
          message: `Timeout após ${KILL_AFTER_MS}ms`,
        });
        return;
      }

      if (code === 0) {
        console.log(`[OK][${ip}] ${output.trim()}`);
        sendSseEvent("automation", {
          ip,
          status: "finished",
          success: true,
          message: output.trim() || "Automação concluída com sucesso",
        });
      } else {
        console.error(
          `[FAIL][${ip}] ${error.trim() || "Erro não especificado"}`
        );
        sendSseEvent("automation", {
          ip,
          status: "finished",
          success: false,
          message: error.trim() || "Erro não especificado",
        });
      }
    });
  } catch (e) {
    console.error(`[ROUTE ERROR] ${e.message}`);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro inesperado na API" });
    }
  }
});

// ================= /status =================

router.get("/status", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "Servidor Unimed está no ar." });
});

// ================= /events (SSE) =================

router.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders && res.flushHeaders();

  sseClients.add(res);

  // ping inicial
  res.write(
    `event: connected\ndata: ${JSON.stringify({ message: "connected" })}\n\n`
  );

  req.on("close", () => {
    sseClients.delete(res);
  });
});

export default router;
