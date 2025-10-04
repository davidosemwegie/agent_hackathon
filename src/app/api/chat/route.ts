import { streamText, UIMessage, convertToModelMessages, tool } from "ai";
import z from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();

  console.log(body);
  const { messages }: { messages: UIMessage[] } = body;

  for (const message of messages) {
    console.log(message.parts);
  }

  const result = streamText({
    model: "openai/gpt-4o",
    messages: convertToModelMessages(messages),
    tools: {
      weather: tool({
        description: "Get the weather in a location",
        inputSchema: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
