import { AlertTriangle, Loader2, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HealthStatus } from "../hooks/useAIHealth";

export interface ReadinessBannerProps {
  status: HealthStatus;
  onRetry: () => void;
}

export function ReadinessBanner({ status, onRetry }: ReadinessBannerProps) {
  if (status.state === "healthy") return null;

  if (status.state === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-blue-700 dark:text-blue-300 px-3 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Connecting to the AI Coach…</span>
      </div>
    );
  }

  if (status.state === "degraded") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span className="flex-1">
          Coach model is still loading
          {status.data.classifier_error ? `: ${status.data.classifier_error}` : "."}
        </span>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (status.state === "unreachable") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-700 dark:text-rose-300 px-3 py-2 text-sm">
        <Server className="h-4 w-4" />
        <span className="flex-1">AI Coach server unreachable. {status.error}</span>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  return null;
}
