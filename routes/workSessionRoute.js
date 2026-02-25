// routes/workSessionRoute.js
import express from "express";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// 1. Busca sessão ativa
router.get("/active", async (req, res) => {
  try {
    if (!req.session?.user?.email) return res.status(401).json({ error: "Não autenticado" });
    const userEmail = req.session.user.email;
    const activeSession = await prisma.workSession.findFirst({
      where: { 
        userEmail, 
        status: { in: ["RUNNING", "PAUSED"] } 
      },
      orderBy: { startedAt: "desc" }
    });
    res.json(activeSession);
  } catch (error) {
    console.error("[SESSION] Erro ao buscar sessão:", error);
    res.status(500).json({ error: "Erro ao buscar sessão" });
  }
});

// 2. Iniciar
router.post("/start", async (req, res) => {
  try {
    if (!req.session?.user?.email) return res.status(401).json({ error: "Não autenticado" });
    const userEmail = req.session.user.email;
    const { taskType } = req.body || {};

    await prisma.workSession.updateMany({
      where: { userEmail, status: { in: ["RUNNING", "PAUSED"] } },
      data: { status: "ABORTED", stoppedAt: new Date() }
    });

    const ws = await prisma.workSession.create({
      data: {
        userEmail,
        taskType: taskType || "Geral",
        status: "RUNNING",
        lastPingAt: new Date()
      }
    });
    console.log(`[SESSION] ${userEmail} Iniciou: ${taskType || 'Geral'}`);
    res.json(ws);
  } catch (error) {
    console.error("[SESSION] Erro ao iniciar:", error);
    res.status(500).json({ error: "Erro ao iniciar" });
  }
});

// 3. Pausar
router.post("/pause", async (req, res) => {
  try {
    if (!req.session?.user?.email) return res.status(401).json({ error: "Não autenticado" });
    const userEmail = req.session.user.email;
    const ws = await prisma.workSession.findFirst({ 
      where: { userEmail, status: "RUNNING" },
      orderBy: { startedAt: "desc" }
    });
    
    if (!ws) return res.status(400).json({ error: "Nenhuma sessão em execução para pausar" });

    const updated = await prisma.workSession.update({
      where: { id: ws.id },
      data: { status: "PAUSED", pausedAt: new Date() }
    });
    console.log(`[SESSION] ${userEmail} Pausou: ${ws.taskType}`);
    res.json(updated);
  } catch (error) {
    console.error("[SESSION] Erro ao pausar:", error);
    res.status(500).json({ error: "Erro ao pausar" });
  }
});

// 4. Retomar
router.post("/resume", async (req, res) => {
  try {
    if (!req.session?.user?.email) return res.status(401).json({ error: "Não autenticado" });
    const userEmail = req.session.user.email;
    const ws = await prisma.workSession.findFirst({ 
      where: { userEmail, status: "PAUSED" },
      orderBy: { startedAt: "desc" }
    });
    
    if (!ws) return res.status(400).json({ error: "Nenhuma sessão pausada para retomar" });

    const now = new Date();
    const pauseDuration = now.getTime() - new Date(ws.pausedAt).getTime();

    const updated = await prisma.workSession.update({
      where: { id: ws.id },
      data: { 
        status: "RUNNING", 
        pausedAt: null, 
        totalPausedMs: (ws.totalPausedMs || 0) + pauseDuration 
      }
    });
    console.log(`[SESSION] ${userEmail} Retomou: ${ws.taskType}`);
    res.json(updated);
  } catch (error) {
    console.error("[SESSION] Erro ao retomar:", error);
    res.status(500).json({ error: "Erro ao retomar" });
  }
});

// 5. Parar
router.post("/stop", async (req, res) => {
  try {
    if (!req.session?.user?.email) return res.status(401).json({ error: "Não autenticado" });
    const userEmail = req.session.user.email;
    const ws = await prisma.workSession.findFirst({ 
      where: { userEmail, status: { in: ["RUNNING", "PAUSED"] } },
      orderBy: { startedAt: "desc" }
    });

    if (!ws) return res.status(400).json({ error: "Nenhuma sessão ativa encontrada" });

    const stoppedAt = new Date();
    let totalPaused = ws.totalPausedMs || 0;

    if (ws.status === "PAUSED" && ws.pausedAt) {
      totalPaused += stoppedAt.getTime() - new Date(ws.pausedAt).getTime();
    }

    const durationMs = Math.max(0, (stoppedAt.getTime() - new Date(ws.startedAt).getTime()) - totalPaused);

    await prisma.workSession.update({
      where: { id: ws.id },
      data: { stoppedAt, durationMs, status: "STOPPED", lastPingAt: stoppedAt, totalPausedMs: totalPaused }
    });
    console.log(`[SESSION] ${userEmail} Finalizou: ${ws.taskType} | Duração: ${Math.floor(durationMs / 60000)} min`);
    res.json({ ok: true });
  } catch (error) {
    console.error("[SESSION] Erro ao parar:", error);
    res.status(500).json({ error: "Erro ao parar" });
  }
});

// 6. Ping (heartbeat)
router.post("/ping", async (req, res) => {
  try {
    if (!req.session?.user?.email) return res.status(401).json({ error: "Não autenticado" });
    const userEmail = req.session.user.email;
    await prisma.workSession.updateMany({
      where: { userEmail, status: { in: ["RUNNING", "PAUSED"] } },
      data: { lastPingAt: new Date() }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[SESSION] Erro no ping:", e);
    res.status(5000).json({ error: "Erro no ping" });
  }
});

export default router;
