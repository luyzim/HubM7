import express from 'express';
import 'dotenv/config'; // Ensure env variables are loaded
import { PrismaClient } from '@prisma/client'; // Use @prisma/client directly
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();


// Middleware to authenticate clients
function clientAuth(req, res, next) {
  const h = req.headers['x-authorization'] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.client = payload; // { id, email, name }
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err); // Log the specific error
    return res.status(401).json({ error: "unauthorized" });
  }
}

// POST /api/client/signup - Register a new client
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  }

  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const pass_hash = await bcrypt.hash(password, salt);

    // Insert new client into the database
    const client = await prisma.clients.create({
      data: {
        name,
        email,
        pass_hash,
      },
    });

    const token = jwt.sign({ id: client.id, email: client.email, name: client.name }, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.status(201).json({ message: 'Cadastro realizado com sucesso!', token });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor ao cadastrar.' });
  }
});

// POST /api/client/login
router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    try {
      const client = await prisma.clients.findUnique({ where: { email } });
      if (!client) return res.status(401).json({ error: "credenciais inválidas" });
      const ok = await bcrypt.compare(password || "", client.pass_hash);
      if (!ok) return res.status(401).json({ error: "credenciais inválidas" });
      const token = jwt.sign({ id: client.id, email: client.email, name: client.name }, process.env.JWT_SECRET, { expiresIn: "8h" });
      res.json({ token });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

// GET /api/client/my-orders - Get all orders for the authenticated client
router.get("/my-orders", clientAuth, async (req, res) => {
  try {
    const orders = await prisma.orders.findMany({
      where: {
        client_id: req.client.id,
      },
      include: {
        order_items: {
          include: {
            items: {
              select: {
                name: true,
                image_url: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const response = orders.map(order => ({
      id: order.id,
      customer_name: order.customer_name,
      customer_table: order.customer_table,
      status: order.status,
      total_cents: order.total_cents,
      created_at: order.created_at,
      items: order.order_items.map(oi => ({
        item_id: oi.item_id,
        name: oi.items.name,
        qty: oi.qty,
        unit_price_cents: oi.unit_price_cents,
        options: oi.options,
        image_url: oi.items.image_url,
      })),
    }));

    res.json(response);
  } catch (e) {
    console.error("Database error in /api/client/my-orders:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
