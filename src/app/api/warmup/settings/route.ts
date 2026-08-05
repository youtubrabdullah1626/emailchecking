import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    enabled: true,
    dailyLimit: 50,
    rampUpPerDay: 5,
    replyRate: 30
  });
}
