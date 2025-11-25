const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  try {
    // Tenta primeiro admin, depois user
    const admin = await prisma.admins.findUnique({ where: { email } });
    const user = admin
      ? null
      : await prisma.users.findUnique({ where: { email } });

    const account = admin || user;
    const role = admin ? "admin" : user ? "user" : null;

    if (!account || !role) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const isMatch = await bcrypt.compare(password, account.pass_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Coloca o usuário logado na sessão com a role correspondente
    req.session.user = { id: account.id, email: account.email, role };
    return res.json({ message: "Login bem-sucedido!", role });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
