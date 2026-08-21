import { NextResponse } from "next/server";
import { emailTrackingService } from "@/lib/tracking/EmailTrackingService";

// A 1x1 transparent GIF in Base64
const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BUFFER = Buffer.from(PIXEL_BASE64, "base64");

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await Promise.resolve(params);
  const rawId = resolvedParams?.id || "";
  const trackingId = rawId.replace(/\.(gif|png|jpg|jpeg)$/i, "").trim();

  // Extract IP and User Agent for future analytics (e.g. detecting Apple Mail Privacy Protection)
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  if (trackingId) {
    try {
      await emailTrackingService.ingestEvent(trackingId, "OPENED", undefined, { ip, userAgent });
    } catch (err) {
      console.error("[EmailTrackingService] Failed to ingest OPENED event:", err);
    }
  }

  return new NextResponse(PIXEL_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Content-Length": PIXEL_BUFFER.length.toString(),
    },
  });
}

export async function HEAD(req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  return GET(req, { params });
}

