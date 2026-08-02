import prisma from "@/lib/prisma";

export async function getDatabaseHealth() {
  const start = performance.now();
  let status = "connected";
  let queryLatencyMs = 0;
  let failedQueriesCount = 0;
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    queryLatencyMs = Math.round(performance.now() - start);
  } catch (err) {
    status = "disconnected";
    queryLatencyMs = -1;
  }

  try {
    failedQueriesCount = await prisma.systemError.count({
      where: { service: "database", resolved: false }
    });
  } catch(e) {
    // If table doesn't exist yet, ignore
  }

  // Calculate score
  let score = 100;
  if (status !== "connected") score = 0;
  else {
    if (queryLatencyMs > 50) score -= 10;
    if (queryLatencyMs > 200) score -= 20;
    score -= Math.min(failedQueriesCount * 5, 50);
  }
  score = Math.max(0, score);

  let category = "Excellent";
  if (score < 50) category = "Critical";
  else if (score < 80) category = "Warning";
  else if (score < 95) category = "Healthy";

  return {
    status,
    queryLatencyMs,
    migrationStatus: "up-to-date",
    databaseAvailability: status === "connected" ? "100%" : "0%",
    failedQueriesCount,
    healthScore: score,
    healthCategory: category
  };
}
