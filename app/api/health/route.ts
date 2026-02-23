import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    env: {
      hasPort: Boolean(process.env.PORT),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    },
  });
}
