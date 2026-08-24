import crypto from "crypto";

const REPORT_SECRET = process.env.REPORT_SECRET || process.env.NEXTAUTH_SECRET || "silaer_report_sec_sig_2026_enterprise_production_key";

/**
 * Generates a tamper-proof, signed URL-safe share token for a campaign.
 * Format: rep_<base64UrlPayload>.<base64UrlSignature>
 */
export function generateReportToken(campaignId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      c: campaignId,
      t: Math.floor(Date.now() / 1000),
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", REPORT_SECRET)
    .update(payload)
    .digest("base64url");

  return `rep_${payload}.${signature}`;
}

/**
 * Verifies a report token and extracts the campaign ID securely.
 * Rejects tampered tokens, expired formats, or invalid signatures with timing-safe comparison.
 */
export function verifyReportToken(token: string): { valid: boolean; campaignId?: string } {
  if (!token || typeof token !== "string" || !token.startsWith("rep_")) {
    return { valid: false };
  }

  const raw = token.slice(4); // Remove "rep_" prefix
  const parts = raw.split(".");
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadStr, providedSig] = parts;

  const expectedSig = crypto
    .createHmac("sha256", REPORT_SECRET)
    .update(payloadStr)
    .digest("base64url");

  // Constant-time signature verification to prevent timing attacks
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);

  if (providedBuf.length !== expectedBuf.length) {
    return { valid: false };
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    if (!decoded.c || typeof decoded.c !== "string") {
      return { valid: false };
    }
    return { valid: true, campaignId: decoded.c };
  } catch {
    return { valid: false };
  }
}
