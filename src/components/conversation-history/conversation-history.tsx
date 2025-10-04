"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Trash2, MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationHistoryProps {
  userId?: string;
  onSelectConversation?: (conversationId: string) => void;
  currentConversationId?: string;
}

export function ConversationHistory({
  userId = "default-user",
  onSelectConversation,
  currentConversationId,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations?userId=${userId}`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [userId]);

  const deleteConversation = async (conversationId: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      loadConversations();
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Conversations</h2>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageSquare className="size-12 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group flex items-center justify-between p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                  currentConversationId === conversation.id
                    ? "bg-blue-100 border border-blue-300"
                    : "hover:bg-gray-100 border border-transparent"
                }`}
                onClick={() => onSelectConversation?.(conversation.id)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {conversation.title || "Untitled"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatDate(conversation.updated_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onSelectConversation?.(undefined as any)}
        >
          + New Conversation
        </Button>
      </div>
    </div>
  );
}
