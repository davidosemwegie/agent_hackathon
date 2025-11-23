"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Response } from "@/components/ai-elements/response";
import { DefaultChatTransport } from "ai";
import { Actor } from "../../../director/actor";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { collectAffordances } from "./find-affordances";
import { collectPageSnapshot } from "./collect-html-snapshot";
import { FeedbackWidget } from "@/components/feedback-widget/feedback-widget";
// Additional AI SDK components available for future use:
// import { Image } from "@/components/ai-elements/image";
// import { Artifact, ArtifactHeader, ArtifactTitle, ArtifactContent } from "@/components/ai-elements/artifact";
// import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/sources";
// import { ChainOfThought, ChainOfThoughtContent } from "@/components/ai-elements/chain-of-thought";

// Using the existing Actor class from director/actor.ts

const Widget = () => {
  const [input, setInput] = useState("");
  const [executingActions, setExecutingActions] = useState<Set<string>>(
    new Set()
  );
  const [completedActions, setCompletedActions] = useState<Set<string>>(
    new Set()
  );
  const [conversationId] = useState<string | undefined>();
  const [userId] = useState("default-user"); // TODO: Get from actual user context
  const [showFeedback, setShowFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "http://localhost:8000/agent/chat",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        affordances: collectAffordances(),
        pageSnapshot: collectPageSnapshot(),
        conversationId,
        userId,
      },
    }),
  });

  // Make Actor class available globally
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).Actor = Actor;
    }
  }, []);

  // Reset execution state when starting a new conversation
  useEffect(() => {
    if (messages.length === 0) {
      setExecutingActions(new Set());
      setCompletedActions(new Set());
    }
  }, [messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    };

    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

  // Auto-scroll to bottom when actions are executing
  useEffect(() => {
    if (executingActions.size > 0) {
      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      };
      scrollToBottom();
    }
  }, [executingActions]);

  // Execute actor actions when they're received using the existing Actor class
  useEffect(() => {
    const executeActorAction = async (
      actionData: Record<string, unknown>,
      actionId: string
    ) => {
      if (!actionData.executable) {
        return;
      }

      // Check if this action is already executing or completed
      if (executingActions.has(actionId) || completedActions.has(actionId)) {
        console.log(`⏭️ Action ${actionId} already processed, skipping`);
        return;
      }

      // Mark action as executing
      setExecutingActions((prev) => new Set(prev).add(actionId));
      console.log(`🔄 Starting execution of action: ${actionId}`);

      try {
        const actor = new Actor();
        const { actorMethod, actorParams } = actionData;

        // Use the actorMethod and actorParams returned by the tool
        if (actorMethod && actorParams) {
          // Call the appropriate method on the Actor instance
          const method = (actor as unknown as Record<string, unknown>)[
            actorMethod as string
          ];
          if (typeof method === "function") {
            // Smart parameter construction to handle complex objects properly
            const params = actorParams as Record<string, unknown>;
            const paramsList: unknown[] = [];

            // Build parameter list in the correct order for the method
            if (params.selector) paramsList.push(params.selector);
            if (params.text !== undefined) paramsList.push(params.text);
            if (params.x !== undefined) paramsList.push(params.x);
            if (params.y !== undefined) paramsList.push(params.y);
            if (params.timeout !== undefined) paramsList.push(params.timeout);
            if (params.simulateTyping !== undefined)
              paramsList.push(params.simulateTyping);
            if (params.scrollOptions !== undefined)
              paramsList.push(params.scrollOptions);

            const result = await method.call(actor, ...paramsList);
            console.log(
              `✅ Actor action '${actorMethod}' completed successfully`,
              result
            );
          } else {
            console.error(
              `❌ Method '${actorMethod}' not found on Actor class`
            );
          }
        } else {
          // Fallback to the old format for backward compatibility
          const {
            action,
            selector,
            text,
            x,
            y,
            timeout,
            simulateTyping,
            scrollOptions,
          } = actionData;

          switch (action) {
            case "click":
              await actor.click(selector as string);
              console.log(`✅ Clicked element: ${selector}`);
              break;
            case "type":
              await actor.type(
                selector as string,
                text as string,
                simulateTyping as boolean
              );
              console.log(`✅ Typed "${text}" into ${selector}`);
              break;
            case "typeFast":
              await actor.typeFast(selector as string, text as string);
              console.log(`✅ Fast typed "${text}" into ${selector}`);
              break;
            case "clear":
              await actor.clear(selector as string);
              console.log(`✅ Cleared element: ${selector}`);
              break;
            case "waitForElement":
              await actor.waitForElement(selector as string, timeout as number);
              console.log(`✅ Found element: ${selector}`);
              break;
            case "scrollTo":
              await actor.scrollTo((x as number) || 0, (y as number) || 0);
              console.log(`✅ Scrolled to position (${x || 0}, ${y || 0})`);
              break;
            case "scrollToTop":
              await actor.scrollToTop();
              console.log(`✅ Scrolled to top of page`);
              break;
            case "scrollToBottom":
              await actor.scrollToBottom();
              console.log(`✅ Scrolled to bottom of page`);
              break;
            case "scrollBy":
              await actor.scrollBy((x as number) || 0, (y as number) || 0);
              console.log(`✅ Scrolled by (${x || 0}, ${y || 0})`);
              break;
            case "scrollToElement":
              await actor.scrollToElement(
                selector as string,
                (scrollOptions as ScrollIntoViewOptions) || {}
              );
              console.log(`✅ Scrolled to element: ${selector}`);
              break;
            case "scrollToElementTop":
              await actor.scrollToElementTop(selector as string);
              console.log(`✅ Scrolled element to top: ${selector}`);
              break;
            case "scrollToElementBottom":
              await actor.scrollToElementBottom(selector as string);
              console.log(`✅ Scrolled element to bottom: ${selector}`);
              break;
            case "scrollPageDown":
              await actor.scrollPageDown();
              console.log(`✅ Scrolled down one page`);
              break;
            case "scrollPageUp":
              await actor.scrollPageUp();
              console.log(`✅ Scrolled up one page`);
              break;
            case "focus":
              actor.focus(selector as string);
              console.log(`✅ Focused element: ${selector}`);
              break;
            case "blur":
              actor.blur(selector as string);
              console.log(`✅ Blurred element: ${selector}`);
              break;
            default:
              console.warn(`⚠️ Unknown actor action: ${action}`);
          }
        }

        // Mark action as completed
        setCompletedActions((prev) => new Set(prev).add(actionId));
        console.log(`✅ Action ${actionId} completed successfully`);

        // Add a small delay to ensure proper sequencing
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Actor action ${actionId} failed:`, error);
      } finally {
        // Remove from executing set
        setExecutingActions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(actionId);
          return newSet;
        });
      }
    };

    // Check for actor tool calls in the latest message
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.role === "assistant") {
      latestMessage.parts.forEach((part, partIndex) => {
        if (part.type.startsWith("tool-") && "output" in part && part.output) {
          const output = part.output as Record<string, unknown>;

          // Check if feedback tool was used
          if (part.type === "tool-feedback" && output.showFeedbackWidget) {
            setShowFeedback(true);
          }

          if (output.executable && (output.action || output.actorMethod)) {
            // Create a unique action ID based on message ID and part index
            const actionId = `${latestMessage.id}-${partIndex}`;
            executeActorAction(output, actionId);
          }
        }
      });
    }
  }, [messages, executingActions, completedActions]);

  const handleSubmit = (
    message: { text?: string; files?: unknown[] },
    e: React.FormEvent
  ) => {
    e.preventDefault();
    if (message.text?.trim()) {
      sendMessage({
        text: message.text,
      });
      setInput("");
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 overflow-hidden p-4 pt-10  max-h-[calc(100svh-6rem)] overflow-y-auto">
        {/* Messages area - takes remaining space and scrolls */}
        <div className="h-full">
          <Conversation>
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={<MessageSquare className="size-12" />}
                  title="Start a conversation"
                  description="Type a message below to begin chatting"
                />
              ) : (
                messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, i) => {
                        // Handle different message part types
                        if (part.type === "text") {
                          return (
                            <Response key={`${message.id}-${i}`}>
                              {part.text}
                            </Response>
                          );
                        }

                        if (part.type === "reasoning") {
                          const reasoningContent = String(
                            (part as Record<string, unknown>).content ||
                              (part as Record<string, unknown>).reasoning ||
                              "Thinking..."
                          );

                          return (
                            <Reasoning
                              key={`${message.id}-${i}`}
                              isStreaming={status === "streaming"}
                              defaultOpen={true}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>
                                {reasoningContent}
                              </ReasoningContent>
                            </Reasoning>
                          );
                        }

                        // Handle tool calls (any tool-* type)
                        if (part.type.startsWith("tool-") && "state" in part) {
                          const toolPart = part as Record<string, unknown>;
                          return (
                            <Tool
                              key={`${message.id}-${i}`}
                              defaultOpen={
                                toolPart.state === "output-available"
                              }
                            >
                              <ToolHeader
                                title={part.type.split("-").slice(1).join("-")}
                                type={part.type as `tool-${string}`}
                                state={
                                  toolPart.state as
                                    | "input-streaming"
                                    | "input-available"
                                    | "output-available"
                                    | "output-error"
                                }
                              />
                              <ToolContent>
                                <ToolInput input={toolPart.input} />
                                <ToolOutput
                                  output={toolPart.output}
                                  errorText={
                                    toolPart.errorText as string | undefined
                                  }
                                />
                              </ToolContent>
                            </Tool>
                          );
                        }

                        // Handle step markers and other non-renderable types
                        if (part.type === "step-start") {
                          return null;
                        }

                        // Fallback for unknown types - show debug info in development
                        if (process.env.NODE_ENV === "development") {
                          return (
                            <div
                              key={`${message.id}-${i}`}
                              className="my-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs"
                            >
                              <strong>Unknown part type:</strong> {part.type}
                              <pre className="mt-1 text-xs overflow-auto">
                                {JSON.stringify(part, null, 2)}
                              </pre>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </MessageContent>
                  </Message>
                ))
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>

        {/* Feedback Widget */}
        {showFeedback && conversationId && messages.length > 0 && (
          <div className="mt-4">
            <FeedbackWidget
              conversationId={conversationId}
              userId={userId}
              onSubmit={() => setShowFeedback(false)}
            />
          </div>
        )}
      </div>

      {/* Input area - fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-red-500">
        <PromptInput
          onSubmit={handleSubmit}
          className="w-full max-w-2xl mx-auto relative"
        >
          <PromptInputTextarea
            value={input}
            placeholder={
              status === "streaming" || executingActions.size > 0
                ? executingActions.size > 0
                  ? "Executing actions..."
                  : "Agent is thinking and working..."
                : "Say something..."
            }
            onChange={(e) => setInput(e.currentTarget.value)}
            className="pr-12"
            disabled={status === "streaming" || executingActions.size > 0}
          />
          <PromptInputSubmit
            status={
              status === "streaming" || executingActions.size > 0
                ? "streaming"
                : "ready"
            }
            disabled={
              !input.trim() ||
              status === "streaming" ||
              executingActions.size > 0
            }
            className="absolute bottom-1 right-1"
          />
        </PromptInput>

        {/* Status indicator */}
        {(status === "streaming" || executingActions.size > 0) && (
          <div className="text-center mt-2 text-sm text-gray-500">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              <span>
                {executingActions.size > 0
                  ? `Executing ${executingActions.size} action${
                      executingActions.size > 1 ? "s" : ""
                    }...`
                  : "Agent is working through the steps..."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Widget;
