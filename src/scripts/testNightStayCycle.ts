import { prisma } from '../lib/db';
import { verifyStudentScan, issueFoodToken, resetTestTokens } from '../actions/tokenActions';

async function runNightStaySimulation() {
  console.log('\n============================================================');
  console.log('🧪 OPTION A: NIGHT-STAY 3-MEAL CYCLE SIMULATION TEST');
  console.log('============================================================\n');

  const dayD = '2026-09-29';
  const dayDPlus1 = '2026-09-30';

  // 1. Pick or ensure student exists
  let student = await prisma.student.findFirst({ where: { status: 'Active' } });
  if (!student) {
    student = await prisma.student.create({
      data: {
        id: 'SEC24TEST01',
        name: 'Test Student NightStay',
        department: 'Computer Science and Engineering',
        year: 3,
        email: 'test.nightstay@sairam.edu.in',
        status: 'Active',
      },
    });
  }

  const studentId = student.id;
  console.log(`👤 Testing with Student: ${student.name} (${studentId})`);

  // 2. Clear any old test tokens for these 2 dates
  await resetTestTokens(dayD, studentId);
  await resetTestTokens(dayDPlus1, studentId);

  const project = await prisma.project.findFirst();
  if (!project) {
    await prisma.project.create({
      data: {
        code: 'PRJ-NIGHT',
        name: 'Autonomous Systems & Drone Incubation',
        status: 'Active',
      },
    });
  }
  const validProjectCode = project ? project.code : 'PRJ-NIGHT';

  // 3. Ensure student is eligible on Day D (Night-stay list)
  await prisma.dailyFoodEligibility.upsert({
    where: { date_studentId: { date: dayD, studentId } },
    update: { status: 'Eligible', projectCode: validProjectCode },
    create: {
      date: dayD,
      studentId,
      projectCode: validProjectCode,
      status: 'Eligible',
      addedBy: 'Test Runner',
    },
  });

  // Ensure student is NOT on Day D+1 list (to test automatic fallback)
  await prisma.dailyFoodEligibility.deleteMany({
    where: { date: dayDPlus1, studentId },
  });

  let passCount = 0;
  let totalTests = 5;

  // TEST 1: Day D Dinner
  console.log(`\n▶ [TEST 1/5] Day D (${dayD}) DINNER Session:`);
  const t1 = await issueFoodToken(studentId, undefined, dayD, 'DINNER');
  if (t1.success && t1.token?.session === 'DINNER') {
    console.log(`   ✅ PASS: Dinner token issued successfully (${t1.token.tokenNumber})`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL: Dinner token failed:`, t1.message);
  }

  // TEST 2: Day D+1 Breakfast (Fallback to Day D Night Stay List)
  console.log(`\n▶ [TEST 2/5] Day D+1 (${dayDPlus1}) BREAKFAST Session (No 30 Sep list):`);
  const t2 = await issueFoodToken(studentId, undefined, dayDPlus1, 'BREAKFAST');
  if (t2.success && t2.token?.session === 'BREAKFAST') {
    console.log(`   ✅ PASS: Breakfast token issued via Option A Night-Stay fallback! (${t2.token.tokenNumber})`);
    console.log(`      Message: "${t2.message}"`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL: Breakfast token failed:`, t2.message);
  }

  // TEST 3: Duplicate Breakfast on Day D+1
  console.log(`\n▶ [TEST 3/5] Day D+1 (${dayDPlus1}) REPEAT BREAKFAST Scan (Duplicate Check):`);
  const t3 = await issueFoodToken(studentId, undefined, dayDPlus1, 'BREAKFAST');
  if (!t3.success && t3.isDuplicate) {
    console.log(`   ✅ PASS: Duplicate breakfast blocked as expected!`);
    console.log(`      Message: "${t3.message}"`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL: Duplicate was not blocked!`);
  }

  // TEST 4: Day D+1 Lunch (Fallback to Day D Night Stay List)
  console.log(`\n▶ [TEST 4/5] Day D+1 (${dayDPlus1}) LUNCH Session (No 30 Sep list):`);
  const t4 = await issueFoodToken(studentId, undefined, dayDPlus1, 'LUNCH');
  if (t4.success && t4.token?.session === 'LUNCH') {
    console.log(`   ✅ PASS: Lunch token issued via Option A Night-Stay fallback! (${t4.token.tokenNumber})`);
    console.log(`      Message: "${t4.message}"`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL: Lunch token failed:`, t4.message);
  }

  // TEST 5: Day D+1 Dinner (Strict Requirement for New List)
  console.log(`\n▶ [TEST 5/5] Day D+1 (${dayDPlus1}) DINNER Session (Strict Check):`);
  const t5 = await issueFoodToken(studentId, undefined, dayDPlus1, 'DINNER');
  if (!t5.success && t5.isEligible === false) {
    console.log(`   ✅ PASS: Tomorrow's Dinner correctly rejected because new list is required!`);
    console.log(`      Message: "${t5.message}"`);
    passCount++;
  } else {
    console.log(`   ❌ FAIL: Tomorrow's dinner should have been rejected!`, t5);
  }

  console.log('\n============================================================');
  console.log(`🏁 SIMULATION SUMMARY: ${passCount}/${totalTests} TESTS PASSED`);
  console.log('============================================================\n');

  // Clean up test tokens
  await resetTestTokens(dayD, studentId);
  await resetTestTokens(dayDPlus1, studentId);

  process.exit(passCount === totalTests ? 0 : 1);
}

runNightStaySimulation().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
