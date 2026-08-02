import { NextResponse } from "next/server";
import { emailTrackingService } from "@/lib/tracking/EmailTrackingService";

// A 1x1 transparent GIF in Base64
const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BUFFER = Buffer.from(PIXEL_BASE64, "base64");

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const trackingId = params.id;

  // Extract IP and User Agent for future analytics (e.g. detecting Apple Mail Privacy Protection)
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  // Await the ingestion to ensure execution completes in Serverless environments
  try {
    await emailTrackingService.ingestEvent(trackingId, "OPENED", undefined, { ip, userAgent });
  } catch (err) {
    console.error("[EmailTrackingService] Failed to ingest OPENED event:", err);
  }

  return new NextResponse(PIXEL_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Content-Length": PIXEL_BUFFER.length.toString(),
    },
  });
}
