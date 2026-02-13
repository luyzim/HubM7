// routes/workSessionRoute.js
import express from "express";
import prisma from "../prisma.js"; // ajuste seu caminho
import { ensureAuth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/start", ensureAuth, async (req, res) => {
  const userEmail = req.session.user.email;
  const { taskType, context } = req.body || {};

  if (!taskType) return res.status(400).json({ error: "taskType obrigatório" });

  // Política: só 1 RUNNING por usuário (recomendado)
  await prisma.workSession.updateMany({
    where: { userEmail, status: "RUNNING" },
    data: { status: "ABORTED", stoppedAt: new Date() }
  });

  const ws = await prisma.workSession.create({
    data: {
      userEmail,
      taskType,
      context: context ?? null,
      status: "RUNNING",
      lastPingAt: new Date()
    }
  });

  res.json({ id: ws.id, startedAt: ws.startedAt });
});

router.post("/stop", ensureAuth, async (req, res) => {
  const userEmail = req.session.user.email;
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id obrigatório" });

  const ws = await prisma.workSession.findFirst({ where: { id, userEmail }});
  if (!ws) return res.status(404).json({ error: "Sessão não encontrada" });
  if (ws.status !== "RUNNING") return res.json({ ok: true, alreadyStopped: true });

  const stoppedAt = new Date();
  const durationMs = Math.max(0, stoppedAt - ws.startedAt);

  const updated = await prisma.workSession.update({
    where: { id },
    data: { stoppedAt, durationMs, status: "STOPPED", lastPingAt: stoppedAt }
  });

  res.json({ ok: true, durationMs: updated.durationMs, stoppedAt: updated.stoppedAt });
});

// Opcional: heartbeat pra reduzir “sessão zumbi”
router.post("/ping", ensureAuth, async (req, res) => {
  const userEmail = req.session.user.email;
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id obrigatório" });

  await prisma.workSession.updateMany({
    where: { id, userEmail, status: "RUNNING" },
    data: { lastPingAt: new Date() }
  });

  res.json({ ok: true });
});

export default router;