// Seeds one community, two users and a few items for local development.
// Safe to re-run: it upserts the fixed rows and recreates the seed items.
// Run with: npm run db:seed
import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma";

const db = createPrismaClient();

const COMMUNITY = {
  slug: "fenway-neighbors",
  name: "Fenway Neighbors",
  description: "Borrow and lend with people around the Fenway.",
};

const USERS = [
  { email: "alice@example.com", name: "Alice Lender", role: "ADMIN" as const },
  { email: "bob@example.com", name: "Bob Borrower", role: "MEMBER" as const },
];

async function main() {
  const community = await db.community.upsert({
    where: { slug: COMMUNITY.slug },
    update: {},
    create: COMMUNITY,
  });

  const [alice, bob] = await Promise.all(
    USERS.map(async ({ email, name, role }) => {
      const user = await db.user.upsert({ where: { email }, update: { name }, create: { email, name } });
      await db.membership.upsert({
        where: { userId_communityId: { userId: user.id, communityId: community.id } },
        update: { role },
        create: { userId: user.id, communityId: community.id, role },
      });
      return user;
    }),
  );

  // Recreate seed items so re-running doesn't pile up duplicates.
  await db.item.deleteMany({ where: { ownerId: { in: [alice.id, bob.id] } } });

  const items = [
    {
      ownerId: alice.id,
      title: "Cordless drill",
      description: "18V DeWalt drill with two batteries and a bit set.",
      category: "TOOLS" as const,
      condition: "GOOD" as const,
    },
    {
      ownerId: alice.id,
      title: "4-person camping tent",
      description: "Easy pop-up tent, fits four. Comes with stakes and rain fly.",
      category: "OUTDOOR" as const,
      condition: "LIKE_NEW" as const,
    },
    {
      ownerId: alice.id,
      title: "Stand mixer",
      description: "KitchenAid 5qt mixer with whisk, paddle and dough hook.",
      category: "KITCHEN" as const,
      condition: "GOOD" as const,
    },
    {
      ownerId: bob.id,
      title: "Portable projector",
      description: "1080p mini projector with HDMI. Great for movie nights.",
      category: "ELECTRONICS" as const,
      condition: "FAIR" as const,
    },
  ];

  for (const item of items) {
    await db.item.create({
      data: { ...item, communityId: community.id, status: "PUBLISHED" },
    });
  }

  // One blocked date range so availability (US-3) has something to show.
  const drill = await db.item.findFirstOrThrow({ where: { ownerId: alice.id, title: "Cordless drill" } });
  await db.availability.create({
    data: {
      itemId: drill.id,
      startDate: new Date("2026-12-24"),
      endDate: new Date("2026-12-27"),
      note: "Away for the holidays",
    },
  });

  console.log(`Seeded "${community.name}" with ${USERS.length} users and ${items.length} items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
