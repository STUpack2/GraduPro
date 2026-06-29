import { RefObject, useEffect, useRef } from "react";

export interface FrameLoopOptions {
  videoRef: RefObject<HTMLVideoElement>;
  active: boolean;
  /** Min ms between frames. 333 = 3 fps. */
  intervalMs?: number;
  /** JPEG quality 0..1. Lower = smaller payload. */
  quality?: number;
  /** Max edge of the captured frame. Larger images waste bandwidth. */
  maxEdge?: number;
  /** Called per captured frame with a data: URL. Must be idempotent — drops
   *  later frames while previous still in-flight. */
  onFrame: (dataUrl: string) => Promise<unknown> | void;
}

export function useFrameLoop({
  videoRef,
  active,
  intervalMs = 333,
  quality = 0.6,
  maxEdge = 720,
  onFrame,
}: FrameLoopOptions) {
  const inflightRef = useRef(false);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (inflightRef.current) return;
      if (now - last < intervalMs) return;
      if (video.readyState < 2) return; // HAVE_CURRENT_DATA
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      last = now;

      const scale = Math.min(1, maxEdge / Math.max(vw, vh));
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      inflightRef.current = true;
      const result = onFrameRef.current(dataUrl);
      if (result && typeof (result as Promise<unknown>).finally === "function") {
        (result as Promise<unknown>).finally(() => {
          inflightRef.current = false;
        });
      } else {
        inflightRef.current = false;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, active, intervalMs, quality, maxEdge]);
}
