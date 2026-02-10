import express from "express";
import * as templateController from "../controllers/templateController.js";
import ensureN2 from "../middleware/ensureN2.js";
import ensureAdmin from "../middleware/ensureAdmin.js";
const router = express.Router();

// Get all templates
router.get("/", ensureN2, templateController.getAllTemplates);

// Get a single template by ID
router.get("/:id", ensureN2, templateController.getTemplateById);

// Create a new template (Admin only)
router.post("/", ensureAdmin, templateController.createTemplate);

// Update a template by ID (Admin only)
router.put("/:id", ensureAdmin, templateController.updateTemplate);

// Delete a template by ID (Admin only)
router.delete("/:id", ensureAdmin, templateController.deleteTemplate);

export default router;