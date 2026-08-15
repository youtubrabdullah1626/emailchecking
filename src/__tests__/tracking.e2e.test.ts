const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    trackedEmail: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
    trackingEvent: {
      create: jest.fn(),
    },
  },
}));

import { emailTrackingService } from "@/lib/tracking/EmailTrackingService";
import { TrackingInjector } from "@/lib/tracking/TrackingInjector";
import { buildGmailMessage } from "@/lib/gmail/message";

describe("Email Open Tracking — End-to-End Pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a valid tracking pixel HTML snippet", () => {
    const pixel = TrackingInjector.generatePixel("track-123", "https://reachiq.up.railway.app");
    expect(pixel).toContain('src="https://reachiq.up.railway.app/api/track/track-123"');
    expect(pixel).toContain('width="1"');
    expect(pixel).toContain('height="1"');
  });

  it("injects tracking pixel into HTML part of multipart MIME email", () => {
    const trackingPixel = TrackingInjector.generatePixel("track-123", "https://reachiq.up.railway.app");
    const payload = buildGmailMessage({
      from: "sender@gmail.com",
      to: "prospect@example.com",
      toName: "Prospect",
      subject: "Test Subject",
      body: "Hello Prospect!",
      trackingPixel,
    });

    expect(payload.raw).toBeDefined();
    const decoded = Buffer.from(payload.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    expect(decoded).toContain("Content-Type: multipart/alternative");
    expect(decoded).toContain("Content-Type: text/html");
  });

  it("ingests open event and transitions TrackedEmail forward to OPENED", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "track-123",
      status: "SENT",
      open_count: 0,
      click_count: 0,
      first_opened_at: null,
      source_type: "SEQUENCE_STEP",
      source_id: "step-123",
    });

    mockUpdate.mockResolvedValueOnce({
      id: "track-123",
      status: "OPENED",
      open_count: 1,
    });

    await emailTrackingService.ingestEvent("track-123", "OPENED", undefined, {
      ip: "127.0.0.1",
      userAgent: "GoogleImageProxy",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "track-123" },
      data: expect.objectContaining({
        status: "OPENED",
        open_count: 1,
        last_opened_at: expect.any(Date),
      }),
    });
  });
});
