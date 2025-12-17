import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function createCommandMkt() {
  const [name, commandText, description] = process.argv.slice(2);

  if (!name || !commandText) {
    console.error("Uso incorreto:");
    console.error('node create-commandMkt.js "name" "commandText" "description opcional"');
    process.exit(1);
  }

  try {
    const cmd = await prisma.commands_mkt.upsert({
      where: { name },
      update: {
        commandText,
        descricao: description || "Mostra as interfaces do Mikrotik",
        active: true,
      },
      create: {
        name,
        commandText,
        descricao: description || "Mostra as interfaces do Mikrotik",
      },
    });

    console.log("Comando criado/atualizado com sucesso:");
    console.log(cmd);
  } catch (error) {
    console.error("Erro ao criar comando:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}


createCommandMkt();