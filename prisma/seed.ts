import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial institutional data...');

  // 1. Create Default Staff User
  const passwordHash = await bcrypt.hash('Sairam@123', 10);
  await prisma.staffUser.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      email: 'incubation@sairam.edu.in',
      name: 'Incubation Centre Staff',
      passwordHash,
    },
  });

  // 2. Seed Mentors (Faculty / Industry Mentors)
  const mentors = [
    { id: 'b109a501-0000-4000-8000-000000000001', name: 'Biogas Plant Mentor', department: 'ECE / Incubation', designation: 'Faculty Mentor' },
    { id: 'b109a501-0000-4000-8000-000000000002', name: 'Dr. Ramesh S', department: 'Computer Science and Engineering', designation: 'Professor & Mentor' },
  ];

  for (const m of mentors) {
    await prisma.mentor.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    });
  }

  console.log('Seeding completed successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
