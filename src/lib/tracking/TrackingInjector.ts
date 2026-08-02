export class TrackingInjector {
  /**
   * Generates a 1x1 transparent tracking pixel HTML snippet.
   * This should only be injected into the HTML MIME part of the email, NEVER the plain text part.
   */
  public static generatePixel(trackingId: string, baseUrl: string): string {
    // If running locally, do not inject the tracking pixel. 
    // Gmail aggressively flags localhost or 127.0.0.1 image links as spam/phishing.
    if (!baseUrl || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      return "";
    }
    const pixelUrl = `${baseUrl}/api/track/${trackingId}`;
    return `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none; visibility:hidden; width:1px; height:1px;" />`;
  }
}
