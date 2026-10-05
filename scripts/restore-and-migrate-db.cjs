const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Data Restoration & Migration ---');
  
  const backupPath = path.join(__dirname, '..', 'prisma', 'backup_full_data.json');
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found at: ' + backupPath);
  }

  const rawData = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(rawData);

  // 1. Ensure Staff User
  for (const staff of backup.staffUsers) {
    await prisma.staffUser.upsert({
      where: { id: staff.id },
      update: {
        username: staff.username,
        email: staff.email,
        passwordHash: staff.passwordHash,
        name: staff.name,
      },
      create: {
        id: staff.id,
        username: staff.username,
        email: staff.email,
        passwordHash: staff.passwordHash,
        name: staff.name,
        createdAt: new Date(staff.createdAt),
        updatedAt: new Date(staff.updatedAt),
      },
    });
    console.log(`✓ Staff user verified: ${staff.name} (${staff.username})`);
  }

  // 2. Create Mentor from existing SP_01 "Biogas plant"
  const biogasMentorId = 'b109a501-0000-4000-8000-000000000001';
  const biogasMentor = await prisma.mentor.upsert({
    where: { id: biogasMentorId },
    update: {
      name: 'Biogas Plant Mentor',
      department: 'ECE / Incubation',
      designation: 'Faculty Mentor',
      status: 'Active',
    },
    create: {
      id: biogasMentorId,
      name: 'Biogas Plant Mentor',
      department: 'ECE / Incubation',
      designation: 'Faculty Mentor',
      status: 'Active',
    },
  });
  console.log(`✓ Mentor created/verified: ${biogasMentor.name} (ID: ${biogasMentor.id})`);

  // 3. Restore Students & Interns
  for (const stu of backup.students) {
    const isIntern = stu.id.startsWith('INT-') || stu.courseType === 'Intern';
    const mentorId = (stu.id === 'SECP24ES01' || stu.id === 'SECP24ES02') ? biogasMentorId : null;
    const category = isIntern ? 'Intern' : 'Student';
    const startupName = isIntern ? (stu.department || 'SkyRobotics') : null;

    await prisma.student.upsert({
      where: { id: stu.id },
      update: {
        name: stu.name,
        category: category,
        startupName: startupName,
        department: stu.department,
        courseType: stu.courseType,
        year: stu.year,
        email: stu.email,
        phone: stu.phone,
        status: stu.status,
        mentorId: mentorId,
      },
      create: {
        id: stu.id,
        name: stu.name,
        category: category,
        startupName: startupName,
        department: stu.department,
        courseType: stu.courseType,
        year: stu.year,
        email: stu.email,
        phone: stu.phone,
        status: stu.status,
        mentorId: mentorId,
        createdAt: new Date(stu.createdAt),
        updatedAt: new Date(stu.updatedAt),
      },
    });
    console.log(`✓ Member restored: [${category}] ${stu.name} (${stu.id}) -> Mentor: ${mentorId ? biogasMentor.name : 'None'}`);
  }

  // 4. Restore Daily Food Lists
  for (const list of backup.dailyFoodLists) {
    await prisma.dailyFoodList.upsert({
      where: { date: list.date },
      update: {
        status: list.status,
        finalizedBy: list.finalizedBy,
        finalizedAt: list.finalizedAt ? new Date(list.finalizedAt) : null,
      },
      create: {
        date: list.date,
        status: list.status,
        finalizedBy: list.finalizedBy,
        finalizedAt: list.finalizedAt ? new Date(list.finalizedAt) : null,
        createdById: list.createdById,
        createdAt: new Date(list.createdAt),
        updatedAt: new Date(list.updatedAt),
      },
    });
    console.log(`✓ Daily food list verified for date: ${list.date}`);
  }

  // 5. Restore Daily Food Eligibilities
  for (const elig of backup.dailyFoodEligibilities) {
    await prisma.dailyFoodEligibility.upsert({
      where: {
        date_studentId: {
          date: elig.date,
          studentId: elig.studentId,
        },
      },
      update: {
        mentorId: biogasMentorId,
        addedBy: elig.addedBy,
        status: elig.status,
      },
      create: {
        id: elig.id,
        date: elig.date,
        studentId: elig.studentId,
        mentorId: biogasMentorId,
        addedBy: elig.addedBy,
        status: elig.status,
        createdAt: new Date(elig.createdAt),
      },
    });
    console.log(`✓ Eligibility restored: Date ${elig.date} - Student ${elig.studentId}`);
  }

  console.log('--- Migration & Restoration Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
