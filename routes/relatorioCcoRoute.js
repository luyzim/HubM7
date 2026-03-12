import express from "express";
import crypto from "crypto";

const router = express.Router();

router.use(express.json());

// Memoria por usuario (trocar por banco quando necessario).
const ticketStore = new Map();

function ensureAuthenticated(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, error: "Nao autenticado." });
  }
  return next();
}

function getUserKey(req) {
  return req.session?.user?.id || req.session?.user?.email || req.sessionID;
}

function getUserTickets(req) {
  const key = getUserKey(req);
  if (!ticketStore.has(key)) ticketStore.set(key, []);
  return ticketStore.get(key);
}

function sanitizeTicket(body = {}) {
  const updates = Array.isArray(body.updates)
    ? body.updates.slice(0, 4).map((u) => ({
        updateDate: String(u?.updateDate || "").trim(),
        updateHour: String(u?.updateHour || "").trim(),
        text: String(u?.text || "").trim(),
      }))
    : [];

  return {
    number: String(body.number || "").trim(),
    status: String(body.status || "").trim(),
    openingDate: String(body.openingDate || "").trim(),
    openingHour: String(body.openingHour || "").trim(),
    client: String(body.client || "").trim(),
    occurrence: String(body.occurrence || "").trim(),
    updates,
  };
}

router.get("/tickets", ensureAuthenticated, (req, res) => {
  try {
    return res.json({ success: true, tickets: getUserTickets(req) });
  } catch (error) {
    console.error("[relatorio][GET /tickets]", error);
    return res.status(500).json({ success: false, error: "Erro ao listar tickets." });
  }
});

router.post("/tickets", ensureAuthenticated, (req, res) => {
  try {
    const tickets = getUserTickets(req);
    const payload = sanitizeTicket(req.body);
    const ticket = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tickets.push(ticket);
    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    console.error("[relatorio][POST /tickets]", error);
    return res.status(500).json({ success: false, error: "Erro ao criar ticket." });
  }
});

router.put("/tickets/:id", ensureAuthenticated, (req, res) => {
  try {
    const tickets = getUserTickets(req);
    const idx = tickets.findIndex((t) => String(t.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, error: "Ticket nao encontrado." });

    tickets[idx] = {
      ...tickets[idx],
      ...sanitizeTicket(req.body),
      updatedAt: new Date().toISOString(),
    };

    return res.json({ success: true, ticket: tickets[idx] });
  } catch (error) {
    console.error("[relatorio][PUT /tickets/:id]", error);
    return res.status(500).json({ success: false, error: "Erro ao atualizar ticket." });
  }
});

router.delete("/tickets/:id", ensureAuthenticated, (req, res) => {
  try {
    const tickets = getUserTickets(req);
    const idx = tickets.findIndex((t) => String(t.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, error: "Ticket nao encontrado." });

    const removed = tickets.splice(idx, 1)[0];
    return res.json({ success: true, ticket: removed });
  } catch (error) {
    console.error("[relatorio][DELETE /tickets/:id]", error);
    return res.status(500).json({ success: false, error: "Erro ao remover ticket." });
  }
});

router.post("/reminder", ensureAuthenticated, (req, res) => {
  return res.json({ success: true });
});

router.post("/gerar", ensureAuthenticated, (req, res) => {
  const userLabel = req.session?.user?.email || req.session?.user?.id || "desconhecido";
  const totalTickets = Number(req.body?.totalTickets || 0);
  console.log(`[OK] relatorio gerado por ${userLabel} (tickets=${totalTickets})`);
  return res.json({ success: true });
});

export default router;
