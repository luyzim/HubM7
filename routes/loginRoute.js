import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  try {
    // Tenta primeiro admin, depois user
    const providers = [
      { role: "admin", model: prisma.admins },
      { role: "n2", model: prisma.n2 },
      { role: "monitoring", model: prisma.monitoramento },
      { role: "n1", model: prisma.n1 },
    ];

    let account = null;
    let role = null;

    for (const p of providers) {
      const found = await p.model.findUnique({ where: { email } });
      if (found) {
        account = found;
        role = p.role;
        break;
      }
    }

   if (!account || !role) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const isMatch = await bcrypt.compare(password, account.pass_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    req.session.user = {
      id: account.id,
      email: account.email,
      role,
    };

    return res.json({
      message: "Login bem-sucedido!",
      role,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});
export default router;
