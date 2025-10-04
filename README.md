This is a [Next.js](https://nextjs.org) project with AI-powered chat functionality using the AI SDK, featuring reasoning capabilities and tool usage.

## Features

- **AI Chat Interface**: Interactive chat widget with streaming responses
- **Reasoning Display**: Shows AI reasoning process with collapsible interface
- **Tool Usage**: Displays tool calls and their results (e.g., weather API)
- **Weather Integration**: Real-time weather data with fallback to mock data
- **Modern UI**: Built with Tailwind CSS and shadcn/ui components

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Weather API Setup (Optional)

To enable real weather data, you can set up a free OpenWeatherMap API key:

1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Get your free API key
3. Create a `.env.local` file in the root directory:
   ```
   OPENWEATHER_API_KEY=your_api_key_here
   ```

If no API key is provided, the app will use mock weather data for demonstration purposes.

## Usage

- Start a conversation by typing a message
- Ask for weather information: "What's the weather in New York?"
- The AI will show its reasoning process and use the weather tool
- Tool calls are displayed with input parameters and results

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
