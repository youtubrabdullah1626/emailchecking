/**
 * System Health Metrics Module
 */
import packageJson from "../../../package.json";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export async function getSystemHealth() {
  const memoryUsage = process.memoryUsage();
  return {
    status: "healthy",
    uptime: formatUptime(process.uptime()),
    version: packageJson.version || "0.1.0",
    environment: process.env.NODE_ENV || "unknown",
    memoryUsageMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    responseLatencyMs: 0, // Populated at route level
    lastDeployment: new Date(Date.now() - process.uptime() * 1000).toISOString(),
  };
}
