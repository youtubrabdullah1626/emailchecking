import { PrismaClient } from "@prisma/client";
import { getEnv } from "@/lib/env";

// Ensure environment is valid on startup before any DB connection is made
getEnv();

// Prevent multiple Prisma client instances during Next.js hot-reload in development.
// In production, always create a single instance.
//
// See: https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export default prisma;
