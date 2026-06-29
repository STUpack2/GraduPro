import { forwardRef, useEffect, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CameraViewProps {
  active: boolean;
  /** Optional annotated frame data URL from the backend; overlays the raw video. */
  annotatedFrame?: string | null;
  facingMode?: "user" | "environment";
  className?: string;
  onPermissionDenied?: (err: Error) => void;
  onReady?: (stream: MediaStream) => void;
}

export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(function CameraView(
  { active, annotatedFrame, facingMode = "user", className, onPermissionDenied, onReady },
  ref,
) {
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        const got = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          got.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = got;
        const node = (ref as React.MutableRefObject<HTMLVideoElement | null>)?.current;
        if (node) {
          node.srcObject = got;
          node.play().catch(() => undefined);
        }
        setStreaming(true);
        setError(null);
        onReady?.(got);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message);
        onPermissionDenied?.(e);
      }
    })();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const node = (ref as React.MutableRefObject<HTMLVideoElement | null>)?.current;
      if (node) {
        try { (node.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop()); } catch {}
        node.srcObject = null;
      }
      setStreaming(false);
    };
  }, [active, facingMode, ref, onReady, onPermissionDenied]);

  return (
    <div className={cn("relative aspect-video rounded-2xl overflow-hidden bg-black", className)}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      {annotatedFrame && (
        <img
          src={annotatedFrame}
          alt="pose overlay"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-90"
        />
      )}
      {!streaming && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2">
          <Camera className="h-8 w-8" />
          <span className="text-sm">{active ? "Requesting camera…" : "Camera off"}</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center bg-black/70">
          <CameraOff className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">Camera unavailable</p>
          <p className="text-xs text-white/70 mt-1">{error}</p>
          <p className="text-xs text-white/70 mt-2">Grant camera permission in your browser, then reload.</p>
        </div>
      )}
    </div>
  );
});
