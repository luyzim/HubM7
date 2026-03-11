import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.post("/api/relatorio/gerar", express.json(), (req, res) => {
  try {
    const dados = req.body;
    // processa dados (simples)
    const texto = `[OK]Relatório gerado para: ${dados?.nome ?? "sem nome"}`;
    res.json({ ok: true, relatorio: texto });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Erro ao gerar relatório" });
  }
});

export default router;