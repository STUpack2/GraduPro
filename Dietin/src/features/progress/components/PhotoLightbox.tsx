import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut } from "lucide-react";

export interface PhotoLightboxProps {
  url: string | null;
  alt?: string;
  onClose: () => void;
}

export function PhotoLightbox({ url, alt, onClose }: PhotoLightboxProps) {
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [url, onClose]);

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={onClose}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/90 bg-white/10 hover:bg-white/20 rounded-full p-2"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            <button
              type="button"
              className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
              onClick={(e) => {
                e.stopPropagation();
                setScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))));
              }}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
              onClick={(e) => {
                e.stopPropagation();
                setScale((s) => Math.min(4, Number((s + 0.25).toFixed(2))));
              }}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>
          <div
            ref={wrapperRef}
            className="overflow-auto max-h-[85vh] max-w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={url}
              alt={alt ?? ""}
              draggable={false}
              style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
              className="transition-transform duration-200 select-none"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
