export type TrackingStrategy = "Disabled" | "VerifiedCustomDomain" | "SharedDomain" | "SelfHosted";

export interface TrackingPolicy {
  strategy: TrackingStrategy;
}

export class TrackingInjector {
  /**
   * Evaluates the current tracking policy based on configuration.
   * Business rules do not contain provider-specific checks (e.g. Railway),
   * but rather evaluate based on configured trust levels.
   */
  public static getPolicy(): TrackingPolicy {
    // Read from environment configuration
    const strategy = process.env.TRACKING_STRATEGY as TrackingStrategy || "SharedDomain";
    return { strategy };
  }

  /**
   * Generates a 1x1 transparent tracking pixel HTML snippet.
   * This should only be injected into the HTML MIME part of the email, NEVER the plain text part.
   */
  public static generatePixel(trackingId: string, baseUrl: string): string {
    if (!baseUrl) {
      return "";
    }

    const policy = this.getPolicy();
    
    // Do not inject tracking for untrusted/shared domains to protect deliverability
    if (policy.strategy === "Disabled" || policy.strategy === "SharedDomain") {
      return "";
    }

    const pixelUrl = `${baseUrl}/api/track/${trackingId}`;
    
    // Safe structurally benign pixel without hidden spam signatures
    return `<img src="${pixelUrl}" width="1" height="1" alt="" />`;
  }
}
