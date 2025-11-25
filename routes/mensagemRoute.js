const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const router = express.Router();

const TPL_DIR = path.join(__dirname, "..", "data");
const TABELA_IPS_PATH = path.join(__dirname, "..", "data", "ccs", "tabelaIps.txt");


router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "tabelaIps.html"));
});

router.get("/ips", (_req, res) => {
  try {
    const raw = fs.readFileSync(TABELA_IPS_PATH, "utf8");
    const rows = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.toLowerCase().startsWith("p /32")) return null; // ignora cabeçalho
        const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)$/);
        if (!match) return null;
        const [, p32, bloco30, asn] = match;
        return { p32, bloco30, asn };
      })
      .filter((row) => row && row.p32 && row.bloco30 && row.asn);
    res.json({ rows });
  } catch (err) {
    console.error("Erro lendo tabela de IPs:", err);
    res.status(500).json({ error: "Falha ao carregar tabela de IPs." });
  }
});




module.exports = router;
