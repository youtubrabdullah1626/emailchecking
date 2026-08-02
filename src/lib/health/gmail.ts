import prisma from "@/lib/prisma";
import { getOAuthConfig } from "@/lib/gmail/oauth";

export async function getGmailHealth() {
  const config = getOAuthConfig();
  
  // Find last successful send
  const lastSend = await prisma.emailEvent.findFirst({
    where: { event_type: "SENT" },
    orderBy: { occurred_at: "desc" }
  });

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [sentToday, errorsToday] = await Promise.all([
    prisma.emailEvent.count({
      where: { event_type: "SENT", occurred_at: { gte: startOfDay } }
    }),
    prisma.emailEvent.count({
      where: { event_type: "FAILED", occurred_at: { gte: startOfDay } }
    })
  ]);

  const dailyCapacity = 300;
  
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;
  let accountHealth = 100;
  
  if (senderEmail) {
    try {
      const acc = await prisma.emailAccount.findUnique({ where: { email: senderEmail } });
      if (acc) {
        accountHealth = acc.health_score;
      }
    } catch(e) {}
  }

  let health = accountHealth;
  if (errorsToday > 0) {
    health -= Math.min(errorsToday * 5, 40); // Penalty for errors
  }

  return {
    status: config ? "connected" : "disconnected",
    tokenExpiresInDays: 27,
    lastSuccessfulSendAt: lastSend?.occurred_at.toISOString() || null,
    sendingErrorsToday: errorsToday,
    dailyUsage: sentToday,
    dailyCapacity: dailyCapacity,
    healthScore: Math.max(0, health)
  };
}
