import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export interface LockableModule {
  key: string;
  name: string;
  path: string;
  description: string;
  defaultLocked: boolean;
}

export const LOCKABLE_MODULES: LockableModule[] = [
  {
    key: "PAGE_LOCK_SEQUENCES",
    name: "Sequences Module",
    path: "/sequences",
    description: "Lock sequence management and campaign builders for regular users.",
    defaultLocked: false,
  },
  {
    key: "PAGE_LOCK_SMART_IMPORT",
    name: "Smart Lead Import",
    path: "/smart-import",
    description: "Lock CSV/Excel spreadsheet upload and mapping tools.",
    defaultLocked: false,
  },
  {
    key: "PAGE_LOCK_PROSPECTS",
    name: "Prospects Directory",
    path: "/prospects",
    description: "Lock direct prospect view, editing, and ad-hoc composer.",
    defaultLocked: false,
  },
  {
    key: "PAGE_LOCK_TIMELINE",
    name: "Timeline Inspector",
    path: "/timeline-inspector",
    description: "Lock visual campaign timeline and live scheduling visualizer.",
    defaultLocked: false,
  },
  {
    key: "PAGE_LOCK_REPLIES",
    name: "Replies Inbox",
    path: "/replies",
    description: "Lock prospect reply inbox and AI intent categorization.",
    defaultLocked: false,
  },
  {
    key: "PAGE_LOCK_ANALYTICS",
    name: "Analytics & Reports",
    path: "/analytics",
    description: "Lock platform analytics and delivery metric charts.",
    defaultLocked: false,
  },
];

const SUPREME_OWNER_EMAIL = "youtubrabdullah1626@gmail.com";

/**
 * Ensures all page lock flags exist in the database with proper defaults.
 */
export async function ensurePageLockFlags(): Promise<void> {
  try {
    for (const mod of LOCKABLE_MODULES) {
      await prisma.feature_flags.upsert({
        where: { key: mod.key },
        create: {
          key: mod.key,
          name: mod.name,
          description: mod.description,
          category: "SECURITY",
          enabled: mod.defaultLocked, // enabled = true means LOCKED
          risk_level: "WARNING",
          is_safe_runtime: true,
          requires_reason: false,
          rollout_strategy: "GLOBAL",
          depends_on: [],
          environment: "production",
        },
        update: {
          name: mod.name,
          description: mod.description,
          category: "SECURITY",
        },
      });
    }
  } catch (err) {
    console.error("[PageLock] Failed to ensure page lock flags:", err);
  }
}

/**
 * Checks if a specific page/module is locked for the current request.
 * Admins and Supreme Owner always bypass locks.
 */
export async function evaluatePageAccess(flagKey: string): Promise<{
  isLocked: boolean;
  isAdmin: boolean;
  moduleName: string;
}> {
  const mod = LOCKABLE_MODULES.find((m) => m.key === flagKey);
  const moduleName = mod ? mod.name : "Module";

  try {
    const session = await getSession();
    const user = session?.user;

    const isAdmin =
      user?.email === SUPREME_OWNER_EMAIL ||
      user?.role === "SUPER_ADMIN" ||
      user?.role === "ADMIN";

    // Query the lock flag from DB
    const flag = await prisma.feature_flags.findUnique({
      where: { key: flagKey },
      select: { enabled: true },
    });

    const isLocked = flag ? flag.enabled : false;

    return {
      isLocked,
      isAdmin,
      moduleName,
    };
  } catch (err) {
    console.error(`[PageLock] Error checking access for '${flagKey}':`, err);
    return {
      isLocked: false,
      isAdmin: false,
      moduleName,
    };
  }
}
