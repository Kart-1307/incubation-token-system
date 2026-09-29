import { PrismaClient } from '@prisma/client';

const prisma5432 = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.ceycckzcrwllivsfgvkg:IncubationPass2026%21@aws-0-ap-south-1.pooler.supabase.com:5432/postgres' } },
  log: ['error'],
});

const prisma6543 = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.ceycckzcrwllivsfgvkg:IncubationPass2026%21@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true' } },
  log: ['error'],
});

const DEPT_MAP = {
  CSE: 'Computer Science and Engineering',
  ME: 'Mechanical Engineering',
  MECH: 'Mechanical Engineering',
  ECE: 'Electronics and Communication Engineering',
  EEE: 'Electrical and Electronics Engineering',
  CIVIL: 'Civil Engineering',
  Civil: 'Civil Engineering',
  IT: 'Information Technology (B.Tech)',
  AIDS: 'Artificial Intelligence and Data Science (B.Tech)',
  CSBS: 'Computer Science and Business Systems (B.Tech)',
};

async function main() {
  console.log('Testing Port 5432...');
  try {
    const c5432 = await prisma5432.student.count();
    console.log('✓ Port 5432 SUCCESS! Count:', c5432);
  } catch (err) {
    console.error('✗ Port 5432 failed:', err?.message || err);
  } finally {
    await prisma5432.$disconnect();
  }

  console.log('\nTesting Port 6543...');
  try {
    const c6543 = await prisma6543.student.count();
    console.log('✓ Port 6543 SUCCESS! Count:', c6543);
  } catch (err) {
    console.error('✗ Port 6543 failed:', err?.message || err);
  } finally {
    await prisma6543.$disconnect();
  }
}

main();
