import { experimental_createMCPClient } from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// MCP Client interface
interface MCPClient {
  callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: unknown }>;
  tools(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

// Types for Datadog data
interface DatadogLogEntry {
  timestamp: string;
  level: string;
  error_type?: string;
  service?: string;
  environment?: string;
  count?: number;
  last_seen?: string;
  message?: string;
}

interface DatadogMetricEntry {
  metric: string;
  current_value: number;
  normal_range: string;
  status: string;
  trend: string;
  service?: string;
  environment?: string;
  impact: string;
}

interface DatadogTraceEntry {
  operation: string;
  duration: number;
  status: string;
  service?: string;
  timestamp: string;
  error_summary: string;
  slowest_operation: string;
  bottleneck_duration: number;
  error_count: number;
  success_rate: number;
}

interface DatadogIncidentEntry {
  id: string;
  title: string;
  status: string;
  severity: string;
  created_at: string;
  affected_services: string[];
  impact_summary: string;
  user_impact: string;
  resolution_status: string;
  estimated_resolution: string;
}

// MCP Client setup for Datadog integration
export class DatadogMCPClient {
  private client: MCPClient | null = null;
  private transport: StreamableHTTPClientTransport | StdioClientTransport | null = null;

  constructor() {
    // Initialize based on environment configuration
    this.initializeTransport();
  }

  private initializeTransport() {
    try {
      // Use the configured Datadog MCP server from .cursor/mcp.json
      const datadogMCPUrl =
        "https://mcp.us5.datadoghq.com/api/unstable/mcp-server/mcp";

      // Create HTTP transport with authentication headers
      const url = new URL(datadogMCPUrl);
      url.searchParams.set("DD_API_KEY", process.env.DATADOG_API_KEY || "");
      url.searchParams.set(
        "DD_APPLICATION_KEY",
        process.env.DATADOG_APP_KEY || ""
      );

      this.transport = new StreamableHTTPClientTransport(url);

      console.log("Initialized Datadog MCP transport with HTTP client");
    } catch (error) {
      console.error("Failed to initialize Datadog MCP transport:", error);
      // Fallback to mock transport for development
      this.transport = new StdioClientTransport({
        command: "node",
        args: ["-e", "console.log('Mock MCP server')"],
      });
    }
  }

  async connect(): Promise<void> {
    try {
      if (!this.transport) {
        throw new Error("Transport not initialized");
      }

      this.client = (await experimental_createMCPClient({
        transport: this.transport,
      })) as MCPClient;

      console.log("MCP client connected successfully");
    } catch (error) {
      console.error("Failed to connect MCP client:", error);
      // For development, we'll continue without the actual MCP connection
      this.client = null;
    }
  }

  async getTools(): Promise<Record<string, unknown>> {
    try {
      if (!this.client) {
        console.warn("MCP client not connected, returning empty tools");
        return {};
      }

      const tools = await this.client.tools();
      console.log("Available Datadog MCP tools:", Object.keys(tools));
      return tools;
    } catch (error) {
      console.error("Failed to get tools from MCP client:", error);
      return {};
    }
  }

  async listAvailableTools(): Promise<string[]> {
    try {
      if (!this.client) {
        console.warn("MCP client not connected");
        return [];
      }

      const tools = await this.client.tools();
      const toolNames = Object.keys(tools);
      console.log("Available Datadog MCP tools:", toolNames);
      return toolNames;
    } catch (error) {
      console.error("Failed to list tools from MCP client:", error);
      return [];
    }
  }

  async searchLogs(
    query: string,
    timeRange: string = "now-1h"
  ): Promise<DatadogLogEntry[]> {
    try {
      if (!this.client) {
        console.warn("MCP client not connected, returning mock data");
        return this.getMockLogs();
      }

      // Call the actual MCP tool for log search
      const result = await this.client.callTool("search_datadog_logs", {
        query,
        from: timeRange,
        to: "now",
      });

      return this.sanitizeData<DatadogLogEntry>(result.content || []);
    } catch (error) {
      console.error("Failed to search logs:", error);
      return this.getMockLogs();
    }
  }

  async searchMetrics(
    query: string,
    timeRange: string = "now-1h"
  ): Promise<DatadogMetricEntry[]> {
    try {
      if (!this.client) {
        console.warn("MCP client not connected, returning mock data");
        return this.getMockMetrics();
      }

      // Call the actual MCP tool for metrics search
      const result = await this.client.callTool("get_datadog_metric", {
        query,
        from: timeRange,
        to: "now",
      });

      return this.sanitizeData<DatadogMetricEntry>(result.content || []);
    } catch (error) {
      console.error("Failed to search metrics:", error);
      return this.getMockMetrics();
    }
  }

  async searchTraces(
    query: string,
    timeRange: string = "now-1h"
  ): Promise<DatadogTraceEntry[]> {
    try {
      if (!this.client) {
        console.warn("MCP client not connected, returning mock data");
        return this.getMockTraces();
      }

      // Call the actual MCP tool for trace search
      const result = await this.client.callTool("get_datadog_trace", {
        query,
        from: timeRange,
        to: "now",
      });

      return this.sanitizeData<DatadogTraceEntry>(result.content || []);
    } catch (error) {
      console.error("Failed to search traces:", error);
      return this.getMockTraces();
    }
  }

  async searchIncidents(
    query: string,
    timeRange: string = "now-1h"
  ): Promise<DatadogIncidentEntry[]> {
    try {
      if (!this.client) {
        console.warn("MCP client not connected, returning mock data");
        return this.getMockIncidents();
      }

      // Call the actual MCP tool for incident search
      const result = await this.client.callTool("get_datadog_incident", {
        query,
        from: timeRange,
        to: "now",
      });

      return this.sanitizeData<DatadogIncidentEntry>(result.content || []);
    } catch (error) {
      console.error("Failed to search incidents:", error);
      return this.getMockIncidents();
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        console.log("MCP client closed successfully");
      }
    } catch (error) {
      console.error("Failed to close MCP client:", error);
    }
  }

  // Sanitize data to remove sensitive information for client-facing responses
  private sanitizeData<T>(data: unknown[] | unknown): T[] {
    const items = Array.isArray(data) ? data : [data];
    return items.map((item) => {
      const sanitized = { ...item } as Record<string, unknown>;

      // Remove sensitive fields
      delete sanitized.trace_id;
      delete sanitized.span_id;
      delete sanitized.host;
      delete sanitized.hostname;
      delete sanitized.ip;
      delete sanitized.user_id;
      delete sanitized.session_id;
      delete sanitized.api_key;
      delete sanitized.token;
      delete sanitized.password;
      delete sanitized.secret;

      // Sanitize messages to remove sensitive data
      if (sanitized.message && typeof sanitized.message === "string") {
        sanitized.message = (sanitized.message as string)
          .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]")
          .replace(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            "[EMAIL]"
          )
          .replace(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            "[EMAIL]"
          )
          .replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, "[CARD]")
          .replace(/\b[A-Za-z0-9]{20,}\b/g, "[ID]");
      }

      return sanitized as T;
    });
  }

  // Sanitized mock data for client-facing debugging
  private getMockLogs(): DatadogLogEntry[] {
    return [
      {
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        level: "ERROR",
        error_type: "Validation Error",
        service: "web-api",
        environment: "production",
        count: 23,
        last_seen: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        message: "Required field 'email' is missing from request",
      },
      {
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        level: "ERROR",
        error_type: "Bad Request",
        service: "web-api",
        environment: "production",
        count: 12,
        last_seen: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        message: "Invalid format for field 'phone_number'",
      },
      {
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        level: "ERROR",
        error_type: "Database Connection Timeout",
        service: "web-api",
        environment: "production",
        count: 15,
        last_seen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ];
  }

  private getMockMetrics(): DatadogMetricEntry[] {
    return [
      {
        metric: "response_time",
        current_value: 5.2,
        normal_range: "1-2 seconds",
        status: "elevated",
        trend: "increasing",
        service: "web-api",
        environment: "production",
        impact: "User experience degradation",
      },
      {
        metric: "error_rate",
        current_value: 15,
        normal_range: "0-2%",
        status: "critical",
        trend: "increasing",
        service: "web-api",
        environment: "production",
        impact: "Service reliability issues",
      },
    ];
  }

  private getMockTraces(): DatadogTraceEntry[] {
    return [
      {
        operation: "GET /api/users",
        duration: 5200,
        status: "error",
        service: "web-api",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        error_summary: "Database query timeout",
        slowest_operation: "database_query",
        bottleneck_duration: 4500,
        error_count: 12,
        success_rate: 85,
      },
    ];
  }

  private getMockIncidents(): DatadogIncidentEntry[] {
    return [
      {
        id: "INC-1234",
        title: "Database connectivity issues",
        status: "active",
        severity: "high",
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        affected_services: ["web-api"],
        impact_summary: "Multiple services experiencing connection issues",
        user_impact: "Some users may experience slower response times",
        resolution_status: "In progress",
        estimated_resolution: "Within 2 hours",
      },
    ];
  }
}

// Singleton instance
let mcpClientInstance: DatadogMCPClient | null = null;

export async function getDatadogMCPClient(): Promise<DatadogMCPClient> {
  if (!mcpClientInstance) {
    mcpClientInstance = new DatadogMCPClient();
    await mcpClientInstance.connect();
  }
  return mcpClientInstance;
}

export async function closeDatadogMCPClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.close();
    mcpClientInstance = null;
  }
}
