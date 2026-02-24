import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "USER" | "ADMIN";
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }
}
