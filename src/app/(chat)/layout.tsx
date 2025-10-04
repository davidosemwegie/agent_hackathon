"use client";

import { ConversationHistory } from "@/components/conversation-history/conversation-history";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { useState } from "react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        <ConversationHistory
          userId="default-user"
          currentConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={80}>
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
