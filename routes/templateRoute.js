import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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

export default router;
