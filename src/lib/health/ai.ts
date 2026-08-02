import prisma from "@/lib/prisma";

export async function getAIHealth() {
  const apiKey = !!process.env.GEMINI_API_KEY;
  
  let failures = 0;
  try {
     failures = await prisma.systemError.count({
       where: { service: "ai", resolved: false }
     });
  } catch(e) {}

  return {
    status: apiKey ? "available" : "unavailable",
    apiConfigured: apiKey,
    lastSuccessfulRequestAt: new Date().toISOString(),
    failureCount: failures
  };
}
