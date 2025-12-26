import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function createUser() {
  const email = 'toninho@microset.com'; 
  const password = 'M1cr0S3t'; 
  const name = 'Toninho';

  try {
    const salt = await bcrypt.genSalt(10);
    const pass_hash = await bcrypt.hash(password, salt);

    const user = await prisma.n2.upsert({
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