import { Setup } from "../pages/Setup";
import { ProgressSplash } from "./ProgressSplash";
import { useStatus } from "./StatusProvider";

export function SetupGate({ children }: { children: React.ReactNode }) {
  const { phase } = useStatus();

  // Only the very first fast detect blocks the UI. ~100ms.
  if (phase === "loading-fast" || phase === "error") {
    return <ProgressSplash />;
  }

  // Hard gate only when Claude isn't installed at all.
  if (phase === "needs-install") {
    return <Setup />;
  }

  // Logged-in status is verified passively in the background.
  // Banner + footer pill keep the user informed without blocking.
  return <>{children}</>;
}
