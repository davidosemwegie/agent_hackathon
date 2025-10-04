import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import z from "zod";
import { actorTool } from "./actor-tool";
import { selectorTool } from "./selector-tool";
import { intentTool } from "./intent-tool";
import { datadogTool } from "./datadog-tool";
import { conversationLogger } from "@/lib/conversation-logger";
import { nanoid } from "nanoid";

// Type for affordances
interface Affordance {
  id: string;
  role?: string;
  tag: string;
  name?: string;
  text?: string;
  href?: string;
  attrs: Record<string, string>;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  visible: boolean;
  enabled: boolean;
  cssPath: string;
  selector: string;
}

// Allow streaming responses up to 30 seconds
export const maxDuration = 300; // 300 seconds in seconds

// Real weather API function
async function getWeatherData(location: string) {
  try {
    // Using OpenWeatherMap API (you'll need to get a free API key)
    // For demo purposes, I'll use a mock API that returns realistic data
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location
      )}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    );

    if (!response.ok) {
      // Fallback to mock data if API key is not available
      return {
        location,
        temperature: Math.round(20 + Math.random() * 15),
        condition: ["sunny", "cloudy", "rainy", "partly cloudy"][
          Math.floor(Math.random() * 4)
        ],
        humidity: Math.round(40 + Math.random() * 40),
        windSpeed: Math.round(5 + Math.random() * 15),
        description: "Weather data from mock service",
      };
    }

    const data = await response.json();
    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main.toLowerCase(),
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
      description: data.weather[0].description,
    };
  } catch {
    // Fallback to mock data
    return {
      location,
      temperature: Math.round(20 + Math.random() * 15),
      condition: ["sunny", "cloudy", "rainy", "partly cloudy"][
        Math.floor(Math.random() * 4)
      ],
      humidity: Math.round(40 + Math.random() * 40),
      windSpeed: Math.round(5 + Math.random() * 15),
      description: "Weather data from mock service (API unavailable)",
    };
  }
}

export async function POST(req: Request) {
  const body = await req.json();

  console.log("Request body:", body);
  const {
    messages,
    affordances,
    conversationId: existingConversationId,
    userId = 'default-user',
  }: {
    messages: UIMessage[];
    affordances?: Affordance[];
    conversationId?: string;
    userId?: string;
  } = body;

  // Create or use existing conversation
  const conversationId = existingConversationId || await conversationLogger.createConversation({
    userId,
    title: messages[0]?.content?.substring(0, 100) || 'New Conversation',
  });

  for (const message of messages) {
    console.log("Message parts:", message.parts);
  }

  // Log user messages
  for (const message of messages) {
    if (message.role === 'user') {
      await conversationLogger.logMessage({
        conversationId,
        role: 'user',
        content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      });
    }
  }

  // Create system message with affordances context
  const systemMessage = {
    role: "system" as const,
    content: `You are a helpful AI assistant that helps users interact with web pages and troubleshoot issues.

**Your goal:** Provide clear, actionable help in a friendly, conversational tone. Keep responses concise and avoid technical jargon.

**When users report issues:**
- Use the datadog tool to silently check for system errors (it only returns data if relevant errors exist)
- Provide practical solutions based on findings
- Be conversational - incorporate findings naturally without structured templates

**Response style:**
- Be brief and conversational
- Only mention system errors if datadog returns specific findings
- Focus on actionable next steps
- Avoid multi-step explanations unless necessary

${
  affordances && affordances.length > 0
    ? `
**Available page elements:**
${affordances
  .map(
    (aff: Affordance) =>
      `- ${
        aff.name || aff.text || "Unnamed element"
      } (${aff.tag.toLowerCase()})`
  )
  .join("\n")}

**For page interactions, follow this sequence:**
1. Use intent tool to understand what they want to do
2. Use selector tool to find the right element
3. Use actor tool to perform the action

Always pass the full affordances list to the selector tool.
`
    : ""
}`,
  };

  // Add system message to the beginning of the conversation
  const messagesWithSystem = [
    systemMessage,
    ...convertToModelMessages(messages),
  ];

  const result = streamText({
    model: "openai/gpt-5",
    messages: messagesWithSystem,
    tools: {
      weather: tool({
        description:
          "Get the current weather information for a specific location",
        inputSchema: z.object({
          location: z
            .string()
            .describe(
              "The city or location to get the weather for (e.g., 'New York', 'London', 'Tokyo')"
            ),
        }),
        execute: async ({ location }) => {
          console.log(`Fetching weather for: ${location}`);
          const weatherData = await getWeatherData(location);
          console.log("Weather data:", weatherData);
          return weatherData;
        },
      }),
      actor: actorTool,
      selector: selectorTool,
      intent: intentTool,
      datadog: datadogTool,
    },
    // Enable multi-step tool usage with proper stopping conditions
    stopWhen: stepCountIs(100), // Allow up to 10 steps for the agent workflow
    // Enhanced streaming configuration
    experimental_telemetry: {
      isEnabled: true,
    },
    // Add step callbacks for better streaming experience
    onStepFinish: async (step) => {
      console.log(`Step finished:`, {
        toolCalls: step.toolCalls?.length || 0,
        text: step.text?.slice(0, 100) + "...",
      });

      // Log assistant messages
      if (step.text) {
        await conversationLogger.logMessage({
          conversationId,
          role: 'assistant',
          content: step.text,
        });
      }

      // Log tool uses
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const toolCall of step.toolCalls) {
          const startTime = Date.now();
          try {
            await conversationLogger.logToolUse({
              conversationId,
              messageId: nanoid(),
              toolName: toolCall.toolName,
              input: JSON.stringify(toolCall.args),
              output: JSON.stringify(step.toolResults?.find(r => r.toolCallId === toolCall.toolCallId)?.result || {}),
              durationMs: Date.now() - startTime,
              status: 'success',
            });
          } catch (error) {
            await conversationLogger.logToolUse({
              conversationId,
              messageId: nanoid(),
              toolName: toolCall.toolName,
              input: JSON.stringify(toolCall.args),
              output: JSON.stringify({ error: String(error) }),
              durationMs: Date.now() - startTime,
              status: 'error',
            });
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
