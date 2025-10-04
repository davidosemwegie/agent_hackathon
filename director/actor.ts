// const ActionType = {
//   CLICK: "click",
//   TYPE: "type",
//   SCROLL: "scroll",
//   SCROLL_TO: "scrollTo",
//   SCROLL_BY: "scrollBy",
//   SCROLL_TO_ELEMENT: "scrollToElement",
// };

// type ActionType = (typeof ActionType)[keyof typeof ActionType];

export class Actor {
  async click(selector: string) {
    // Find the element using native DOM methods
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found with selector: ${selector}`);
    }

    // Focus the element first to ensure it's interactive
    if (element instanceof HTMLElement) {
      element.focus();
    }

    // Create and dispatch a click event
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });

    element.dispatchEvent(clickEvent);
  }

  async type(selector: string, text: string, simulateTyping: boolean = false) {
    // Find the element using native DOM methods
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found with selector: ${selector}`);
    }

    // Focus the element first
    if (element instanceof HTMLElement) {
      element.focus();
    }

    // Handle different types of input elements
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      // Store native setter to bypass React's setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;

      if (simulateTyping) {
        // Clear existing content first
        if (element instanceof HTMLInputElement && nativeInputValueSetter) {
          nativeInputValueSetter.call(element, "");
        } else if (
          element instanceof HTMLTextAreaElement &&
          nativeTextAreaValueSetter
        ) {
          nativeTextAreaValueSetter.call(element, "");
        }

        // Simulate typing character by character
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (!char) continue;

          const currentValue = element.value;
          const newValue = currentValue + char;

          // Use native setter to bypass React
          if (element instanceof HTMLInputElement && nativeInputValueSetter) {
            nativeInputValueSetter.call(element, newValue);
          } else if (
            element instanceof HTMLTextAreaElement &&
            nativeTextAreaValueSetter
          ) {
            nativeTextAreaValueSetter.call(element, newValue);
          }

          // Dispatch input event
          const inputEvent = new InputEvent("input", {
            data: char,
            inputType: "insertText",
            bubbles: true,
            cancelable: true,
          });
          element.dispatchEvent(inputEvent);

          // Small delay to simulate human typing
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else {
        // Fast typing - set value directly using native setter
        if (element instanceof HTMLInputElement && nativeInputValueSetter) {
          nativeInputValueSetter.call(element, text);
        } else if (
          element instanceof HTMLTextAreaElement &&
          nativeTextAreaValueSetter
        ) {
          nativeTextAreaValueSetter.call(element, text);
        }

        // Dispatch input event
        const inputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(inputEvent);
      }

      // Dispatch final change event
      const changeEvent = new Event("change", {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(changeEvent);
    } else if (
      element instanceof HTMLElement &&
      element.contentEditable === "true"
    ) {
      // Handle contenteditable elements
      element.textContent = "";

      if (simulateTyping) {
        // Simulate typing character by character for contenteditable
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (!char) continue;

          // Add the character to the current text content
          element.textContent += char;

          // Dispatch input event with the character data
          const inputEvent = new InputEvent("input", {
            data: char,
            inputType: "insertText",
            bubbles: true,
            cancelable: true,
          });
          element.dispatchEvent(inputEvent);

          // Small delay to simulate human typing
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else {
        // Fast typing - set text content directly
        element.textContent = text;

        // Dispatch input event
        const inputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(inputEvent);
      }
    } else {
      throw new Error(
        `Element with selector "${selector}" is not a supported input element (input, textarea, or contenteditable)`
      );
    }
  }

  async clear(selector: string) {
    // Clear the content of an input element
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found with selector: ${selector}`);
    }

    if (element instanceof HTMLElement) {
      element.focus();
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.value = "";

      // Dispatch events to notify of the change
      const inputEvent = new Event("input", {
        bubbles: true,
        cancelable: true,
      });

      const changeEvent = new Event("change", {
        bubbles: true,
        cancelable: true,
      });

      element.dispatchEvent(inputEvent);
      element.dispatchEvent(changeEvent);
    } else if (
      element instanceof HTMLElement &&
      element.contentEditable === "true"
    ) {
      element.textContent = "";

      const inputEvent = new Event("input", {
        bubbles: true,
        cancelable: true,
      });

      element.dispatchEvent(inputEvent);
    } else {
      throw new Error(
        `Element with selector "${selector}" is not a supported input element (input, textarea, or contenteditable)`
      );
    }
  }

  async waitForElement(
    selector: string,
    timeout: number = 5000
  ): Promise<Element> {
    // Wait for an element to appear in the DOM
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Set timeout
      setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            `Element with selector "${selector}" not found within ${timeout}ms`
          )
        );
      }, timeout);
    });
  }

  async scrollTo(x: number, y: number) {
    // Scroll to specific coordinates
    window.scrollTo(x, y);
  }

  async scrollToTop() {
    // Scroll to the top of the page
    window.scrollTo(0, 0);
  }

  async scrollToBottom() {
    // Scroll to the bottom of the page
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  async scrollBy(x: number, y: number) {
    // Scroll by relative amounts
    window.scrollBy(x, y);
  }

  async scrollToElement(selector: string, options: ScrollIntoViewOptions = {}) {
    // Scroll an element into view
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found with selector: ${selector}`);
    }

    // Default scroll options for smooth behavior
    const defaultOptions: ScrollIntoViewOptions = {
      behavior: "smooth",
      block: "center",
      inline: "center",
      ...options,
    };

    element.scrollIntoView(defaultOptions);
  }

  async scrollToElementTop(selector: string) {
    // Scroll element to the top of the viewport
    await this.scrollToElement(selector, { block: "start" });
  }

  async scrollToElementBottom(selector: string) {
    // Scroll element to the bottom of the viewport
    await this.scrollToElement(selector, { block: "end" });
  }

  async scrollPageDown() {
    // Scroll down by one viewport height
    const viewportHeight = window.innerHeight;
    await this.scrollBy(0, viewportHeight);
  }

  async scrollPageUp() {
    // Scroll up by one viewport height
    const viewportHeight = window.innerHeight;
    await this.scrollBy(0, -viewportHeight);
  }

  getScrollPosition(): { x: number; y: number } {
    // Get current scroll position
    return {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop,
    };
  }

  isElementInViewport(selector: string): boolean {
    // Check if an element is currently visible in the viewport
    const element = document.querySelector(selector);

    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const windowWidth =
      window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= windowHeight &&
      rect.right <= windowWidth
    );
  }

  focus(selector: string) {
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found with selector: ${selector}`);
    }
  }

  blur(selector: string) {
    const element = document.querySelector(selector);

    if (!element) {
      throw new Error(`Element not found with selector: ${selector}`);
    }
  }

  // Convenience method for fast typing (no simulation)
  async typeFast(selector: string, text: string) {
    return this.type(selector, text, false);
  }
}
