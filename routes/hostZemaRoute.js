const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

const router = express.Router();

router.use(express.json());

const ZBX = {}; // Placeholder for Zabbix credentials


function handlePythonSpawn(scriptName, req, res) {
    const body = req.body || {};
    const payload = {
        zabbix: ZBX,                       // ← injeta credenciais aqui
        unidade: body.unidade || body,     // ← aceita {unidade:{...}} ou direto {...}
    };

    const py = spawn("python", [scriptName, "--stdin-json"], { stdio: ["pipe", "pipe", "pipe"] });

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();

    let out = "", err = "";
    py.stdout.on("data", (d) => out += d.toString());
    py.stderr.on("data", (d) => err += d.toString());

    py.on("close", (code) => {
        if (code === 0) {
            try {
                // Tenta parsear a saída como JSON
                const jsonData = JSON.parse(out);
                res.json({ ok: true, data: jsonData });
            } catch (e) {
                // Se não for JSON, envia como mensagem de texto
                res.json({ ok: true, message: out.trim() || "OK" });
            }
        } else {
            res.status(500).json({ ok: false, error: err || out || `Python exited ${code}` });
        }
    });
}

router.post('/', (req, res) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'createHostZema.py');
    handlePythonSpawn(scriptPath, req, res);
    console.log("Feito spawn do python para criação dos hosts Zema", req.body);
});

module.exports = router;