import { generateReportToken, verifyReportToken } from "../token";

describe("Phase 1: Cryptographic Report Token Invariants", () => {
  it("generates a valid, signed share token and verifies it correctly", () => {
    const campaignId = "cm_test_campaign_999";
    const token = generateReportToken(campaignId);

    expect(token).toBeDefined();
    expect(token.startsWith("rep_")).toBe(true);

    const verified = verifyReportToken(token);
    expect(verified.valid).toBe(true);
    expect(verified.campaignId).toBe(campaignId);
  });

  it("rejects tampered tokens with invalid signatures", () => {
    const campaignId = "cm_test_campaign_999";
    const token = generateReportToken(campaignId);

    // Tamper with the signature portion
    const parts = token.split(".");
    const tamperedSig = parts[1].slice(0, -4) + "XXXX";
    const tamperedToken = `${parts[0]}.${tamperedSig}`;

    const check = verifyReportToken(tamperedToken);
    expect(check.valid).toBe(false);
    expect(check.campaignId).toBeUndefined();
  });

  it("rejects malformed tokens", () => {
    expect(verifyReportToken("").valid).toBe(false);
    expect(verifyReportToken("invalid_token_format").valid).toBe(false);
    expect(verifyReportToken("rep_invalid").valid).toBe(false);
    expect(verifyReportToken(null as any).valid).toBe(false);
  });
});
