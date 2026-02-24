import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

  callbacks: {
    // Persist user id + role + profile status into the JWT
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        // Track last login
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {}); // fire-and-forget
        // Check if user has a profile on initial sign-in
        const profile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        token.hasProfile = !!profile;
      }
      // Allow manual refresh (e.g. after profile creation)
      if (trigger === "update" && token.sub) {
        const profile = await prisma.profile.findUnique({
          where: { userId: token.sub },
          select: { id: true },
        });
        token.hasProfile = !!profile;
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
      return session;
    },
  },
});
