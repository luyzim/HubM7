import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import fs from 'fs/promises'; // Import fs.promises for async file operations

const prisma = new PrismaClient();

async function createWikiTemplate() {
  const args = process.argv.slice(2);
  let name, content, contentFile, editor = "markdown", locale = "pt-br";

  // Basic argument parsing
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--content' && args[i + 1]) {
      content = args[++i];
    } else if (args[i] === '--content-file' && args[i + 1]) {
      contentFile = args[++i];
    } else if (args[i] === '--editor' && args[i + 1]) {
      editor = args[++i];
    } else if (args[i] === '--locale' && args[i + 1]) {
      locale = args[++i];
    }
  }

  // If content is provided via file, read it
  if (contentFile) {
    try {
      content = await fs.readFile(contentFile, 'utf8');
      console.log(`Content read from ${contentFile}`);
    } catch (readError) {
      console.error(`Error reading content file ${contentFile}:`, readError.message);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (!name || !content) {
    console.error('Usage: node create-wiki-template.js --name "Template Name" (--content "Template Content" | --content-file "path/to/file.md") [--editor markdown] [--locale pt-br]');
    await prisma.$disconnect();
    process.exit(1);
  }

  try {
    const template = await prisma.wikiTemplate.upsert({
      where: { name: name },
      update: {
        content: content,
        editor: editor,
        locale: locale,
      },
      create: {
        name: name,
        content: content,
        editor: editor,
        locale: locale,
      },
    });
    console.log('Wiki template created/updated successfully:', template);
  } catch (e) {
    console.error('Error creating/updating wiki template:', e);
  } finally {
    await prisma.$disconnect();
  }
}

createWikiTemplate();
