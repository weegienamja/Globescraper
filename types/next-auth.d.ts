import { type DefaultSession } from "next-auth";
import { type JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: "USER" | "ADMIN";
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      hasProfile: boolean;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: "USER" | "ADMIN";
    hasProfile?: boolean;
    avatarUrl?: string | null;
  }
}
