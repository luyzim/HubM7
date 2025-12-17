import express from "express";
import path from "path";
import { spawn } from "child_process";
const router = express.Router();

router.get("/", (req, res) => {
  // pode ser JSON, HTML, qualquer payload
  res.json({
    app: "Hub de Automação",
    version: "1.0.0",
    status: "operacional",
  });
});

export default router;