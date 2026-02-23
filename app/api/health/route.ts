import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    env: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasBasicAuthUser: Boolean(process.env.BASIC_AUTH_USER),
      hasBasicAuthPass: Boolean(process.env.BASIC_AUTH_PASS),
      hasBasicAuthCombined: Boolean(process.env.BASIC_AUTH),
    },
  });
}
