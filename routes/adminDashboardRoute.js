import express from "express";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const TZ = "America/Sao_Paulo";
const prisma = new PrismaClient();
const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const [totals, lastSessions] = await Promise.all([
      prisma.workSession.groupBy({
        by: ["userEmail"],
        _sum: { durationMs: true },
      }),
      prisma.workSession.findMany({
        distinct: ["userEmail"],
        orderBy: [{ userEmail: "asc" }, { startedAt: "desc" }],
        select: {
          userEmail: true,
          startedAt: true,
          status: true,
          taskType: true,
          pausedAt: true,
          totalPausedMs: true,
        },
      }),
    ]);

    // Mapa de total por usuário (evita O(n²))
    const totalByEmail = new Map(
      totals.map((t) => [t.userEmail, t._sum.durationMs ?? 0])
    );

    const now = Date.now();

    const result = lastSessions.map((s) => {
      const totalPaused = s.totalPausedMs ?? 0;
      const startedAtMs = new Date(s.startedAt).getTime();

      let currentElapsed = 0;
      if (s.status === "RUNNING") {
        currentElapsed = now - startedAtMs - totalPaused;
      } else if (s.status === "PAUSED") {
        const pausedAtMs = s.pausedAt ? new Date(s.pausedAt).getTime() : now;
        currentElapsed = pausedAtMs - startedAtMs - totalPaused;
      }

      return {
        userEmail: s.userEmail,
        currentStatus: s.status ?? "OFFLINE",
        currentTask: s.taskType ?? "-",
        currentElapsedMs: Math.max(0, currentElapsed),
        totalWorkTimeMs: totalByEmail.get(s.userEmail) ?? 0,
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar estatísticas" });
  }
});



router.get("/stats/yesterday", async (req, res) => {
  try {
    const start = DateTime.now().setZone(TZ).minus({ days: 1 }).startOf("day").toJSDate();
    const end   = DateTime.now().setZone(TZ).minus({ days: 1 }).endOf("day").toJSDate();

    const totalsYesterday = await prisma.workSession.groupBy({
      by: ["userEmail"],
      where: {
        startedAt: { gte: start, lte: end },
        durationMs: { not: null },
      },
      _sum: { durationMs: true },
    });

    res.json(totalsYesterday.map(t => ({
      userEmail: t.userEmail,
      totalWorkTimeMs: t._sum.durationMs ?? 0,
      start,
      end,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar estatísticas de ontem" });
  }
});

// Totais por data específica: GET /api/admin/stats/date?date=YYYY-MM-DD
router.get("/stats/date", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Parâmetro 'date' inválido. Use YYYY-MM-DD." });
    }

    const dt = DateTime.fromISO(date, { zone: TZ });
    if (!dt.isValid) return res.status(400).json({ error: "Data inválida." });

    const start = dt.startOf("day").toJSDate();
    const end   = dt.endOf("day").toJSDate();

    const totals = await prisma.workSession.groupBy({
      by: ["userEmail"],
      where: {
        startedAt: { gte: start, lte: end },
        durationMs: { not: null },
      },
      _sum: { durationMs: true },
    });

    res.json(totals.map(t => ({
      userEmail: t.userEmail,
      totalWorkTimeMs: t._sum.durationMs ?? 0,
      date,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar estatísticas por data" });
  }
});

export default router;