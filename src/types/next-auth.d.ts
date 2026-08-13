/**
 * NextAuth TypeScript Type Augmentation
 *
 * Extends the default NextAuth Session and JWT types to include
 * our custom fields (id, role, isSuspended) without any type errors.
 */

import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isSuspended: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    isSuspended?: boolean;
  }
}
