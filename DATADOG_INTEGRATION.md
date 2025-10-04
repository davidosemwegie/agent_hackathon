# Datadog MCP Integration

This project now includes a Datadog MCP (Model Context Protocol) tool that automatically detects when users mention errors or issues and searches Datadog for relevant information.

## Features

- **Automatic Error Detection**: Intelligently detects error indicators in user messages
- **Context Extraction**: Extracts hostname, service, environment, and other relevant context
- **Multi-Type Search**: Searches logs, metrics, traces, and incidents
- **Smart Recommendations**: Provides actionable recommendations based on findings
- **MCP Integration**: Uses Model Context Protocol for flexible Datadog server connections

## How It Works

1. **Error Detection**: The tool analyzes user messages for error keywords, HTTP status codes, and severity indicators
2. **Context Extraction**: Extracts relevant context like hostname, service, environment from the message
3. **Search Type Determination**: Automatically determines whether to search logs, metrics, traces, or incidents
4. **Datadog Search**: Performs targeted searches using the MCP client
5. **Results & Recommendations**: Returns structured results with actionable recommendations

## Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Datadog MCP Server Configuration
# Choose one of: stdio, http, sse
DATADOG_MCP_SERVER_TYPE=stdio

# For stdio transport
DATADOG_MCP_SERVER_COMMAND=node
DATADOG_MCP_SERVER_ARGS=path/to/your/datadog-mcp-server.js

# For HTTP/SSE transport
DATADOG_MCP_SERVER_URL=http://localhost:3000/mcp

# Datadog API Configuration (if using direct API calls)
DATADOG_API_KEY=your_datadog_api_key
DATADOG_APP_KEY=your_datadog_app_key
DATADOG_SITE=datadoghq.com
```

### MCP Server Setup

You'll need to set up a Datadog MCP server. The client supports three transport types:

1. **stdio**: Local process communication
2. **http**: HTTP-based communication
3. **sse**: Server-Sent Events

## Usage Examples

### User Messages That Trigger Datadog Search

- "I'm seeing database connection errors"
- "The API is returning 500 errors"
- "Service web-api on host web-01 is down"
- "We're experiencing high response times"
- "There's a critical issue in production"
- "I'm getting a validation error"
- "The API says my field is missing"
- "I'm getting a bad request error"
- "The form validation is failing"
- "My request is being rejected"

### Tool Response

The tool will:
1. Detect error indicators in the message
2. Extract context (service, hostname, environment)
3. Search relevant Datadog data
4. Return structured results with recommendations

## Error Detection Patterns

The tool detects various error indicators:

### Keywords
- **Errors**: error, failed, broken, issue, problem, bug, crash, exception
- **Warnings**: warning, alert, unusual, strange, unexpected, anomaly
- **Critical**: critical, urgent, emergency, outage, severe, fatal
- **Validation**: validation, invalid, missing field, required field, bad request, malformed, format error, schema error, type error, null value, empty value, undefined, not found, missing, required, mandatory

### HTTP Status Codes
- Automatically detects 4xx and 5xx status codes
- Assigns severity based on status code range

### Context Extraction
- **Hostname**: "host:web-01", "server:prod-01"
- **Service**: "service:web-api", "app:user-service"
- **Environment**: "env:production", "environment:staging"
- **Error Codes**: "error code:DB001", "code:CONN_TIMEOUT"
- **Fields**: "field:email", "parameter:phone_number", "property:username"
- **Endpoints**: "endpoint:/api/users", "api:/auth/login", "route:/dashboard"

## Search Types

### Auto-Detection Logic
- **Incidents**: Critical errors or high severity issues
- **Metrics**: Performance issues (timeout, slow, lag, spike)
- **Logs**: General errors and exceptions
- **Traces**: Distributed tracing for error analysis

## Files Added/Modified

- `src/app/api/chat/datadog-tool.ts` - Main Datadog tool implementation
- `src/app/api/chat/mcp-client.ts` - MCP client setup and management
- `src/app/api/chat/route.ts` - Integration with main chat API
- `package.json` - Added @modelcontextprotocol/sdk dependency

## Development Notes

- The tool currently uses mock data for development
- MCP client gracefully falls back to mock data if connection fails
- All search functions are implemented with proper error handling
- The tool is designed to be non-blocking and fail gracefully

## Next Steps

1. Set up a Datadog MCP server
2. Configure environment variables
3. Test with real Datadog data
4. Customize search queries and recommendations
5. Add more sophisticated error detection patterns

## Testing

To test the integration:

1. Start the development server: `pnpm dev`
2. Send messages with error indicators to the chat
3. Observe the tool automatically detecting and searching Datadog
4. Review the structured results and recommendations

Example test messages:
- "I'm seeing database connection timeouts"
- "The web-api service is returning 500 errors"
- "We have a critical issue in production"
- "I'm getting a validation error when submitting the form"
- "The API says the email field is required but I'm sending it"
- "I'm getting a bad request error for the /api/users endpoint"
