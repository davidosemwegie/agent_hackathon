import { tool } from "ai";
import z from "zod";
import { getDatadogMCPClient, DatadogMCPClient } from "./mcp-client";

// Datadog MCP tool for error detection and debugging assistance
export const datadogTool = tool({
  description:
    "Check Datadog for recent errors and issues that might be causing user problems. Detects validation errors, missing fields, API issues, and other backend problems. Provides debugging insights and recommendations without exposing sensitive data. Automatically detects error indicators in user messages and searches for relevant issues in the recent time period.",
  inputSchema: z.object({
    userMessage: z
      .string()
      .describe(
        "The user's message to analyze for error indicators and extract context"
      ),
    searchType: z
      .enum(["auto", "logs", "metrics", "traces", "incidents"])
      .optional()
      .describe(
        "Type of Datadog search to perform. 'auto' will detect based on user message"
      ),
    timeRange: z
      .string()
      .optional()
      .describe(
        "Time range for the search (e.g., 'now-1h', 'now-24h', 'now-7d'). Defaults to 'now-1h'"
      ),
    additionalContext: z
      .object({
        hostname: z.string().optional(),
        service: z.string().optional(),
        environment: z.string().optional(),
        errorMessage: z.string().optional(),
        errorCode: z.string().optional(),
      })
      .optional()
      .describe("Additional context to help narrow down the search"),
  }),
  execute: async ({
    userMessage,
    searchType = "auto",
    timeRange = "now-1h",
    additionalContext,
  }) => {
    try {
      // Detect error indicators in the user message
      const errorIndicators = detectErrorIndicators(userMessage);

      if (!errorIndicators.hasError) {
        return {
          success: true,
          foundErrors: false,
        };
      }

      // Extract context from user message
      const extractedContext = extractContextFromMessage(
        userMessage,
        additionalContext
      );

      // Determine search type if auto
      const finalSearchType =
        searchType === "auto"
          ? determineSearchType(errorIndicators)
          : searchType;

      // Initialize MCP client and perform search
      const mcpClient = await getDatadogMCPClient();
      const searchResults = await performDatadogSearch({
        searchType: finalSearchType,
        timeRange,
        context: extractedContext,
        errorIndicators,
        mcpClient,
      });

      // Return minimal, actionable findings
      if (searchResults.results.length === 0) {
        return {
          success: true,
          foundErrors: false,
        };
      }

      return {
        success: true,
        foundErrors: true,
        relevantError: searchResults.conciseError,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        foundErrors: false,
      };
    }
  },
});

// Helper function to detect error indicators in user messages
function detectErrorIndicators(message: string): {
  hasError: boolean;
  indicators: string[];
  severity: "low" | "medium" | "high";
  errorTypes: string[];
} {
  const lowerMessage = message.toLowerCase();

  // Error keywords and phrases
  const errorKeywords = [
    "error",
    "errors",
    "failed",
    "failure",
    "broken",
    "issue",
    "issues",
    "problem",
    "problems",
    "bug",
    "bugs",
    "crash",
    "crashed",
    "down",
    "not working",
    "doesn't work",
    "won't work",
    "can't",
    "cannot",
    "exception",
    "exceptions",
    "timeout",
    "timeouts",
    "slow",
    "lag",
    "500",
    "404",
    "403",
    "401",
    "400",
    "502",
    "503",
    "504",
    "connection refused",
    "connection timeout",
    "database error",
    "memory leak",
    "out of memory",
    "disk full",
    "permission denied",
    // Validation and field-related errors
    "validation",
    "invalid",
    "missing field",
    "required field",
    "field required",
    "bad request",
    "malformed",
    "format error",
    "schema error",
    "type error",
    "null value",
    "empty value",
    "undefined",
    "not found",
    "missing",
    "required",
    "mandatory",
  ];

  const warningKeywords = [
    "warning",
    "warnings",
    "alert",
    "alerts",
    "unusual",
    "strange",
    "weird",
    "unexpected",
    "anomaly",
    "spike",
    "drop",
    "increase",
  ];

  const criticalKeywords = [
    "critical",
    "urgent",
    "emergency",
    "outage",
    "down",
    "unavailable",
    "severe",
    "fatal",
    "panic",
    "crash",
    "disaster",
  ];

  const foundIndicators: string[] = [];
  let severity: "low" | "medium" | "high" = "low";
  const errorTypes: string[] = [];

  // Check for error keywords
  errorKeywords.forEach((keyword) => {
    if (lowerMessage.includes(keyword)) {
      foundIndicators.push(keyword);
      errorTypes.push("error");
    }
  });

  // Check for warning keywords
  warningKeywords.forEach((keyword) => {
    if (lowerMessage.includes(keyword)) {
      foundIndicators.push(keyword);
      errorTypes.push("warning");
      if (severity === "low") severity = "medium";
    }
  });

  // Check for critical keywords
  criticalKeywords.forEach((keyword) => {
    if (lowerMessage.includes(keyword)) {
      foundIndicators.push(keyword);
      errorTypes.push("critical");
      severity = "high";
    }
  });

  // Check for HTTP status codes
  const httpStatusMatch = lowerMessage.match(/\b(4\d{2}|5\d{2})\b/);
  if (httpStatusMatch) {
    foundIndicators.push(`HTTP ${httpStatusMatch[0]}`);
    errorTypes.push("http_error");
    if (parseInt(httpStatusMatch[0]) >= 500) {
      severity = "high";
    } else if (parseInt(httpStatusMatch[0]) >= 400) {
      severity = "medium";
    }
  }

  return {
    hasError: foundIndicators.length > 0,
    indicators: foundIndicators,
    severity,
    errorTypes: [...new Set(errorTypes)],
  };
}

