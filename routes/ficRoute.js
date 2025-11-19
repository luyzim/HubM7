const express = require("express");
const path = require("path");
const { getUnidades } = require("../scripts/4g/4G-2.0/controllers/unidadesController");
const { postRun } = require("../scripts/4g/4G-2.0/controllers/runController");



// Se algo não for function, para aqui com erro claro
if (typeof getUnidades !== "function" || typeof postRun !== "function") {
  throw new Error("Controllers não exportaram função corretamente. Veja [debug] acima.");
}

const router = express.Router();

// Front
router.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "indexFic.html"));
});

// Lista de unidades (precisa ser uma função!)
router.get("/unidades", getUnidades);

// Automação
router.post("/run", postRun);

module.exports = router;
