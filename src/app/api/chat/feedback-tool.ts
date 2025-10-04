import { tool } from "ai";
import z from "zod";

export const feedbackTool = tool({
  description:
    "Ask the user for feedback on whether their problem was resolved. Use this tool when you believe you've completed helping the user with their request. This will prompt them to provide a thumbs up/down rating.",
  inputSchema: z.object({
    summary: z
      .string()
      .describe(
        "A brief summary of what you helped the user accomplish (e.g., 'Filled out the form with your information')"
      ),
    suggestFeedback: z
      .boolean()
      .default(true)
      .describe("Whether to suggest the user provide feedback"),
  }),
  execute: async ({ summary }) => {
    return {
      message: `I've ${summary}. Please let me know if this resolved your issue using the feedback buttons below.`,
      showFeedbackWidget: true,
    };
  },
});
