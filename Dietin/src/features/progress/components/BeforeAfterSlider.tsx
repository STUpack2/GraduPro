import { useState, useRef, useCallback } from "react";

export interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({ beforeUrl, afterUrl, beforeLabel, afterLabel }: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 dark:bg-bg-card select-none touch-none"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === "mouse") return;
        updateFromClientX(e.clientX);
      }}
    >
      <img src={afterUrl} alt={afterLabel ?? "after"} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={beforeUrl} alt={beforeLabel ?? "before"} className="absolute inset-0 h-full w-[200%] object-cover" style={{ left: 0 }} draggable={false} />
      </div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md pointer-events-none" style={{ left: `${pos}%` }} aria-hidden>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-white text-gray-700 flex items-center justify-center shadow-lg text-xs font-semibold">⇆</div>
      </div>
      {beforeLabel && (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-black/50 text-white px-2 py-0.5 rounded-full">
          {beforeLabel}
        </span>
      )}
      {afterLabel && (
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide bg-black/50 text-white px-2 py-0.5 rounded-full">
          {afterLabel}
        </span>
      )}
    </div>
  );
}
