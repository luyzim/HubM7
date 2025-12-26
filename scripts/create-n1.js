import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function createUser() {
  const email = 'diogo@microset.com'; 
  const password = 'NocUsersN1@'; 
  const name = 'Diogo';

  try {
    const salt = await bcrypt.genSalt(10);
    const pass_hash = await bcrypt.hash(password, salt);

    const user = await prisma.n1.upsert({
      where: { email: email },
      update: { pass_hash: pass_hash, name: name },
      create: {
        email: email,
        pass_hash: pass_hash,
        name: name,
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