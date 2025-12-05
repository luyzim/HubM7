const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const prisma = new PrismaClient();

async function createMonitoramento() {
  const email = 'monitoramento@microset.com'; //email for different users
  const password = '123456'; // *** PASSWORD ***
  const name = "Diego"; // Name for the monitoramento user

  try {
    const salt = await bcrypt.genSalt(10);
    const pass_hash = await bcrypt.hash(password, salt);

    const user = await prisma.monitoramento.upsert({
      where: { email: email },
      update: { pass_hash: pass_hash,
                name: name
       },
      create: {
        email: email,
        name: name,
        pass_hash: pass_hash
      },
    });
    console.log('Monitoring User created/updated successfully:', user);
    console.log('Monitoring User created/updated successfully:', name);
    console.log('Use this password for login:', password);
  } catch (e) {
    console.error('Error creating/updating user:', e);
  } finally {
    await prisma.$disconnect();
  }
}

createMonitoramento();