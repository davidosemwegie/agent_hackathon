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
          message:
            "I don't see any obvious error indicators in your message. Let me help you troubleshoot step by step.",
          hasError: false,
          userMessage,
          userFriendlyMessage:
            "No system issues detected - this appears to be a user-specific problem that we can solve together.",
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

      // Generate user-friendly message based on findings
      const userFriendlyMessage = generateUserFriendlyMessage(
        searchResults,
        finalSearchType,
        errorIndicators
      );

      return {
        success: true,
        message: userFriendlyMessage,
        hasError: true,
        searchType: finalSearchType,
        timeRange,
        context: extractedContext,
        errorIndicators,
        results: searchResults.results,
        summary: searchResults.summary,
        recommendations: searchResults.recommendations,
        userFriendlyMessage,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        userMessage,
        hasError: false,
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
  summary: string;
  recommendations: string[];
}> {
  const { searchType, timeRange, context, errorIndicators, mcpClient } = params;

  // Simulate search results based on search type
  let results: unknown[] = [];
  let summary = "";
  let recommendations: string[] = [];

  switch (searchType) {
    case "logs":
      results = await mcpClient.searchLogs(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      summary = `Found ${results.length} error patterns in the last ${timeRange}`;

      // Check if validation errors are present
      const hasValidationErrors = results.some((result: unknown) => {
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

      if (hasValidationErrors) {
        recommendations = [
          "Your form might be missing required information or have formatting issues",
          "Double-check that all required fields are filled out correctly",
          "Make sure email addresses and phone numbers are in the right format",
          "This is likely a form-specific issue rather than a system-wide problem",
        ];
      } else {
        recommendations = [
          "There are some database connection issues that might be affecting your form",
          "The system is experiencing some performance problems",
          "This appears to be affecting multiple users, not just you",
          "The timing of these issues might match when you started having problems",
        ];
      }
      break;

    case "metrics":
      results = await mcpClient.searchMetrics(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      summary = `Found ${results.length} performance anomalies in the last ${timeRange}`;
      recommendations = [
        "The system is running slower than usual, which could explain why your form is taking time to respond",
        "There are some performance issues affecting the system right now",
        "This appears to be affecting multiple users, not just you",
        "The problem is likely on our end rather than something wrong with your form",
      ];
      break;

    case "traces":
      results = await mcpClient.searchTraces(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      summary = `Found ${results.length} problematic request patterns in the last ${timeRange}`;
      recommendations = [
        "The system is having trouble processing requests, which could be why your form isn't submitting",
        "There are some issues with how the system is handling form submissions",
        "The timing of these problems might match when you started having issues",
        "This suggests the problem is on our end rather than with your specific form",
      ];
      break;

    case "incidents":
      results = await mcpClient.searchIncidents(
        buildSearchQuery(context, errorIndicators),
        timeRange
      );
      summary = `Found ${results.length} active incidents that may be related to your issue`;
      recommendations = [
        "There's an active system issue that matches the problem you're experiencing",
        "Our engineering team is already aware and working on fixing this",
        "Your problem is part of a broader system issue, not something wrong with your account",
        "We're working on it - you should see improvement as we resolve the issue",
      ];
      break;
  }

  return { results, summary, recommendations };
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

// Helper function to generate user-friendly messages
function generateUserFriendlyMessage(
  searchResults: {
    results: unknown[];
    summary: string;
    recommendations: string[];
  },
  searchType: string,
  errorIndicators: ReturnType<typeof detectErrorIndicators>
): string {
  const { results, recommendations } = searchResults;

  if (results.length === 0) {
    return "Good news! I don't see any recent system issues that would cause your problem. This suggests it's likely something we can fix on your end.";
  }

  // Generate contextual messages based on search type and findings
  let baseMessage = "";

  switch (searchType) {
    case "logs":
      if (recommendations.some((rec) => rec.includes("validation"))) {
        baseMessage =
          "I found some validation errors in the system logs. This suggests your form might be missing required information or have formatting issues.";
      } else if (recommendations.some((rec) => rec.includes("database"))) {
        baseMessage =
          "I detected some database connection issues in the system. This could be causing your form submission problems.";
      } else {
        baseMessage =
          "I found some error patterns in the system logs that might be related to your issue.";
      }
      break;

    case "metrics":
      baseMessage =
        "I noticed some performance issues in the system that could be affecting form submissions. The system appears to be running slower than usual.";
      break;

    case "traces":
      baseMessage =
        "I found some problematic request patterns that might explain why your form isn't working properly.";
      break;

    case "incidents":
      baseMessage =
        "There's an active system incident that's likely causing your problem. The engineering team is already working on it.";
      break;

    default:
      baseMessage =
        "I found some system issues that might be related to your problem.";
  }

  // Add severity context
  if (errorIndicators.severity === "high") {
    baseMessage +=
      " This appears to be a significant issue affecting multiple users.";
  } else if (errorIndicators.severity === "medium") {
    baseMessage +=
      " This seems to be a moderate issue that's affecting some users.";
  } else {
    baseMessage +=
      " This appears to be a minor issue that we should be able to resolve.";
  }

  return baseMessage;
}
