const { spawn } = require("child_process");
const path = require("path");

function runBridge(unidade, cwd) {
  const pythonCmd = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
  const automationsDir = path.join(__dirname, "..", "automations");
  const scriptPath = path.join(automationsDir, "bridge_cli.py");

  return new Promise((resolve) => {
    const py = spawn(pythonCmd, [scriptPath, "--unidade", unidade], {
      cwd: automationsDir,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let out = "", err = "";
    py.stdout.on("data", d => (out += d.toString("utf-8")));
    py.stderr.on("data", d => (err += d.toString("utf-8")));
    py.on("close", code => resolve({ code, out, err }));
  });
}
module.exports = { runBridge };

module.exports = { runBridge };
