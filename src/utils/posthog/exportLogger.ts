import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

/** Ships server logs to PostHog over OTLP. Undefined when PostHog is not configured. */
function createPostHogLogProvider() {
  if (!posthogKey || !posthogHost) return undefined;

  return new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "cga-hr-web" }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: new URL("/i/v1/logs", posthogHost).toString(),
          headers: {
            Authorization: `Bearer ${posthogKey}`,
            "Content-Type": "application/json",
          },
        }),
      }),
    ],
  });
}

export const posthogLogProvider = createPostHogLogProvider();
export const posthogExportLogger = posthogLogProvider?.getLogger("posthog-exporter");
