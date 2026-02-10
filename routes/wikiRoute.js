// routes/wikiToolRoute.js
import express from "express";
import { createPage, appendBlockToPageByPath } from "../scripts/wikiScript.js";

const router = express.Router();

router.post("/run", async (req, res) => {
  //console.log("Recebida requisição POST para /wiki/run. Body:", req.body);
  try {
    let { action, path, title, text, locale = "pt-br", marker = "ZIBRA:AUTO" } = req.body || {};
    // Ensure path does not start with a leading slash for consistency with Wiki.js API
    if (path && path.startsWith('/')) {
      path = path.substring(1);
    }

    if (!action) return res.status(400).json({ error: "action é obrigatório" });
    if (!path) return res.status(400).json({ error: "path é obrigatório" });

    console.log(`Tentando ${action} para o caminho: ${path}`); // Log do caminho

    if (action === "create_page") {
      if (!title) return res.status(400).json({ error: "title é obrigatório para create_page" });

      const page = await createPage({
        path,
        title,
        content: text || "",
        locale,
        editor: "markdown",
        tags: [],
        description: "",
        isPublished: true,
        isPrivate: false,
      });

      return res.json({ ok: true, result: page });
    }

    if (action === "append_block") {
      const page = await appendBlockToPageByPath({
        path,
        locale,
        marker,
        text: text || "",
      });

      return res.json({ ok: true, result: page });
    }

    return res.status(400).json({ error: "action inválida" });
  } catch (e) {
    // Wiki.js PageNotFound error code is 6003
    if (e.code === "NOT_FOUND" || e.wikiCode === 6003) {
      console.warn(`Página Wiki não encontrada para o caminho: ${req.body?.path || 'N/A'}. Erro: ${e.message}`);
      return res.status(404).json({ error: e.message });
    }
    console.error("Erro interno na rota /wiki/run:", e);
    return res.status(500).json({ error: e.message, meta: e.meta || null, details: e.details || null });
  }
});

router.post("/run/append", async (req, res) => {
  try {
    let { path, title, text, locale = "pt-br", marker = "ZIBRA:AUTO" } = req.body || {};
    // Ensure path does not start with a leading slash for consistency with Wiki.js API
    if (path && path.startsWith('/')) {
      path = path.substring(1);
    }

    let action = "append_block";

    if (!action) return res.status(400).json({ error: "action é obrigatório" });
    if (!path) return res.status(400).json({ error: "path é obrigatório" });

    

    if (action === "append_block") {
      const page = await appendBlockToPageByPath({
        path,
        locale,
        marker,
        text: text || "",
      });

      return res.json({ ok: true, result: page });
    }

    return res.status(400).json({ error: "action inválida" });
  } catch (e) {
    if (e.code === "NOT_FOUND") return res.status(404).json({ error: e.message });
    return res.status(500).json({ error: e.message, meta: e.meta || null, details: e.details || null });
  }
});


export default router;
