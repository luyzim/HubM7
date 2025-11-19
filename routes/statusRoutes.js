const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "Servidor Online",
    hora: new Date().toLocaleString(),
    uptime: process.uptime(),
  });
});

module.exports = router;
