import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PhotoView } from "@/features/progress/types";

export interface PhotoUploaderProps {
  view: PhotoView;
  existingUrl?: string;
  busy?: boolean;
  onUpload: (file: File) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  placeholder?: React.ReactNode;
}

export function PhotoUploader({ view, existingUrl, busy, onUpload, onDelete, placeholder }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  const handleFile = async (file: File) => {
    setPending(true);
    try {
      await onUpload(file);
    } finally {
      setPending(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    onDrop: (files) => files[0] && handleFile(files[0]),
  });

  const busyState = busy || pending;
  const labelMap: Record<PhotoView, string> = { front: "Front", side: "Side", back: "Back" };

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "relative aspect-[3/4] rounded-2xl border-2 border-dashed transition-colors flex items-center justify-center overflow-hidden",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-bg-card",
        )}
      >
        <input {...getInputProps()} />
        {existingUrl ? (
          <img src={existingUrl} alt={labelMap[view]} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          placeholder ?? (
            <div className="flex flex-col items-center text-gray-400 dark:text-text-muted gap-2 px-3 text-center">
              <ImageUp className="h-7 w-7" />
              <span className="text-xs">Tap to add {labelMap[view].toLowerCase()} photo</span>
            </div>
          )
        )}
        {busyState && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-black/60 text-white px-2 py-0.5 rounded-full">
          {labelMap[view]}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-1.5" /> {existingUrl ? "Replace" : "Capture"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f).finally(() => (inputRef.current!.value = ""));
          }}
        />
        {existingUrl && onDelete && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDelete()}
            className="text-rose-500 hover:text-rose-600"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
