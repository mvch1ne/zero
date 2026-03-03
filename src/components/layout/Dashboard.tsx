// import { EmptyProject } from '@/components/dashboard/EmptyProject';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

export const Dashboard = () => {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel>One</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>Two</ResizablePanel>
    </ResizablePanelGroup>
  );
};
