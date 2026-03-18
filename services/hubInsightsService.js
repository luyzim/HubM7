import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_HUB_INSIGHTS_DAYS = 90;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const pythonCandidates = [
  { command: "py", args: ["-3"], label: "py -3" },
  { command: "python", args: [], label: "python" },
  process.env.LOCALAPPDATA
    ? {
        command: path.join(process.env.LOCALAPPDATA, "Python", "pythoncore-3.14-64", "python.exe"),
        args: [],
        label: "python.exe (pythoncore-3.14-64)",
      }
    : null,
  process.env.LOCALAPPDATA
    ? {
        command: path.join(process.env.LOCALAPPDATA, "Programs", "Python", "Python314", "python.exe"),
        args: [],
        label: "python.exe (Programs/Python314)",
      }
    : null,
].filter(Boolean);

const defaultLogCandidates = [
  path.join(homedir(), "OneDrive", "Documentos", "Logs", "Hub", "Log Geral.txt"),
  path.join(homedir(), "OneDrive", "Documentos", "Logs", "Hub", "LogGeral.txt"),
  path.join(homedir(), ".pm2", "logs", "hub-out.log"),
];

const defaultLogPath =
  defaultLogCandidates.find((candidate) => existsSync(candidate)) ||
  defaultLogCandidates[0];

export class HubInsightsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "HubInsightsValidationError";
  }
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDate(value, fieldName) {
  if (!DATE_RE.test(value)) {
    throw new HubInsightsValidationError(`Parametro '${fieldName}' invalido. Use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || formatIsoDate(parsed) !== value) {
    throw new HubInsightsValidationError(`Parametro '${fieldName}' invalido. Use YYYY-MM-DD.`);
  }

  return parsed;
}

function getPreviousMonthRange(referenceDate = new Date()) {
  const currentMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const previousMonthEnd = new Date(currentMonthStart.getTime() - MS_PER_DAY);
  const previousMonthStart = new Date(previousMonthEnd.getFullYear(), previousMonthEnd.getMonth(), 1);

  return {
    from: formatIsoDate(previousMonthStart),
    to: formatIsoDate(previousMonthEnd),
  };
}

function normalizeQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value.trim() : "";
}

export function resolveHubInsightsRange({ from, to }, referenceDate = new Date()) {
  const normalizedFrom = normalizeQueryValue(from);
  const normalizedTo = normalizeQueryValue(to);
  const today = toDateOnly(referenceDate);

  if (!normalizedFrom && !normalizedTo) {
    const fallbackRange = getPreviousMonthRange(referenceDate);
    return {
      ...fallbackRange,
      days: Math.floor((parseIsoDate(fallbackRange.to, "to") - parseIsoDate(fallbackRange.from, "from")) / MS_PER_DAY) + 1,
    };
  }

  if (!normalizedFrom || !normalizedTo) {
    throw new HubInsightsValidationError("Informe 'from' e 'to' juntos.");
  }

  const startDate = toDateOnly(parseIsoDate(normalizedFrom, "from"));
  const endDate = toDateOnly(parseIsoDate(normalizedTo, "to"));

  if (startDate > endDate) {
    throw new HubInsightsValidationError("O inicio do periodo nao pode ser maior que o fim.");
  }

  if (startDate > today || endDate > today) {
    throw new HubInsightsValidationError("Nao e permitido solicitar datas futuras.");
  }

  const days = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
  if (days > MAX_HUB_INSIGHTS_DAYS) {
    throw new HubInsightsValidationError(`O intervalo maximo permitido e de ${MAX_HUB_INSIGHTS_DAYS} dias.`);
  }

  return {
    from: formatIsoDate(startDate),
    to: formatIsoDate(endDate),
    days,
  };
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });
}

async function runPythonGenerator(range) {
  const scriptArgs = [
    path.join(projectRoot, "scripts", "generate_report_data.py"),
    "--log",
    defaultLogPath,
    "--stdout-json",
    "--from",
    range.from,
    "--to",
    range.to,
  ];

  let lastError = null;

  for (const candidate of pythonCandidates) {
    if (path.isAbsolute(candidate.command) && !existsSync(candidate.command)) {
      continue;
    }

    try {
      const result = await runCommand(candidate.command, [...candidate.args, ...scriptArgs]);
      if (result.code === 0) {
        return result.stdout;
      }

      lastError = `${candidate.label}: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.code}`}`;
    } catch (error) {
      lastError = `${candidate.label}: ${error.message}`;
    }
  }

  throw new Error(
    lastError ||
      "Python nao encontrado. Habilite 'py' ou 'python' no PATH, ou ajuste o caminho do python.exe.",
  );
}

export async function getHubInsightsReport({ from, to }) {
  const range = resolveHubInsightsRange({ from, to });
  const output = await runPythonGenerator(range);

  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Resposta JSON invalida do gerador: ${error.message}`);
  }
}
