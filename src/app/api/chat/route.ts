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
    content: `You are a helpful AI assistant that helps users interact with web pages and troubleshoot issues.

**Your goal:** Provide clear, actionable help in a friendly, conversational tone. Avoid technical jargon and make responses easy to understand.

**When users have problems:**
- First check if there are any system-wide issues using the datadog tool
- Then provide practical, step-by-step solutions
- Use simple language and avoid overwhelming technical details

**Response style:**
- Be conversational and empathetic
- Break down complex issues into simple steps
- Focus on what the user can do to solve their problem
- If you find system issues, explain them in plain English
- Use the getResponseTemplate tool for common scenarios to ensure consistent, friendly messaging
- Use the formatResponse tool to structure your final response with clear sections

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
      formatResponse: tool({
        description:
          "Format a response in a user-friendly way with clear sections and actionable steps",
        inputSchema: z.object({
          title: z
            .string()
            .describe("A clear, friendly title for the response"),
          summary: z
            .string()
            .describe("A brief summary of what was found or what the issue is"),
          steps: z
            .array(z.string())
            .optional()
            .describe("Step-by-step actions the user can take"),
          systemStatus: z
            .string()
            .optional()
            .describe("Information about system status if relevant"),
          nextSteps: z
            .string()
            .optional()
            .describe("What the user should do next"),
        }),
        execute: async ({ title, summary, steps, systemStatus, nextSteps }) => {
          return {
            formatted: true,
            title,
            summary,
            steps: steps || [],
            systemStatus,
            nextSteps,
          };
        },
      }),
      getResponseTemplate: tool({
        description:
          "Get a pre-formatted response template for common user scenarios",
        inputSchema: z.object({
          scenario: z
            .enum([
              "form_not_submitting",
              "system_issue_detected",
              "no_system_issues",
              "validation_errors",
              "performance_issues",
              "general_help",
            ])
            .describe("The type of scenario to get a template for"),
          userMessage: z
            .string()
            .describe("The user's original message for context"),
          systemFindings: z
            .string()
            .optional()
            .describe("Any system findings from datadog tool"),
        }),
        execute: async ({ scenario, userMessage, systemFindings }) => {
          const templates = {
            form_not_submitting: {
              title: "Let's get your form working!",
              summary:
                "I'll help you figure out why your form isn't submitting. Let me check for any system issues first, then we'll go through some common solutions.",
              steps: [
                "Check that all required fields are filled out",
                "Make sure your email address is in the correct format",
                "Try refreshing the page and filling out the form again",
                "Check if there are any error messages displayed on the form",
              ],
              nextSteps:
                "If these steps don't work, I can help you test the form directly or investigate further.",
            },
            system_issue_detected: {
              title: "I found the issue!",
              summary:
                systemFindings ||
                "There appears to be a system issue that's affecting form submissions.",
              systemStatus:
                "Our engineering team is aware of this issue and working on a fix.",
              nextSteps:
                "You can try again in a few minutes, or I can help you with an alternative approach.",
            },
            no_system_issues: {
              title: "Good news - no system issues!",
              summary:
                "I don't see any system-wide problems that would prevent your form from working.",
              steps: [
                "Double-check that all required fields are completed",
                "Make sure your information is in the correct format",
                "Try clearing your browser cache and refreshing the page",
                "Test with a different browser or device if possible",
              ],
              nextSteps:
                "If you're still having trouble, I can help you test the form step by step.",
            },
            validation_errors: {
              title: "I found some validation issues",
              summary:
                "The system is detecting some problems with the information you're trying to submit.",
              steps: [
                "Check that all required fields are filled out completely",
                "Make sure your email address follows the format: name@example.com",
                "Verify phone numbers are in the correct format",
                "Ensure any dates are in the expected format",
              ],
              nextSteps:
                "Once you've corrected any formatting issues, try submitting again.",
            },
            performance_issues: {
              title: "The system is running a bit slow",
              summary:
                "I detected some performance issues that might be affecting form submissions.",
              systemStatus:
                "The system is experiencing slower response times than usual.",
              steps: [
                "Try waiting a moment and then submitting your form again",
                "If the form seems stuck, refresh the page and try again",
                "Consider trying during off-peak hours if possible",
              ],
              nextSteps:
                "Our team is working to improve performance. You should see better response times soon.",
            },
            general_help: {
              title: "I'm here to help!",
              summary: "Let me assist you with whatever you need.",
              steps: [
                "Tell me what you're trying to accomplish",
                "I'll check for any system issues that might be affecting you",
                "Then I'll provide step-by-step guidance",
              ],
              nextSteps: "What would you like help with today?",
            },
          };

          return templates[scenario] || templates.general_help;
        },
      }),
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
