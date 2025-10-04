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
  }: { messages: UIMessage[]; affordances?: Affordance[] } = body;

  for (const message of messages) {
    console.log("Message parts:", message.parts);
  }

  // Create system message with affordances context
  const systemMessage = {
    role: "system" as const,
    content: `You are an AI assistant that helps users interact with web pages and troubleshoot issues. You have access to tools that can:

1. **Understand user intent** - Parse what action they want to perform
2. **Find elements** - Match user intent to available page elements using affordances
3. **Execute actions** - Perform DOM actions like clicking, typing, scrolling
4. **Check Datadog** - Search for errors, logs, metrics, and traces when users mention issues

**REASONING STYLE:**
Always think through your approach step by step. Show your reasoning process clearly, including:
- What the user is trying to accomplish
- Which elements you're considering
- Why you're choosing specific actions
- Any potential issues or alternatives

**DATADOG INTEGRATION:**
When users mention errors, issues, problems, or any technical difficulties, automatically use the datadog tool to:
- Detect error indicators in their message
- Check for recent system issues that might be causing their problem
- Provide debugging insights and context without exposing sensitive data
- Help determine if the issue is user-specific or part of a broader system problem

${
  affordances && affordances.length > 0
    ? `
**Available page elements (affordances):**
${affordances
  .map(
    (aff: Affordance) =>
      `- ${
        aff.name || aff.text || "Unnamed element"
      } (${aff.tag.toLowerCase()}) - ${aff.selector}`
  )
  .join("\n")}

**IMPORTANT WORKFLOW:**
When a user wants to interact with the page, you MUST follow this exact sequence:
1. **ALWAYS start with the intent tool** to understand what they want to do
2. **THEN use the selector tool** with the affordancesContext parameter set to the affordances list above to find the right element
3. **FINALLY use the actor tool** to execute the action

You must use ALL THREE tools in sequence for every user interaction request. Do not stop after just one tool call.

When calling the selector tool, always pass the affordancesContext parameter with the full affordances list from above.

Always be helpful and explain what you're doing step by step. Show your thinking process as you work through each step.
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
    onStepFinish: (step) => {
      console.log(`Step finished:`, {
        toolCalls: step.toolCalls?.length || 0,
        text: step.text?.slice(0, 100) + "...",
      });
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
