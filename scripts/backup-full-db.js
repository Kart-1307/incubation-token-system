import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function fullBackup() {
  console.log('🔄 Starting complete snapshot of all database tables...');

  const backupData = {
    backupDate: new Date().toISOString(),
    staffUsers: await prisma.staffUser.findMany(),
    students: await prisma.student.findMany(),
    projects: await prisma.project.findMany(),
    projectMembers: await prisma.projectMember.findMany(),
    dailyFoodLists: await prisma.dailyFoodList.findMany(),
    dailyFoodEligibilities: await prisma.dailyFoodEligibility.findMany(),
    foodTokens: await prisma.foodToken.findMany(),
  };

  const backupPath = path.resolve(process.cwd(), 'prisma/backup_full_data.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log('✅ COMPLETE DATABASE BACKUP SAVED TO:', backupPath);
  console.log('📊 Table Record Counts Preserved:');
  console.log({
    staffUsers: backupData.staffUsers.length,
    students: backupData.students.length,
    projects: backupData.projects.length,
    projectMembers: backupData.projectMembers.length,
    dailyFoodLists: backupData.dailyFoodLists.length,
    dailyFoodEligibilities: backupData.dailyFoodEligibilities.length,
    foodTokens: backupData.foodTokens.length,
  });
}

fullBackup()
  .catch((err) => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
