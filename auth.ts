import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { encode as defaultEncode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const adapter = PrismaAdapter(prisma);

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  // ── Bridge Credentials → database sessions ──────────────────
  // The Credentials provider doesn't natively create database
  // sessions, so we intercept jwt.encode to create one manually.
  jwt: {
    encode: async function (params) {
      // When the jwt callback flags a credentials sign-in,
      // create a real database session instead of a JWT.
      if (params.token?.credentials) {
        const sessionToken = randomUUID();

        if (params.token.sub && adapter.createSession) {
          await adapter.createSession({
            sessionToken,
            userId: params.token.sub,
            expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
          });
          return sessionToken;
        }
        // Should not happen — fail the sign-in cleanly
        return "";
      }

      // Default encoding for any other provider
      return defaultEncode(params);
    },
  },

  callbacks: {
    // Mark credentials sign-ins so jwt.encode can intercept them
    jwt({ token, user }) {
      if (user) {
        token.credentials = true;
      }
      return token;
    },

    // Attach role + id to the session (database strategy provides `user`)
    session({ session, user }) {
      if (user) {
        session.user.id = user.id;
        session.user.role = (user as unknown as { role: "USER" | "ADMIN" }).role;
      }
      return session;
    },
  },
});
