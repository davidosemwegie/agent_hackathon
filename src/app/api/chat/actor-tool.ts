import { tool } from "ai";
import z from "zod";

// Actor tool for DOM manipulation
export const actorTool = tool({
  description:
    "Interact with the DOM by clicking elements, typing text, scrolling, and other browser actions",
  inputSchema: z.object({
    action: z
      .enum([
        "click",
        "type",
        "clear",
        "waitForElement",
        "scrollTo",
        "scrollToTop",
        "scrollToBottom",
        "scrollBy",
        "scrollToElement",
        "scrollToElementTop",
        "scrollToElementBottom",
        "scrollPageDown",
        "scrollPageUp",
        "focus",
        "blur",
        "typeFast",
      ])
      .describe("The action to perform"),
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector for the target element (required for most actions)"
      ),
    text: z
      .string()
      .optional()
      .describe("Text to type (required for type actions)"),
    x: z.number().optional().describe("X coordinate for scroll actions"),
    y: z.number().optional().describe("Y coordinate for scroll actions"),
    timeout: z
      .number()
      .optional()
      .describe("Timeout in milliseconds for waitForElement action"),
    simulateTyping: z
      .boolean()
      .optional()
      .describe(
        "Whether to simulate human typing (default: true for type action)"
      ),
    scrollOptions: z
      .object({
        behavior: z.enum(["auto", "smooth"]).optional(),
        block: z.enum(["start", "center", "end", "nearest"]).optional(),
        inline: z.enum(["start", "center", "end", "nearest"]).optional(),
      })
      .optional()
      .describe("Scroll options for scrollToElement action"),
  }),
  execute: async ({
    action,
    selector,
    text,
    x,
    y,
    timeout,
    simulateTyping,
    scrollOptions,
  }) => {
    try {
      // Validate required parameters
      const requiredSelectorActions = [
        "click",
        "type",
        "typeFast",
        "clear",
        "waitForElement",
        "scrollToElement",
        "scrollToElementTop",
        "scrollToElementBottom",
        "focus",
        "blur",
      ];
      if (requiredSelectorActions.includes(action) && !selector) {
        throw new Error(`Selector is required for ${action} action`);
      }

      const requiredTextActions = ["type", "typeFast"];
      if (requiredTextActions.includes(action) && !text) {
        throw new Error(`Text is required for ${action} action`);
      }

      // Return the action details for client-side execution using the existing Actor class
      return {
        success: true,
        message: `Actor action '${action}' ready for execution`,
        action,
        selector,
        text,
        x,
        y,
        timeout,
        simulateTyping,
        scrollOptions,
        executable: true,
        note: "This action will be executed on the client side using the existing Actor class from director/actor.ts",
        // Return the exact parameters that the Actor class methods expect
        actorMethod: action,
        actorParams: {
          ...(selector && { selector }),
          ...(text && { text }),
          ...(x !== undefined && { x }),
          ...(y !== undefined && { y }),
          ...(timeout !== undefined && { timeout }),
          ...(simulateTyping !== undefined && { simulateTyping }),
          ...(scrollOptions && { scrollOptions }),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        action,
        selector,
        text,
        x,
        y,
        timeout,
        simulateTyping,
        scrollOptions,
      };
    }
  },
});
