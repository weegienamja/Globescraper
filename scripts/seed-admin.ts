/**
 * Seed an admin user into the database.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts <email> <password>
 *
 * Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.
 *
 * Requires DATABASE_URL to be set (reads .env automatically via Prisma).
 */

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

async function main() {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/seed-admin.ts <email> <password>\n" +
        "  Or set ADMIN_EMAIL and ADMIN_PASSWORD env vars."
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const hashed = await argon2.hash(password);

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hashed, role: "ADMIN" },
      create: {
        email,
        name: "Admin",
        passwordHash: hashed,
        role: "ADMIN",
      },
    });

    console.log(`✓ Admin user ready: ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
