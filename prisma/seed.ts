import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fictional demo stores at approximate Johannesburg coordinates.
// These are NOT real store locations.
export const DEMO_STORES = [
  { id: "demo-braamfontein", name: "Demo Store · Braamfontein", lat: -26.1929, lng: 28.0305, radiusMeters: 100, nfcTagSecret: "braam-tag-secret" },
  { id: "demo-rosebank", name: "Demo Store · Rosebank", lat: -26.1458, lng: 28.0416, radiusMeters: 100, nfcTagSecret: "rosebank-tag-secret" },
  { id: "demo-sandton", name: "Demo Store · Sandton", lat: -26.1076, lng: 28.0567, radiusMeters: 100, nfcTagSecret: "sandton-tag-secret" },
];

async function main() {
  for (const s of DEMO_STORES) {
    await prisma.store.upsert({ where: { id: s.id }, update: s, create: s });
  }
  console.log(`Seeded ${DEMO_STORES.length} demo stores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
