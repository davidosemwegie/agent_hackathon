import Widget from "@/components/chat/widget";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel>
        <div>{children}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel maxSize={30}>
        <Widget />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
