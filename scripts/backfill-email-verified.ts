import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Backfill Google OAuth users (verified by Google)
  const googleAccounts = await prisma.account.findMany({
    where: { provider: "google" },
    select: { userId: true },
  });
  const googleUserIds = googleAccounts.map((a) => a.userId);
  console.log("Google users found:", googleUserIds.length);

  const r1 = await prisma.user.updateMany({
    where: { id: { in: googleUserIds }, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  console.log("Updated emailVerified for", r1.count, "Google users");

  // 2. Backfill opted-in users who still have null emailVerified
  //    (credentials users the admin has opted in)
  const r2 = await prisma.user.updateMany({
    where: {
      status: "ACTIVE",
      emailMarketingOptIn: true,
      emailUnsubscribed: false,
      emailVerified: null,
    },
    data: { emailVerified: new Date() },
  });
  console.log("Updated emailVerified for", r2.count, "opted-in credentials users");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
