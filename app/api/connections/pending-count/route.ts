import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }

  const userId = session.user.id;

  // Count pending requests where *someone else* requested to connect with me
  const count = await prisma.connection.count({
    where: {
      status: "PENDING",
      requestedByUserId: { not: userId },
      OR: [{ userLowId: userId }, { userHighId: userId }],
    },
  });

  return NextResponse.json({ count });
}
