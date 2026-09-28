import { initDatabase, dbSeedMockJobs } from '../database';

export interface SeedDataResult {
  renovateCount: number;
  quickCount: number;
  totalCount: number;
}

export async function seed40MockOrders(): Promise<SeedDataResult> {
  console.log('[SEED-40] Initializing database connection...');
  await initDatabase();
  console.log('[SEED-40] Seeding 40 mock orders (20 Renovate with BOQ & Gantt Tasks + 20 Quick with QC photos)...');
  const count = await dbSeedMockJobs();

  return {
    renovateCount: 20,
    quickCount: 20,
    totalCount: count
  };
}

// Execute if run directly from CLI
if (require.main === module) {
  seed40MockOrders()
    .then((res) => {
      console.log(`[DONE] ${res.totalCount} orders seeded successfully (${res.renovateCount} R + ${res.quickCount} Q).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
