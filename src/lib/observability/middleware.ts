import { NextRequest, NextResponse } from "next/server";
import { requestContext, logger } from "./logger";
import { errorTracker } from "./errors";

export function withObservability(
  handler: (req: NextRequest, params: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, params: any) => {
    // Generate a correlation ID if not provided by external caller
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

    return requestContext.run({ requestId }, async () => {
      const start = performance.now();
      const method = req.method;
      const url = req.url;

      logger.info(`Incoming Request: ${method} ${url}`, { module: "API", method, url });

      try {
        const response = await handler(req, params);
        const duration = Math.round(performance.now() - start);

        logger.info(`Completed Request: ${method} ${url}`, {
          module: "API",
          method,
          url,
          status: response.status,
          duration,
        });

        return response;
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        
        await errorTracker.trackError({
          service: "API Route",
          category: "Internal",
          severity: "HIGH",
          message: `Unhandled error in ${method} ${new URL(url).pathname}`,
          error,
        });

        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: 500 }
        );
      }
    });
  };
}
