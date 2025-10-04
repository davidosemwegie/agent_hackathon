import { tool } from "ai";
import z from "zod";
import { getDatadogMCPClient, DatadogMCPClient } from "./mcp-client";

// Datadog MCP tool for error detection and debugging assistance
export const datadogTool = tool({
  description:
    "Search Datadog for system data related to user-reported issues. Analyzes user messages for error indicators and searches logs, metrics, traces, and incidents. Returns raw system data and context for intelligent analysis. Use this when users report problems, errors, or issues to gather relevant system information for debugging.",
  inputSchema: z.object({
    userMessage: z
      .string()
      .describe(
        "The user's message describing their issue or problem. Can be any description of what's not working, errors they're seeing, or problems they're experiencing."
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
    timeRange = "now-5m",
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

      // Return rich data for LLM analysis
      if (searchResults.results.length === 0) {
        return {
          success: true,
          foundErrors: false,
          message: "No relevant errors found in the specified time range.",
          context: searchResults.contextSummary,
          searchQuery: searchResults.searchQuery,
        };
      }

      return {
        success: true,
        foundErrors: true,
        message:
          "Found relevant system data. Please analyze the raw data below to identify the specific error and provide a detailed explanation.",
        rawData: searchResults.rawData,
        context: searchResults.contextSummary,
        searchQuery: searchResults.searchQuery,
        resultCount: searchResults.results.length,
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
  },
  requestContext?: {
    hostname?: string;
    service?: string;
    environment?: string;
    errorMessage?: string;
    errorCode?: string;
    field?: string;
    endpoint?: string;
    ipAddress?: string;
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
    customTags?: Record<string, string>;
  }
): {
  hostname?: string;
  service?: string;
  environment?: string;
  errorMessage?: string;
  errorCode?: string;
  field?: string;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
  userId?: string;
  extractedFromMessage: Record<string, string>;
  requestMetadata: Record<string, string>;
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

  // Build request metadata for additional context
  const requestMetadata: Record<string, string> = {};
  if (requestContext?.ipAddress) requestMetadata.ip = requestContext.ipAddress;
  if (requestContext?.browser) requestMetadata.browser = requestContext.browser;
  if (requestContext?.os) requestMetadata.os = requestContext.os;
  if (requestContext?.device) requestMetadata.device = requestContext.device;
  if (requestContext?.customTags) {
    Object.entries(requestContext.customTags).forEach(([key, value]) => {
      requestMetadata[key] = String(value);
    });
  }

  return {
    hostname:
      additionalContext?.hostname ||
      extracted.hostname ||
      requestContext?.hostname ||
      requestContext?.ipAddress,
    service:
      additionalContext?.service ||
      extracted.service ||
      requestContext?.service,
    environment:
      additionalContext?.environment ||
      extracted.environment ||
      requestContext?.environment,
    errorMessage:
      additionalContext?.errorMessage || requestContext?.errorMessage,
    errorCode:
      additionalContext?.errorCode ||
      extracted.errorCode ||
      requestContext?.errorCode,
    field: extracted.field || requestContext?.field,
    endpoint: extracted.endpoint || requestContext?.endpoint,
    ipAddress: requestContext?.ipAddress,
    userAgent: requestContext?.userAgent,
    browser: requestContext?.browser,
    os: requestContext?.os,
    device: requestContext?.device,
    userId: requestContext?.customTags?.userId,
    extractedFromMessage: extracted,
    requestMetadata,
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
  rawData?: string;
  searchQuery?: string;
  contextSummary?: string;
}> {
  const { searchType, timeRange, context, errorIndicators, mcpClient } = params;

  let results: unknown[] = [];
  const searchQuery = buildSearchQuery(context, errorIndicators);

  // Build context summary for the LLM
  const contextSummary = buildContextSummary(context, errorIndicators);

  switch (searchType) {
    case "logs":
      results = await mcpClient.searchLogs(searchQuery, timeRange);
      break;

    case "metrics":
      results = await mcpClient.searchMetrics(searchQuery, timeRange);
      break;

    case "traces":
      results = await mcpClient.searchTraces(searchQuery, timeRange);
      break;

    case "incidents":
      results = await mcpClient.searchIncidents(searchQuery, timeRange);
      break;
  }

  // Return raw data for LLM analysis instead of pre-processed messages
  const rawData =
    results.length > 0
      ? JSON.stringify(results.slice(0, 10), null, 2) // Limit to first 10 results to avoid token limits
      : undefined;

  return {
    results,
    rawData,
    searchQuery,
    contextSummary,
  };
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

// Helper function to build context summary for LLM analysis
function buildContextSummary(
  context: ReturnType<typeof extractContextFromMessage>,
  errorIndicators: ReturnType<typeof detectErrorIndicators>
): string {
  const summaryParts: string[] = [];

  // Add user context
  if (context.ipAddress) {
    summaryParts.push(`User IP: ${context.ipAddress}`);
  }

  if (context.browser && context.os) {
    summaryParts.push(`Browser: ${context.browser} on ${context.os}`);
  }

  if (context.device && context.device !== "Desktop") {
    summaryParts.push(`Device: ${context.device}`);
  }

  if (context.userId) {
    summaryParts.push(`User ID: ${context.userId}`);
  }

  // Add environment context
  if (context.environment) {
    summaryParts.push(`Environment: ${context.environment}`);
  }

  if (context.service) {
    summaryParts.push(`Service: ${context.service}`);
  }

  // Add error context
  if (context.errorCode) {
    summaryParts.push(`Error Code: ${context.errorCode}`);
  }

  if (context.field) {
    summaryParts.push(`Field: ${context.field}`);
  }

  if (context.endpoint) {
    summaryParts.push(`Endpoint: ${context.endpoint}`);
  }

  // Add error indicators
  if (errorIndicators.indicators.length > 0) {
    summaryParts.push(
      `Error Indicators: ${errorIndicators.indicators.join(", ")}`
    );
  }

  summaryParts.push(`Severity: ${errorIndicators.severity}`);

  return summaryParts.join(" | ");
}
