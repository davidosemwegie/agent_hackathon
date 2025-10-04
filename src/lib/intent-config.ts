// Intent configuration loader and validator for umbrellamode.json

import umbrellamodeConfig from "../../umbrellamode.json";

export interface IntentFieldSchema {
  type: string;
  required: boolean;
}

export interface IntentActionSchema {
  description: string;
  parameters: Record<string, string>;
}

export interface IntentDefinition {
  fields: Record<string, IntentFieldSchema>;
  actions: Record<string, IntentActionSchema>;
}

export interface IntentConfig {
  intents: Record<string, Record<string, IntentDefinition>>;
}

/**
 * Get intent configuration for a specific category and intent name
 */
export function getIntentConfig(
  category: string,
  intentName: string
): IntentDefinition | null {
  const config = umbrellamodeConfig as IntentConfig;
  return config.intents?.[category]?.[intentName] || null;
}

/**
 * Get all intents for a category
 */
export function getCategoryIntents(
  category: string
): Record<string, IntentDefinition> | null {
  const config = umbrellamodeConfig as IntentConfig;
  return config.intents?.[category] || null;
}

/**
 * Get all available categories
 */
export function getAllCategories(): string[] {
  const config = umbrellamodeConfig as IntentConfig;
  return Object.keys(config.intents || {});
}

/**
 * Validate intent data against configuration
 */
export function validateIntent(
  category: string,
  intentName: string,
  data: Record<string, unknown>
): {
  valid: boolean;
  errors?: string[];
  missingFields?: string[];
} {
  const intentConfig = getIntentConfig(category, intentName);

  if (!intentConfig) {
    return {
      valid: false,
      errors: [`Intent '${intentName}' not found in category '${category}'`],
    };
  }

  const errors: string[] = [];
  const missingFields: string[] = [];

  // Validate required fields
  for (const [fieldName, fieldSchema] of Object.entries(intentConfig.fields)) {
    if (fieldSchema.required && !data[fieldName]) {
      missingFields.push(fieldName);
      errors.push(`Missing required field: ${fieldName}`);
    }

    // Type validation (basic)
    if (data[fieldName] !== undefined) {
      const actualType = typeof data[fieldName];
      const expectedType = fieldSchema.type.toLowerCase();

      if (actualType !== expectedType) {
        errors.push(
          `Field '${fieldName}' should be type '${expectedType}' but got '${actualType}'`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  };
}

/**
 * Match a user request to an intent from configuration
 * Returns the best matching intent based on keywords
 */
export function matchIntentFromUserRequest(
  userRequest: string,
  category?: string
): {
  category: string;
  intentName: string;
  confidence: "high" | "medium" | "low";
  config: IntentDefinition;
} | null {
  const config = umbrellamodeConfig as IntentConfig;
  const requestLower = userRequest.toLowerCase();

  const categoriesToSearch = category
    ? [category]
    : Object.keys(config.intents || {});

  let bestMatch: {
    category: string;
    intentName: string;
    score: number;
    config: IntentDefinition;
  } | null = null;

  for (const cat of categoriesToSearch) {
    const intents = config.intents?.[cat];
    if (!intents) continue;

    for (const [intentName, intentDef] of Object.entries(intents)) {
      let score = 0;

      // Match against intent name
      const intentNameWords = intentName.split("-");
      for (const word of intentNameWords) {
        if (requestLower.includes(word)) {
          score += 30;
        }
      }

      // Match against field names
      for (const fieldName of Object.keys(intentDef.fields)) {
        if (requestLower.includes(fieldName.toLowerCase())) {
          score += 20;
        }
      }

      // Match against action descriptions
      for (const action of Object.values(intentDef.actions)) {
        const descWords = action.description.toLowerCase().split(/\s+/);
        for (const word of descWords) {
          if (word.length > 3 && requestLower.includes(word)) {
            score += 10;
          }
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          category: cat,
          intentName,
          score,
          config: intentDef,
        };
      }
    }
  }

  if (!bestMatch) return null;

  // Determine confidence based on score
  let confidence: "high" | "medium" | "low";
  if (bestMatch.score >= 50) {
    confidence = "high";
  } else if (bestMatch.score >= 30) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    category: bestMatch.category,
    intentName: bestMatch.intentName,
    confidence,
    config: bestMatch.config,
  };
}

/**
 * Extract field values from user request based on intent configuration
 */
export function extractFieldsFromRequest(
  userRequest: string,
  intentConfig: IntentDefinition
): Record<string, string | null> {
  const extracted: Record<string, string | null> = {};

  for (const fieldName of Object.keys(intentConfig.fields)) {
    // Simple extraction - look for field name followed by value
    const pattern = new RegExp(
      `${fieldName}[:\\s]+([^\\s,]+)`,
      "i"
    );
    const match = userRequest.match(pattern);

    if (match && match[1]) {
      extracted[fieldName] = match[1].trim();
    } else {
      extracted[fieldName] = null;
    }
  }

  return extracted;
}

/**
 * Get available actions for an intent
 */
export function getIntentActions(
  category: string,
  intentName: string
): Record<string, IntentActionSchema> | null {
  const intentConfig = getIntentConfig(category, intentName);
  return intentConfig?.actions || null;
}

/**
 * Format intent configuration as human-readable text
 */
export function formatIntentForDisplay(
  category: string,
  intentName: string
): string {
  const intentConfig = getIntentConfig(category, intentName);
  if (!intentConfig) return "Intent not found";

  const lines: string[] = [];
  lines.push(`Intent: ${category}/${intentName}`);
  lines.push(`Fields:`);

  for (const [fieldName, fieldSchema] of Object.entries(intentConfig.fields)) {
    lines.push(
      `  - ${fieldName}: ${fieldSchema.type}${fieldSchema.required ? " (required)" : " (optional)"}`
    );
  }

  lines.push(`Actions:`);
  for (const [actionName, actionSchema] of Object.entries(
    intentConfig.actions
  )) {
    lines.push(`  - ${actionName}: ${actionSchema.description}`);
  }

  return lines.join("\n");
}
