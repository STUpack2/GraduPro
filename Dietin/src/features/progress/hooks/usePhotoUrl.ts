import { useEffect, useState } from "react";
import { useProgressStore } from "@/stores/progressStore";
import { getPhotoUrl } from "@/lib/storageProgress";

export function usePhotoUrl(path: string | undefined): string | undefined {
  const cached = useProgressStore((s) => (path ? s.photoUrlCache[path] : undefined));
  const remember = useProgressStore((s) => s.rememberPhotoUrl);
  const [url, setUrl] = useState<string | undefined>(cached);

  useEffect(() => {
    if (!path) {
      setUrl(undefined);
      return;
    }
    if (cached) {
      setUrl(cached);
      return;
    }
    let cancelled = false;
    getPhotoUrl(path)
      .then((u) => {
        if (cancelled) return;
        setUrl(u);
        remember(path, u);
      })
      .catch((err) => {
        console.warn("getPhotoUrl failed for", path, err);
      });
    return () => {
      cancelled = true;
    };
  }, [path, cached, remember]);

  return url;
}
