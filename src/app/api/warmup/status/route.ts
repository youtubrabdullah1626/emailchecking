import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "COMPLETED",
    currentVolume: 50,
    targetVolume: 50,
    healthScore: 100,
    startedAt: new Date().toISOString()
  });
}
