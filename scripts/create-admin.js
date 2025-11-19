const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@example.com'; // You can change this email
  const password = 'new_admin_password'; // *** CHANGE THIS PASSWORD ***

  try {
    const salt = await bcrypt.genSalt(10);
    const pass_hash = await bcrypt.hash(password, salt);

    const admin = await prisma.admins.upsert({
      where: { email: email },
      update: { pass_hash: pass_hash },
      create: {
        email: email,
        pass_hash: pass_hash,
      },
    });
    console.log('Admin created/updated successfully:', admin);
    console.log('Use this password for login:', password);
  } catch (e) {
    console.error('Error creating/updating admin:', e);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();