/**
 * NextAuth TypeScript Type Augmentation
 *
 * Extends the default NextAuth Session and JWT types to include
 * our custom fields (id, role, isSuspended) without any type errors.
 */

import { DefaultSession } from "next-auth";

export type UserRole = "USER" | "HELPER" | "ADMIN_VIEWER" | "ADMIN" | "OWNER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      isSuspended: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    isSuspended?: boolean;
  }
}
