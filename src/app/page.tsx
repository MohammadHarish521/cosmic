import { MissionConsole } from "@/components/shell/MissionConsole";
import { MissionProvider } from "@/state/mission-store";

export default function Page() {
  return (
    <MissionProvider>
      <MissionConsole />
    </MissionProvider>
  );
}
