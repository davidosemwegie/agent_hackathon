"use client";

import Widget from "@/components/chat/widget";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useState } from "react";
import { Hotkey } from "@/components/ui/hotkey";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  return (
    <div>
      <div className=" w-full flex justify-end p-4 absolute top-0 right-0">
        <Hotkey hint="ctrl+k" onPress={() => setIsWidgetOpen(!isWidgetOpen)} />
      </div>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>
          <div>{children}</div>
        </ResizablePanel>
        {isWidgetOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel maxSize={30}>
              <Widget />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
