import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const defaultArgs = [
  path.join(projectRoot, "scripts", "prewarm_hub_insights.py"),
];

const extraArgs = process.argv.slice(2);
let lastLaunchError = null;

for (const candidate of pythonCandidates) {
  if (path.isAbsolute(candidate.command) && !existsSync(candidate.command)) {
    continue;
  }

  const result = spawnSync(candidate.command, [...candidate.args, ...defaultArgs, ...extraArgs], {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
  });

  if (!result.error) {
    process.exit(result.status ?? 0);
  }

  lastLaunchError = `${candidate.label}: ${result.error.message}`;
}

console.error("Python nao encontrado. Habilite 'py' ou 'python' no PATH, ou ajuste scripts/run-prewarm-hub-cache.mjs com o caminho correto do python.exe.");
if (lastLaunchError) {
  console.error("Ultima tentativa:", lastLaunchError);
}
process.exit(1);
