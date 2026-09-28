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

  // 2. Seed Projects
  const projects = [
    { code: 'AGRI-01', name: 'AgriCheck', description: 'AI-powered crop disease detection system.' },
    { code: 'SMRT-02', name: 'Smart Campus', description: 'IoT-based campus resource management.' },
    { code: 'HLTH-03', name: 'HealthTrack', description: 'Student health monitoring system.' },
    { code: 'ECO-04', name: 'EcoMonitor', description: 'Environmental sensor network.' },
  ];

  for (const p of projects) {
    await prisma.project.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // 3. Seed Students
  const students = [
    { id: '23CS101', name: 'Siddharth V', department: 'CSE', year: 3, email: 'siddharth@college.edu' },
    { id: '23CS102', name: 'Fayas K', department: 'CSE', year: 3, email: 'fayas@college.edu' },
    { id: '23CS103', name: 'Nirmal E', department: 'CSE', year: 3, email: 'nirmal@college.edu' },
    { id: '23CS104', name: 'Arun Kumar', department: 'CSE', year: 3, email: 'arun@college.edu' },
    { id: '23CS105', name: 'Priya S', department: 'CSE', year: 3, email: 'priya@college.edu' },
    { id: '23ME101', name: 'Rahul M', department: 'ME', year: 2, email: 'rahul@college.edu' },
    { id: '23EC101', name: 'Kavya R', department: 'ECE', year: 2, email: 'kavya@college.edu' },
  ];

  for (const s of students) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {},
      create: s,
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
