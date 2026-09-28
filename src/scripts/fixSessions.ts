import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  console.log('Connecting to PostgreSQL database to fix token session values...');
  const tokens = await prisma.foodToken.findMany();
  console.log(`Found ${tokens.length} total food token records.`);

  let updatedCount = 0;
  for (const t of tokens) {
    const issuedDate = new Date(t.issuedAt);
    const hour = issuedDate.getHours();
    const correctSession = hour < 12 ? 'BREAKFAST' : hour < 17 ? 'LUNCH' : 'DINNER';

    if (t.session !== correctSession) {
      console.log(`Updating token ${t.tokenNumber} (issued at ${issuedDate.toLocaleTimeString()}) from '${t.session}' -> '${correctSession}'`);
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
