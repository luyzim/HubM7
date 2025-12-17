import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runBridge(unidade, cwd) {
  const pythonCmd = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  const scriptPath = path.join(cwd, "automations", "bridge_cli.py");

  return new Promise((resolve) => {
    const py = spawn(pythonCmd, [scriptPath, "--unidade", unidade], {
      cwd: path.join(cwd, "automations"),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let out = "", err = "";
    py.stdout.on("data", d => (out += d.toString("utf-8")));
    py.stderr.on("data", d => (err += d.toString("utf-8")));
    py.on("close", code => resolve({ code, out, err }));
  });
}
export { runBridge };
