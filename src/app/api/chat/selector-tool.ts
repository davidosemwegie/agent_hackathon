import { tool } from "ai";
import z from "zod";

// Selector resolution tool for finding the right element based on user intent
export const selectorTool = tool({
  description:
    "Find the best matching element/selector for a user's intent from the available affordances. Use the affordances provided in the system message context to match the user's intent to the correct CSS selector.",
  inputSchema: z.object({
    intent: z
      .string()
      .describe(
        "The user's intent or description of what they want to interact with (e.g., 'submit button', 'email input field', 'login link')"
      ),
    action: z
      .enum([
        "click",
        "type",
        "clear",
        "focus",
        "scrollTo",
        "scrollToTop",
        "scrollToBottom",
        "scrollBy",
        "waitForElement",
      ])
      .describe("The intended action to perform"),
    text: z.string().optional().describe("Text to type (if action is 'type')"),
    affordancesContext: z
      .string()
      .optional()
      .describe(
        "The affordances context from the system message - use this to find the matching element"
      ),
  }),
  execute: async ({ intent, action, text, affordancesContext }) => {
    try {
      // Parse the affordances from the system message context
      let bestMatch = null;
      let bestScore = 0;

      if (affordancesContext) {
        // Extract affordances from the system message format
        const affordanceLines = affordancesContext
          .split("\n")
          .filter((line) => line.trim().startsWith("-"))
          .map((line) => {
            // Parse format: "- ElementName (tag) - selector"
            const match = line.match(/^- (.+?) \((.+?)\) - (.+)$/);
            if (match) {
              return {
                name: match[1],
                tag: match[2],
                selector: match[3],
              };
            }
            return null;
          })
          .filter(Boolean);

        // Score each affordance based on how well it matches the intent
        for (const affordance of affordanceLines) {
          if (!affordance) continue;

          let score = 0;
          const intentLower = intent.toLowerCase();
          const nameLower = affordance.name.toLowerCase();
          const tagLower = affordance.tag.toLowerCase();

          // Exact name match gets highest score
          if (nameLower === intentLower) {
            score = 100;
          }
          // Partial name match
          else if (
            nameLower.includes(intentLower) ||
            intentLower.includes(nameLower)
          ) {
            score = 80;
          }
          // Tag-based matching
          else if (
            intentLower.includes(tagLower) ||
            tagLower.includes(intentLower)
          ) {
            score = 60;
          }
          // Keyword matching
          else {
            const keywords = intentLower.split(/\s+/);
            for (const keyword of keywords) {
              if (nameLower.includes(keyword) || tagLower.includes(keyword)) {
                score += 20;
              }
            }
          }

          // Boost score for action-appropriate elements
          if (
            action === "click" &&
            (tagLower === "button" || tagLower === "a" || tagLower === "input")
          ) {
            score += 10;
          } else if (
            action === "type" &&
            (tagLower === "input" || tagLower === "textarea")
          ) {
            score += 10;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = affordance;
          }
        }
      }

      if (bestMatch && bestScore > 0) {
        return {
          success: true,
          message: `Found matching element: ${bestMatch.name} (${bestMatch.tag}) with selector: ${bestMatch.selector}`,
          intent,
          action,
          text,
          selectedElement: {
            name: bestMatch.name,
            tag: bestMatch.tag,
            selector: bestMatch.selector,
          },
          confidence:
            bestScore >= 80 ? "high" : bestScore >= 40 ? "medium" : "low",
          matchScore: bestScore,
        };
      } else {
        return {
          success: false,
          message: `No suitable element found for intent: ${intent}`,
          intent,
          action,
          text,
          suggestion:
            "Try being more specific about the element you want to interact with, or check if the element exists on the page",
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        intent,
        action,
        text,
      };
    }
  },
});
