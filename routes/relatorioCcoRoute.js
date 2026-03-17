import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

router.use(express.json());

const SHARED_STORE_PATH = path.join(process.cwd(), "data", "relatorioCcoStore.json");
const sharedStore = {
  loaded: false,
  loadingPromise: null,
  writeQueue: Promise.resolve(),
  version: 0,
  updatedAt: null,
  tickets: [],
};

function ensureAuthenticated(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, error: "Nao autenticado." });
  }
  return next();
}

function getUserLabel(req) {
  return req.session?.user?.email || req.session?.user?.id || "desconhecido";
}

function buildLogContext(context = {}) {
  return Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

function logRelatorioSuccess(route, action, req, context = {}) {
  const details = buildLogContext({
    action,
    user: getUserLabel(req),
    ...context,
  });
  console.log(`[relatorio][${route}][OK] ${details}`);
}

function logRelatorioError(route, error) {
  console.error(`[relatorio][${route}][ERROR]`, error);
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

function normalizeStoredTicket(ticket = {}) {
  const now = new Date().toISOString();
  return {
    id: String(ticket.id || crypto.randomUUID()),
    ...sanitizeTicket(ticket),
    createdAt: String(ticket.createdAt || now),
    updatedAt: String(ticket.updatedAt || now),
  };
}

function normalizeStoredTickets(tickets) {
  return Array.isArray(tickets) ? tickets.map((ticket) => normalizeStoredTicket(ticket)) : [];
}

function getSyncMeta() {
  return {
    syncVersion: sharedStore.version,
    syncUpdatedAt: sharedStore.updatedAt,
  };
}

async function persistStore() {
  await fs.mkdir(path.dirname(SHARED_STORE_PATH), { recursive: true });
  await fs.writeFile(
    SHARED_STORE_PATH,
    JSON.stringify(
      {
        version: sharedStore.version,
        updatedAt: sharedStore.updatedAt,
        tickets: sharedStore.tickets,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function ensureStoreLoaded() {
  if (sharedStore.loaded) return;

  if (!sharedStore.loadingPromise) {
    sharedStore.loadingPromise = (async () => {
      await fs.mkdir(path.dirname(SHARED_STORE_PATH), { recursive: true });

      try {
        const raw = await fs.readFile(SHARED_STORE_PATH, "utf8");
        const parsed = JSON.parse(raw);
        sharedStore.tickets = normalizeStoredTickets(parsed?.tickets);
        sharedStore.version = Number.isFinite(Number(parsed?.version)) ? Number(parsed.version) : 0;
        sharedStore.updatedAt = String(parsed?.updatedAt || new Date().toISOString());
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        sharedStore.tickets = [];
        sharedStore.version = 0;
        sharedStore.updatedAt = new Date().toISOString();
        await persistStore();
      }

      sharedStore.loaded = true;
    })().finally(() => {
      sharedStore.loadingPromise = null;
    });
  }

  await sharedStore.loadingPromise;
}

async function runSerializedMutation(mutator) {
  const task = sharedStore.writeQueue.then(async () => {
    await ensureStoreLoaded();
    const result = await mutator(sharedStore);
    sharedStore.version += 1;
    sharedStore.updatedAt = new Date().toISOString();
    await persistStore();
    return { result, syncMeta: getSyncMeta() };
  });

  sharedStore.writeQueue = task.catch(() => {});
  return task;
}

router.get("/sync", ensureAuthenticated, async (req, res) => {
  try {
    await ensureStoreLoaded();
    return res.json({
      success: true,
      ticketCount: sharedStore.tickets.length,
      ...getSyncMeta(),
    });
  } catch (error) {
    logRelatorioError("GET /sync", error);
    return res.status(500).json({ success: false, error: "Erro ao verificar sincronizacao." });
  }
});

router.get("/tickets", ensureAuthenticated, async (req, res) => {
  try {
    await ensureStoreLoaded();
    return res.json({
      success: true,
      tickets: sharedStore.tickets,
      ...getSyncMeta(),
    });
  } catch (error) {
    logRelatorioError("GET /tickets", error);
    return res.status(500).json({ success: false, error: "Erro ao listar tickets." });
  }
});

router.post("/tickets", ensureAuthenticated, async (req, res) => {
  try {
    const { result, syncMeta } = await runSerializedMutation((store) => {
      const payload = sanitizeTicket(req.body);
      const timestamp = new Date().toISOString();
      const ticket = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      store.tickets.push(ticket);
      return {
        ticket,
        totalTickets: store.tickets.length,
      };
    });

    logRelatorioSuccess("POST /tickets", "create", req, {
      ticketId: result.ticket.id,
      tickets: result.totalTickets,
      syncVersion: syncMeta.syncVersion,
    });

    return res.status(201).json({ success: true, ticket: result.ticket, ...syncMeta });
  } catch (error) {
    logRelatorioError("POST /tickets", error);
    return res.status(500).json({ success: false, error: "Erro ao criar ticket." });
  }
});

router.put("/tickets/:id", ensureAuthenticated, async (req, res) => {
  try {
    const { result, syncMeta } = await runSerializedMutation((store) => {
      const idx = store.tickets.findIndex((ticket) => String(ticket.id) === String(req.params.id));
      if (idx === -1) {
        const notFoundError = new Error("Ticket nao encontrado.");
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      store.tickets[idx] = {
        ...store.tickets[idx],
        ...sanitizeTicket(req.body),
        updatedAt: new Date().toISOString(),
      };

      return {
        ticket: store.tickets[idx],
        totalTickets: store.tickets.length,
      };
    });

    logRelatorioSuccess("PUT /tickets/:id", "update", req, {
      ticketId: result.ticket.id,
      tickets: result.totalTickets,
      syncVersion: syncMeta.syncVersion,
    });

    return res.json({ success: true, ticket: result.ticket, ...syncMeta });
  } catch (error) {
    if (error?.statusCode === 404) {
      return res.status(404).json({ success: false, error: error.message });
    }

    logRelatorioError("PUT /tickets/:id", error);
    return res.status(500).json({ success: false, error: "Erro ao atualizar ticket." });
  }
});

router.delete("/tickets/:id", ensureAuthenticated, async (req, res) => {
  try {
    const { result, syncMeta } = await runSerializedMutation((store) => {
      const idx = store.tickets.findIndex((ticket) => String(ticket.id) === String(req.params.id));
      if (idx === -1) {
        const notFoundError = new Error("Ticket nao encontrado.");
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      const removed = store.tickets.splice(idx, 1)[0];
      return {
        ticket: removed,
        totalTickets: store.tickets.length,
      };
    });

    logRelatorioSuccess("DELETE /tickets/:id", "delete", req, {
      ticketId: result.ticket.id,
      tickets: result.totalTickets,
      syncVersion: syncMeta.syncVersion,
    });

    return res.json({ success: true, ticket: result.ticket, ...syncMeta });
  } catch (error) {
    if (error?.statusCode === 404) {
      return res.status(404).json({ success: false, error: error.message });
    }

    logRelatorioError("DELETE /tickets/:id", error);
    return res.status(500).json({ success: false, error: "Erro ao remover ticket." });
  }
});

router.post("/reminder", ensureAuthenticated, (req, res) => {
  return res.json({ success: true });
});

router.post("/gerar", ensureAuthenticated, (req, res) => {
  const totalTickets = Number(req.body?.totalTickets || 0);
  logRelatorioSuccess("POST /gerar", "generate", req, { tickets: totalTickets });
  return res.json({ success: true });
});

export default router;
