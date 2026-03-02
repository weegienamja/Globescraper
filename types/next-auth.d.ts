import { type DefaultSession } from "next-auth";
import { type JWT as DefaultJWT } from "next-auth/jwt";

export type AppRole = "USER" | "ADMIN" | "TEACHER" | "STUDENT" | "RECRUITER";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    username?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: AppRole;
      username: string | null;
      hasProfile: boolean;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: AppRole;
    username?: string | null;
    hasProfile?: boolean;
    avatarUrl?: string | null;
  }
}
