// Seeds one community, two users and a few items for local development.
// Safe to re-run: it only creates or updates its own rows and never deletes,
// so other communities' items and any borrow requests or loans are untouched.
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

  // Item has no natural unique key, so match a seed item by
  // (community, owner, title), scoped to the seeded community only.
  const seeded = [];
  for (const { ownerId, title, ...fields } of items) {
    const existing = await db.item.findFirst({
      where: { communityId: community.id, ownerId, title },
      select: { id: true },
    });
    const data = { ...fields, status: "PUBLISHED" as const };
    seeded.push(
      existing
        ? await db.item.update({ where: { id: existing.id }, data })
        : await db.item.create({ data: { ...data, ownerId, title, communityId: community.id } }),
    );
  }

  // One blocked date range so availability (US-3) has something to show.
  const drill = seeded.find((item) => item.title === "Cordless drill")!;
  const blocked = {
    itemId: drill.id,
    startDate: new Date("2026-12-24"),
    endDate: new Date("2026-12-27"),
  };
  if (!(await db.availability.findFirst({ where: blocked }))) {
    await db.availability.create({ data: { ...blocked, note: "Away for the holidays" } });
  }

  console.log(`Seeded "${community.name}" with ${USERS.length} users and ${items.length} items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
