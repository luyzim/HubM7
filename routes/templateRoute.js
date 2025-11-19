const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");

function listarTemplates(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".txt"));
}

router.get("/templates", (req, res) => {
  try {
    const names = listarTemplates(DATA_DIR);
    res.json({ templates: names.map((name, i) => ({ idx: i + 1, name })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
