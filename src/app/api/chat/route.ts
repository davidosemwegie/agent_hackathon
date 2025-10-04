import { streamText, UIMessage, convertToModelMessages, tool } from "ai";
import z from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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
    },
    experimental_telemetry: {
      isEnabled: true,
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
