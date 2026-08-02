import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let settings = await (prisma as any).systemSettings.findUnique({
      where: { id: "global" }
    });

    if (!settings) {
      settings = await (prisma as any).systemSettings.create({
        data: { id: "global" }
      });
    }

    return NextResponse.json({
      schedulerEnabled: settings.scheduler_enabled,
      schedulerCron: settings.scheduler_cron,
      geminiEnabled: settings.gemini_enabled,
      geminiModel: settings.gemini_model,
      notificationsEnabled: settings.notifications_global,
      notifyOnReply: settings.notify_on_reply,
      notifyOnFailure: settings.notify_on_failure,
      retryFailedEmails: settings.retry_failed_emails,
      maxRetries: settings.max_retries,
      autoCloserEnabled: settings.auto_closer_enabled,
      autoCloserRebuttalStyle: settings.auto_closer_rebuttal_style,
      autoCloserAutoDraft: settings.auto_closer_auto_draft,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const settings = await (prisma as any).systemSettings.upsert({
      where: { id: "global" },
      update: {
        scheduler_enabled: body.schedulerEnabled,
        scheduler_cron: body.schedulerCron,
        gemini_enabled: body.geminiEnabled,
        gemini_model: body.geminiModel,
        notifications_global: body.notificationsEnabled,
        notify_on_reply: body.notifyOnReply,
        notify_on_failure: body.notifyOnFailure,
        retry_failed_emails: body.retryFailedEmails,
        max_retries: body.maxRetries,
        auto_closer_enabled: body.autoCloserEnabled,
        auto_closer_rebuttal_style: body.autoCloserRebuttalStyle,
        auto_closer_auto_draft: body.autoCloserAutoDraft,
      },
      create: {
        id: "global",
        scheduler_enabled: body.schedulerEnabled,
        scheduler_cron: body.schedulerCron,
        gemini_enabled: body.geminiEnabled,
        gemini_model: body.geminiModel,
        notifications_global: body.notificationsEnabled,
        notify_on_reply: body.notifyOnReply,
        notify_on_failure: body.notifyOnFailure,
        retry_failed_emails: body.retryFailedEmails,
        max_retries: body.maxRetries,
        auto_closer_enabled: body.autoCloserEnabled,
        auto_closer_rebuttal_style: body.autoCloserRebuttalStyle,
        auto_closer_auto_draft: body.autoCloserAutoDraft,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
