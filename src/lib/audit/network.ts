import { NextRequest } from "next/server";
import { userAgent } from "next/server";

export interface NetworkContext {
  ipAddress?: string;
  country?: string;
  deviceInfo?: string;
  browser?: string;
  os?: string;
}

/**
 * Extracts network and device context from an incoming Next.js App Router Request.
 */
export function getNetworkContext(request: NextRequest): NetworkContext {
  // Extract IP
  // Next.js provides `request.ip` on Vercel/some edge providers. Fallback to headers.
  const ipAddress = 
    request.ip || 
    request.headers.get("x-forwarded-for")?.split(",")[0] || 
    request.headers.get("x-real-ip") || 
    undefined;

  // Extract Country
  // Next.js provides `request.geo.country` on Vercel. Fallback to headers.
  const country = 
    request.geo?.country || 
    request.headers.get("x-vercel-ip-country") || 
    request.headers.get("cf-ipcountry") || 
    undefined;

  // Extract Device info cleanly
  const { device, browser, os } = userAgent(request);
  
  // Format device info string
  let deviceInfo = "Unknown Device";
  if (device.model && device.vendor) {
    deviceInfo = `${device.vendor} ${device.model}`;
  } else if (os.name) {
    deviceInfo = `${os.name} Device`;
  }

  return {
    ipAddress,
    country,
    deviceInfo,
    browser: browser.name ? `${browser.name} ${browser.version || ""}`.trim() : undefined,
    os: os.name ? `${os.name} ${os.version || ""}`.trim() : undefined,
  };
}
