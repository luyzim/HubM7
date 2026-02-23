import express from "express";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const allSessions = await prisma.workSession.findMany({
      select: {
        userEmail: true,
        startedAt: true,
        status: true,
        taskType: true,
        durationMs: true,
        totalPausedMs: true,
        pausedAt: true,
      },
      orderBy: { startedAt: "desc" },
    });

    const totals = await prisma.workSession.groupBy({
      by: ["userEmail"],
      _sum: { durationMs: true },
    });

    const statsMap = allSessions.reduce((acc, session) => {
      const email = session.userEmail;
      if (!acc[email]) {
        acc[email] = {
          userEmail: email,
          currentStatus: "OFFLINE",
          currentTask: "-",
          currentElapsedMs: 0,
          totalWorkTimeMs: 0,
          lastStartedAt: null
        };
      }

      if (session.durationMs != null) {
        acc[email].totalWorkTimeMs += session.durationMs;
      }

      if (!acc[email].lastStartedAt || session.startedAt > acc[email].lastStartedAt) {
        acc[email].lastStartedAt = session.startedAt;
        acc[email].currentStatus = session.status;
        acc[email].currentTask = session.taskType;
        acc[email].activeSession = session;
      }

      return acc;
    }, {});

    const result = Object.values(statsMap).map(u => {
      let currentElapsed = 0;
      if (u.currentStatus === "RUNNING") {
        currentElapsed = Date.now() - new Date(u.activeSession.startedAt).getTime() - (u.activeSession.totalPausedMs || 0);
      } else if (u.currentStatus === "PAUSED") {
        currentElapsed = new Date(u.activeSession.pausedAt).getTime() - new Date(u.activeSession.startedAt).getTime() - (u.activeSession.totalPausedMs || 0);
      }
      
      delete u.activeSession;
      delete u.lastStartedAt;
      
      return { ...u, currentElapsedMs: Math.max(0, currentElapsed) };
    });

    const lastSessions = await prisma.workSession.findMany({
      distinct: ["userEmail"],
      orderBy: [
        { userEmail: "asc" },
        { startedAt: "desc" }, // pega a mais recente por usuário
      ],
      select: {
        userEmail: true,
        startedAt: true,
        status: true,
        taskType: true,
        pausedAt: true,
        totalPausedMs: true,
      },
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar estatísticas" });
  }
});

export default router;





