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
    
    // Do not inject tracking if explicitly Disabled
    if (policy.strategy === "Disabled") {
      return "";
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    const pixelUrl = `${cleanBase}/api/track/${trackingId}.gif`;
    
    // Standard 1x1 tracking pixel compatible with Gmail Google Image Proxy
    return `<img src="${pixelUrl}" width="1" height="1" border="0" alt="" loading="eager" style="display:block;width:1px;min-width:1px;height:1px;min-height:1px;border:0;outline:none;" />`;
  }
}
