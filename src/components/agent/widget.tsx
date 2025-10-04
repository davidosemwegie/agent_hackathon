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
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Response } from "@/components/ai-elements/response";
import { DefaultChatTransport } from "ai";
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
// Additional AI SDK components available for future use:
// import { Image } from "@/components/ai-elements/image";
// import { Artifact, ArtifactHeader, ArtifactTitle, ArtifactContent } from "@/components/ai-elements/artifact";
// import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/sources";
// import { ChainOfThought, ChainOfThoughtContent } from "@/components/ai-elements/chain-of-thought";

const Widget = () => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      body: {
        currentDate: new Date().toISOString().split("T")[0],
      },
    }),
  });

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
    <div className="size-full p-4 pt-10">
      <div className="flex flex-col h-full">
        {/* Messages area - takes remaining space and scrolls */}
        <div className="flex-1 min-h-0">
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
                          return (
                            <Reasoning
                              key={`${message.id}-${i}`}
                              isStreaming={status === "streaming"}
                              defaultOpen={true}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>
                                {String(
                                  (part as Record<string, unknown>).content ||
                                    (part as Record<string, unknown>)
                                      .reasoning ||
                                    "Thinking..."
                                )}
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
        </div>

        {/* Input area - fixed at bottom */}
        <div className="flex-shrink-0 mt-4">
          <PromptInput
            onSubmit={handleSubmit}
            className="w-full max-w-2xl mx-auto relative"
          >
            <PromptInputTextarea
              value={input}
              placeholder="Say something..."
              onChange={(e) => setInput(e.currentTarget.value)}
              className="pr-12"
            />
            <PromptInputSubmit
              status={status === "streaming" ? "streaming" : "ready"}
              disabled={!input.trim()}
              className="absolute bottom-1 right-1"
            />
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default Widget;
