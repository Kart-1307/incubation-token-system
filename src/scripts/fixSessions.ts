import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getMealSession, formatISTTime } from '../utils/timeUtils';

const prisma = new PrismaClient();

async function fix() {
  console.log('Connecting to PostgreSQL database to fix token session values based on Indian Standard Time (IST)...');
  const tokens = await prisma.foodToken.findMany();
  console.log(`Found ${tokens.length} total food token records.`);

  let updatedCount = 0;
  for (const t of tokens) {
    const correctSession = getMealSession(t.issuedAt);
    const istTimeStr = formatISTTime(t.issuedAt);

    if (t.session !== correctSession) {
      console.log(`Updating token ${t.tokenNumber} (issued at ${istTimeStr} IST) from '${t.session}' -> '${correctSession}'`);
      await prisma.foodToken.update({
        where: { id: t.id },
        data: { session: correctSession },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} token session records!`);
  await prisma.$disconnect();
}

fix().catch(err => {
  console.error('Error fixing token sessions:', err);
  process.exit(1);
});
