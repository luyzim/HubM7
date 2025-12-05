const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const prisma = new PrismaClient();

async function createUser() {
  const email = 'noc@microset.com'; 
  const password = 'M1cr0S3t'; 

  try {
    const salt = await bcrypt.genSalt(10);
    const pass_hash = await bcrypt.hash(password, salt);

    const user = await prisma.users.upsert({
      where: { email: email },
      update: { pass_hash: pass_hash },
      create: {
        email: email,
        pass_hash: pass_hash,
      },
    });
    console.log('User created/updated successfully:', user);
    console.log('Use this password for login:', password);
  } catch (e) {
    console.error('Error creating/updating user:', e);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();