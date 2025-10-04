import { tool } from "ai";
import z from "zod";
import {
  matchIntentFromUserRequest,
  extractFieldsFromRequest,
  validateIntent,
  formatIntentForDisplay,
  getIntentActions,
} from "@/lib/intent-config";

// Intent understanding tool for parsing user requests into structured actions
export const intentTool = tool({
  description:
    "Parse user intent and extract the action they want to perform and the target element. First checks against defined intents in umbrellamode.json, then falls back to natural language parsing.",
  inputSchema: z.object({
    userRequest: z
      .string()
      .describe(
        "The user's natural language request (e.g., 'click the submit button', 'type my email in the email field', 'update my name to John Doe')"
      ),
    category: z
      .string()
      .optional()
      .describe("Optional intent category to narrow search (e.g., 'settings')"),
  }),
  execute: async ({ userRequest, category }) => {
    try {
      // First, try to match against defined intents in umbrellamode.json
      const intentMatch = matchIntentFromUserRequest(
        userRequest,
        category
      );

      if (intentMatch && intentMatch.confidence !== "low") {
        // Extract field values from the request
        const extractedFields = extractFieldsFromRequest(
          userRequest,
          intentMatch.config
        );

        // Validate extracted data
        const validation = validateIntent(
          intentMatch.category,
          intentMatch.intentName,
          extractedFields as Record<string, unknown>
        );

        // Get available actions for this intent
        const actions = getIntentActions(
          intentMatch.category,
          intentMatch.intentName
        );

        return {
          success: true,
          intentType: "structured",
          category: intentMatch.category,
          intentName: intentMatch.intentName,
          confidence: intentMatch.confidence,
          fields: extractedFields,
          validation: validation,
          actions: actions,
          formattedIntent: formatIntentForDisplay(
            intentMatch.category,
            intentMatch.intentName
          ),
          message: `Matched structured intent: ${intentMatch.category}/${intentMatch.intentName}`,
          originalRequest: userRequest,
        };
      }

      // Fallback to natural language parsing
      const request = userRequest.toLowerCase().trim();

      // Extract action type
      let action:
        | "click"
        | "type"
        | "clear"
        | "focus"
        | "scrollTo"
        | "scrollToTop"
        | "scrollToBottom"
        | "scrollBy"
        | "waitForElement";
      let target: string = "";
      let text: string | undefined;

      // Click actions
      if (
        request.includes("click") ||
        request.includes("press") ||
        request.includes("tap")
      ) {
        action = "click";
        // Extract target after click/press/tap
        const clickMatch = request.match(
          /(?:click|press|tap)\s+(?:the\s+)?(.+?)(?:\s+button|\s+link|\s+element)?$/
        );
        if (clickMatch) {
          target = clickMatch[1].trim();
        } else {
          // Look for button/link keywords
          const buttonMatch = request.match(/(?:button|link|element)\s+(.+)/);
          if (buttonMatch) {
            target = buttonMatch[1].trim();
          }
        }
      }
      // Type actions
      else if (
        request.includes("type") ||
        request.includes("enter") ||
        request.includes("input") ||
        request.includes("fill")
      ) {
        action = "type";
        // Extract text to type
        const typeMatch = request.match(
          /(?:type|enter|input|fill)\s+(.+?)\s+(?:in|into|to)\s+(?:the\s+)?(.+)/
        );
        if (typeMatch) {
          text = typeMatch[1].trim();
          target = typeMatch[2].trim();
        } else {
          // Look for "in the X field" pattern
          const fieldMatch = request.match(
            /(?:type|enter|input|fill)\s+(.+?)\s+(?:in|into)\s+(?:the\s+)?(.+)/
          );
          if (fieldMatch) {
            text = fieldMatch[1].trim();
            target = fieldMatch[2].trim();
          } else {
            // Just extract target if no text specified
            const targetMatch = request.match(
              /(?:type|enter|input|fill)\s+(?:in|into|to)\s+(?:the\s+)?(.+)/
            );
            if (targetMatch) {
              target = targetMatch[1].trim();
            }
          }
        }
      }
      // Clear actions
      else if (
        request.includes("clear") ||
        request.includes("empty") ||
        request.includes("delete")
      ) {
        action = "clear";
        const clearMatch = request.match(
          /(?:clear|empty|delete)\s+(?:the\s+)?(.+)/
        );
        if (clearMatch) {
          target = clearMatch[1].trim();
        }
      }
      // Focus actions
      else if (request.includes("focus") || request.includes("select")) {
        action = "focus";
        const focusMatch = request.match(
          /(?:focus|select)\s+(?:on\s+)?(?:the\s+)?(.+)/
        );
        if (focusMatch) {
          target = focusMatch[1].trim();
        }
      }
      // Scroll actions
      else if (request.includes("scroll")) {
        if (request.includes("to top") || request.includes("up to top")) {
          action = "scrollToTop";
          target = "top of page";
        } else if (
          request.includes("to bottom") ||
          request.includes("down to bottom")
        ) {
          action = "scrollToBottom";
          target = "bottom of page";
        } else if (
          request.includes("to") &&
          !request.includes("top") &&
          !request.includes("bottom")
        ) {
          action = "scrollTo";
          const scrollMatch = request.match(/scroll\s+to\s+(?:the\s+)?(.+)/);
          if (scrollMatch) {
            target = scrollMatch[1].trim();
          }
        } else if (request.includes("down")) {
          action = "scrollBy";
          target = "down";
        } else if (request.includes("up")) {
          action = "scrollBy";
          target = "up";
        } else {
          action = "scrollTo";
          target = "page";
        }
      }
      // Wait actions
      else if (request.includes("wait") || request.includes("find")) {
        action = "waitForElement";
        const waitMatch = request.match(
          /(?:wait\s+for|find)\s+(?:the\s+)?(.+)/
        );
        if (waitMatch) {
          target = waitMatch[1].trim();
        }
      }
      // Default to click if no clear action
      else {
        action = "click";
        target = request;
      }

      // Clean up target description
      target = target
        .replace(/\s+/g, " ")
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/\s+(button|link|field|input|element)$/i, "")
        .trim();

      return {
        success: true,
        intentType: "natural_language",
        message: `Parsed user intent: ${action} ${target}`,
        action,
        target,
        text,
        originalRequest: userRequest,
        confidence: target.length > 0 ? "high" : "medium",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        originalRequest: userRequest,
      };
    }
  },
});