// Helper function to extract context from user message
function extractContextFromMessage(
  message: string,
  additionalContext?: {
    hostname?: string;
    service?: string;
    environment?: string;
    errorMessage?: string;
    errorCode?: string;
    field?: string;
    endpoint?: string;
  }
): {
  hostname?: string;
  service?: string;
  environment?: string;
  errorMessage?: string;
  errorCode?: string;
  field?: string;
  endpoint?: string;
  extractedFromMessage: Record<string, string>;
} {
  const extracted: Record<string, string> = {};

  // Extract hostname patterns
  const hostnameMatch = message.match(
    /\b(?:host|server|machine)\s*[:\-]?\s*([a-zA-Z0-9\-\.]+)/i
  );
  if (hostnameMatch) {
    extracted.hostname = hostnameMatch[1];
  }

  // Extract service patterns
  const serviceMatch = message.match(
    /\b(?:service|app|application)\s*[:\-]?\s*([a-zA-Z0-9\-_]+)/i
  );
  if (serviceMatch) {
    extracted.service = serviceMatch[1];
  }

  // Extract environment patterns
  const envMatch = message.match(
    /\b(?:env|environment)\s*[:\-]?\s*(prod|production|staging|dev|development|test|testing)/i
  );
  if (envMatch) {
    extracted.environment = envMatch[1];
  }

  // Extract error codes
  const errorCodeMatch = message.match(
    /\b(?:error\s*code|code)\s*[:\-]?\s*([A-Z0-9\-_]+)/i
  );
  if (errorCodeMatch) {
    extracted.errorCode = errorCodeMatch[1];
  }

  // Extract field names from validation-related messages
  const fieldMatch = message.match(
    /\b(?:field|parameter|property)\s*[:\-]?\s*['"]?([a-zA-Z0-9_]+)['"]?/i
  );
  if (fieldMatch) {
    extracted.field = fieldMatch[1];
  }

  // Extract API endpoints
  const endpointMatch = message.match(
    /\b(?:endpoint|api|route)\s*[:\-]?\s*['"]?([\/a-zA-Z0-9_\-]+)['"]?/i
  );
  if (endpointMatch) {
    extracted.endpoint = endpointMatch[1];
  }

  return {
    hostname: additionalContext?.hostname || extracted.hostname,
    service: additionalContext?.service || extracted.service,
    environment: additionalContext?.environment || extracted.environment,
    errorMessage: additionalContext?.errorMessage,
    errorCode: additionalContext?.errorCode || extracted.errorCode,
    field: extracted.field,
    endpoint: extracted.endpoint,
    extractedFromMessage: extracted,
  };
}

// Helper function to determine search type based on error indicators
function determineSearchType(
  errorIndicators: ReturnType<typeof detectErrorIndicators>
): "logs" | "metrics" | "traces" | "incidents" {
  if (
    errorIndicators.errorTypes.includes("critical") ||
    errorIndicators.severity === "high"
  ) {
    return "incidents";
  }

  if (
    errorIndicators.indicators.some((indicator) =>
      ["timeout", "slow", "lag", "spike", "drop", "increase"].includes(
        indicator
      )
    )
  ) {
    return "metrics";
  }

  if (
    errorIndicators.indicators.some((indicator) =>
      ["exception", "error", "crash", "failed"].includes(indicator)
    )
  ) {
    return "logs";
  }

  return "logs"; // Default to logs
}

// Datadog search function using MCP client
async function performDatadogSearch(params: {
  searchType: string;
  timeRange: string;
  context: ReturnType<typeof extractContextFromMessage>;
  errorIndicators: ReturnType<typeof detectErrorIndicators>;
  mcpClient: DatadogMCPClient;
}): Promise<{
  results: unknown[];
  conciseError?: string;
}> {
  const { searchType, timeRange, context, errorIndicators, mcpClient } = params;

  let results: unknown[] = [];
  let conciseError: string | undefined;

  switch (searchType) {
    case "logs":
      results = await mcpClient.searchLogs(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );

      if (results.length > 0) {
        // Extract the most relevant error
        const validationError = results.find((result: unknown) => {
          const r = result as Record<string, unknown>;
          const errorType = r.error_type as string;
          const message = r.message as string;

          return (
            errorType?.toLowerCase().includes("validation") ||
            errorType?.toLowerCase().includes("bad request") ||
            message?.toLowerCase().includes("required field") ||
            message?.toLowerCase().includes("missing field") ||
            message?.toLowerCase().includes("invalid format")
          );
        });

        if (validationError) {
          const r = validationError as Record<string, unknown>;
          conciseError = `Validation error detected: ${r.message || "form field issue"}`;
        } else {
          const r = results[0] as Record<string, unknown>;
          conciseError = `System error: ${r.message || "backend issue detected"}`;
        }
      }
      break;

    case "metrics":
      results = await mcpClient.searchMetrics(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      if (results.length > 0) {
        conciseError = "Performance degradation detected in the system";
      }
      break;

    case "traces":
      results = await mcpClient.searchTraces(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      if (results.length > 0) {
        conciseError = "Request processing issues detected";
      }
      break;

    case "incidents":
      results = await mcpClient.searchIncidents(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      if (results.length > 0) {
        const r = results[0] as Record<string, unknown>;
        conciseError = `Active incident: ${r.title || "system issue"}`;
      }
      break;
  }

  return { results, conciseError };
}

// Helper function to build search query from context and error indicators
function buildSearchQuery(
  context: ReturnType<typeof extractContextFromMessage>,
  errorIndicators: ReturnType<typeof detectErrorIndicators>
): string {
  const queryParts: string[] = [];

  // Add error indicators to query
  if (errorIndicators.indicators.length > 0) {
    queryParts.push(`(${errorIndicators.indicators.join(" OR ")})`);
  }

  // Add context filters
  if (context.service) {
    queryParts.push(`service:${context.service}`);
  }

  if (context.hostname) {
    queryParts.push(`host:${context.hostname}`);
  }

  if (context.environment) {
    queryParts.push(`env:${context.environment}`);
  }

  if (context.errorCode) {
    queryParts.push(`error_code:${context.errorCode}`);
  }

  if (context.field) {
    queryParts.push(`field:${context.field}`);
  }

  if (context.endpoint) {
    queryParts.push(`endpoint:${context.endpoint}`);
  }

  // Add severity filter
  if (errorIndicators.severity === "high") {
    queryParts.push("(status:error OR level:ERROR OR severity:high)");
  } else if (errorIndicators.severity === "medium") {
    queryParts.push(
      "(status:error OR level:ERROR OR level:WARN OR severity:medium)"
    );
  }

  return queryParts.join(" AND ");
}

