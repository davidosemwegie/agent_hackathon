// HTML Snapshot collector for providing page context to the agent

export interface PageSnapshot {
  html: string; // Simplified HTML structure
  title: string;
  url: string;
  timestamp: number;
  visibleTextContent: string; // First 5000 chars of visible text
}

/**
 * Collects a simplified snapshot of the current page for the agent
 * This includes cleaned HTML, metadata, and visible text content
 */
export function collectPageSnapshot(): PageSnapshot {
  try {
    // Get simplified HTML (remove scripts, styles, hidden elements)
    const cleanHTML = simplifyHTML(document.body);

    return {
      html: cleanHTML.slice(0, 10000), // Limit to 10KB to control token usage
      title: document.title,
      url: window.location.href,
      timestamp: Date.now(),
      visibleTextContent: getVisibleText().slice(0, 5000), // Limit to 5KB
    };
  } catch (error) {
    console.error("Error collecting page snapshot:", error);
    return {
      html: "",
      title: document.title || "",
      url: window.location.href || "",
      timestamp: Date.now(),
      visibleTextContent: "",
    };
  }
}

/**
 * Simplifies HTML by removing unnecessary elements and attributes
 * while preserving structure and data attributes
 */
function simplifyHTML(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove unnecessary elements that don't contribute to understanding page structure
  clone
    .querySelectorAll("script, style, iframe, noscript, svg, canvas")
    .forEach((el) => el.remove());

  // Remove hidden elements to reduce noise
  clone.querySelectorAll("*").forEach((el) => {
    const htmlEl = el as HTMLElement;
    const style = window.getComputedStyle(htmlEl);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      htmlEl.remove();
    }
  });

  // Get the HTML and clean it up
  let html = clone.innerHTML;

  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Collapse multiple whitespace characters into single space
  html = html.replace(/\s+/g, " ");

  // Remove excessive whitespace between tags
  html = html.replace(/>\s+</g, "><");

  // Trim the result
  html = html.trim();

  return html;
}

/**
 * Extracts visible text content from the page
 * Useful for understanding what the user sees
 */
function getVisibleText(): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip script, style, and hidden elements
        const tagName = parent.tagName.toLowerCase();
        if (["script", "style", "noscript"].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        const style = window.getComputedStyle(parent);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Only include text nodes with actual content
        const text = node.textContent?.trim() || "";
        if (text.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textParts: string[] = [];
  let node;

  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text && text.length > 0) {
      textParts.push(text);
    }
  }

  return textParts.join(" ");
}

/**
 * Gets a compact representation of the page structure
 * showing main semantic elements and their hierarchy
 */
export function getPageStructureSummary(): string {
  const summary: string[] = [];

  // Find main semantic elements
  const main = document.querySelector("main");
  const nav = document.querySelector("nav");
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  const forms = document.querySelectorAll("form");
  const sections = document.querySelectorAll("section");
  const articles = document.querySelectorAll("article");

  if (header) summary.push("- Header section");
  if (nav) summary.push("- Navigation menu");
  if (main) summary.push("- Main content area");
  if (sections.length > 0) summary.push(`- ${sections.length} section(s)`);
  if (articles.length > 0) summary.push(`- ${articles.length} article(s)`);
  if (forms.length > 0) {
    summary.push(`- ${forms.length} form(s)`);
    forms.forEach((form, i) => {
      const inputs = form.querySelectorAll("input, textarea, select");
      if (inputs.length > 0) {
        summary.push(`  Form ${i + 1}: ${inputs.length} input field(s)`);
      }
    });
  }
  if (footer) summary.push("- Footer section");

  return summary.join("\n");
}
