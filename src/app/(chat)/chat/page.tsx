"use client";

import Widget from "@/components/agent/widget";

// Force dynamic rendering to avoid SSR issues
export const dynamic = "force-dynamic";

export default function ChatPage() {
  return <Widget />;
}
