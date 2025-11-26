const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

const router = express.Router();

router.use(express.json());

router.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "hostCcs.html"));
});

router.post("/", (req, res) => {
  const { group, identifier, ips } = req.body || {};

  if (!group || !identifier || !ips || !ips.internet || !ips.mpls) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  const ipList = [
    ips.internet.mkt || "",
    ips.internet.gary || "",
    ips.internet.plankton || "",
    ips.internet.wan || "",
    ips.internet.lan || "",
    ips.mpls.mkt || "",
    ips.mpls.gary || "",
    ips.mpls.plankton || "",
    ips.mpls.wan || "",
    ips.mpls.lan || "",
  ];

  // Use the script that has the Zabbix config.ini bundled with it
  const scriptPath = path.join(__dirname, "..", "scripts", "ZabbixAPI", "create_hots_hosts.py");
  const args = [scriptPath, group, identifier, ...ipList];

  let stdout = "";
  let stderr = "";
  let responded = false;

  const python = spawn("python", args, { shell: false });

  python.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  python.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  python.on("error", (err) => {
    if (responded) return;
    responded = true;
    console.error("Erro ao iniciar script Python:", err);
    res.status(500).json({ error: "Falha ao iniciar o script Python.", details: err.message });
  });

  python.on("close", (code) => {
    if (responded) return;
    responded = true;

    if (code !== 0) {
      try {
        const errorJson = JSON.parse(stderr || "{}");
        return res.status(500).json(errorJson);
      } catch (_e) {
        return res.status(500).json({ error: "Erro ao executar o script.", details: stderr.trim() });
      }
    }

    try {
      const results = JSON.parse(stdout || "[]");
      res.json(results);
    } catch (_e) {
      res.status(500).json({ error: "Erro ao processar a resposta do script.", details: stdout.trim() });
    }
  });
});

module.exports = router;
