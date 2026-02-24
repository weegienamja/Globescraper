import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logSecurityEvent } from "@/lib/security";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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

        // Prevent disabled / banned / deleted users from logging in
        if (user.disabled) return null;
        if (user.status === "BANNED" || user.status === "DELETED" || user.status === "SUSPENDED") return null;
        if (user.deletedAt) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    // Block disabled / banned users signing in via OAuth
    async signIn({ user }) {
      if (user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { disabled: true, status: true, deletedAt: true },
        });
        if (dbUser?.disabled) return false;
        if (dbUser?.status === "BANNED" || dbUser?.status === "DELETED" || dbUser?.status === "SUSPENDED") return false;
        if (dbUser?.deletedAt) return false;
      }
      return true;
    },

    // Persist user id + role + profile status into the JWT
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        // Track last login + security event (fire-and-forget)
        if (user.id) {
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }).catch(() => {});
          logSecurityEvent(user.id, "login").catch(() => {});
        }
        // Check if user has a profile on initial sign-in
        const profile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: { id: true, avatarUrl: true },
        });
        token.hasProfile = !!profile;
        token.avatarUrl = profile?.avatarUrl ?? null;
      }
      // Allow manual refresh (e.g. after profile creation)
      if (trigger === "update" && token.sub) {
        const profile = await prisma.profile.findUnique({
          where: { userId: token.sub },
          select: { id: true, avatarUrl: true },
        });
        token.hasProfile = !!profile;
        token.avatarUrl = profile?.avatarUrl ?? null;
      }
      return token;
    },

    // Expose id + role + hasProfile on the client-facing session
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.role) {
        session.user.role = token.role as "USER" | "ADMIN";
      }
      session.user.hasProfile = !!token.hasProfile;
      session.user.avatarUrl = token.avatarUrl ?? null;
      return session;
    },
  },
});
