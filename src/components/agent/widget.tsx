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
                        switch (part.type) {
                          case "text": // we don't use any reasoning or tool calls in this example
                            return (
                              <Response key={`${message.id}-${i}`}>
                                {part.text}
                              </Response>
                            );
                          default:
                            return null;
                        }
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
