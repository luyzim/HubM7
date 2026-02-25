import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REMINDER_HEADER = "x-work-session-reminder";
const AUTOMATION_PREFIXES = [
  "/api/unimed",
  "/api/bkpMkt",
  "/api/4g",
  "/api/mkt/mensagem",
  "/api/cisco",
  "/api/host-ccs",
  "/api/oxidized",
  "/api/comandos-oxidized",
  "/api/host-zema",
  "/api/comandos-mkt",
  "/api/ccsFortgate",
  "/api/wiki",
];

function isWhitelistedAutomationPath(pathname) {
  return AUTOMATION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export default function workSessionReminder(req, res, next) {
  if (req.method !== "POST") return next();
  if (!req.path.startsWith("/api/")) return next();
  if (!isWhitelistedAutomationPath(req.path)) return next();

  const userEmail = req.session?.user?.email;
  if (!userEmail) return next();

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let checked = false;
  let shouldRemind = false;

  async function setReminderHeaderIfNeeded() {
    if (checked) {
      if (shouldRemind) res.setHeader(REMINDER_HEADER, "1");
      return;
    }

    checked = true;
    if (res.statusCode >= 400) return;

    try {
      const activeSession = await prisma.workSession.findFirst({
        where: {
          userEmail,
          status: "RUNNING",
        },
        select: { id: true },
      });

      shouldRemind = Boolean(activeSession);
      if (shouldRemind) {
        res.setHeader(REMINDER_HEADER, "1");
      }
    } catch (error) {
      console.error("[REMINDER] Erro ao verificar sessao ativa:", error);
    }
  }

  res.json = async function patchedJson(body) {
    await setReminderHeaderIfNeeded();
    return originalJson(body);
  };

  res.send = async function patchedSend(body) {
    await setReminderHeaderIfNeeded();
    return originalSend(body);
  };

  next();
}
