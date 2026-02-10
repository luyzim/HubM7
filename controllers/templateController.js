import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all Wiki Templates
export const getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.wikiTemplate.findMany();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching wiki templates:", error);
    res.status(500).json({ error: "Failed to fetch wiki templates" });
  }
};

// Get a single Wiki Template by ID
export const getTemplateById = async (req, res) => {
  const { id } = req.params;
  try {
    const template = await prisma.wikiTemplate.findUnique({
      where: { id: parseInt(id) },
    });
    if (template) {
      res.json(template);
    } else {
      res.status(404).json({ error: "Wiki template not found" });
    }
  } catch (error) {
    console.error("Error fetching wiki template by ID:", error);
    res.status(500).json({ error: "Failed to fetch wiki template" });
  }
};

// Create a new Wiki Template
export const createTemplate = async (req, res) => {
  const { name, content, editor, locale } = req.body;
  if (!name || !content) {
    return res.status(400).json({ error: "Name and content are required" });
  }
  try {
    const newTemplate = await prisma.wikiTemplate.create({
      data: { name, content, editor, locale },
    });
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error creating wiki template:", error);
    res.status(500).json({ error: "Failed to create wiki template" });
  }
};

// Update a Wiki Template by ID
export const updateTemplate = async (req, res) => {
  const { id } = req.params;
  const { name, content, editor, locale } = req.body;
  try {
    const updatedTemplate = await prisma.wikiTemplate.update({
      where: { id: parseInt(id) },
      data: { name, content, editor, locale },
    });
    res.json(updatedTemplate);
  } catch (error) {
    console.error("Error updating wiki template:", error);
    res.status(500).json({ error: "Failed to update wiki template" });
  }
};

// Delete a Wiki Template by ID
export const deleteTemplate = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.wikiTemplate.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send(); // No content
  } catch (error) {
    console.error("Error deleting wiki template:", error);
    res.status(500).json({ error: "Failed to delete wiki template" });
  }
};
