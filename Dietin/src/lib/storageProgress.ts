// Storage helpers for Progress 2.0 photos.
// Path: progressPhotos/{uid}/{weekId}/{view}.jpg + {view}_thumb.jpg
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import type { PhotoAsset, PhotoView, WeekId } from "@/features/progress/types";

const MAX_EDGE = 1600;
const THUMB_EDGE = 320;
const QUALITY = 0.85;

export function photoStoragePath(uid: string, weekId: WeekId, view: PhotoView, kind: "full" | "thumb" = "full"): string {
  const suffix = kind === "thumb" ? `${view}_thumb.jpg` : `${view}.jpg`;
  return `progressPhotos/${uid}/${weekId}/${suffix}`;
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function resizeToBlob(img: HTMLImageElement, maxEdge: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      QUALITY,
    );
  });
  return { blob, width, height };
}

export interface UploadResult {
  full: PhotoAsset;
  thumbUrl: string;
  fullUrl: string;
}

export async function uploadProgressPhoto(
  uid: string,
  weekId: WeekId,
  view: PhotoView,
  file: File,
): Promise<UploadResult> {
  const img = await fileToImage(file);
  const [full, thumb] = await Promise.all([
    resizeToBlob(img, MAX_EDGE),
    resizeToBlob(img, THUMB_EDGE),
  ]);
  const fullRef = ref(storage, photoStoragePath(uid, weekId, view, "full"));
  const thumbRef = ref(storage, photoStoragePath(uid, weekId, view, "thumb"));
  await Promise.all([
    uploadBytes(fullRef, full.blob, { contentType: "image/jpeg" }),
    uploadBytes(thumbRef, thumb.blob, { contentType: "image/jpeg" }),
  ]);
  const [fullUrl, thumbUrl] = await Promise.all([
    getDownloadURL(fullRef),
    getDownloadURL(thumbRef),
  ]);
  return {
    fullUrl,
    thumbUrl,
    full: {
      path: photoStoragePath(uid, weekId, view, "full"),
      thumbPath: photoStoragePath(uid, weekId, view, "thumb"),
      width: full.width,
      height: full.height,
    },
  };
}

export async function deleteProgressPhoto(uid: string, weekId: WeekId, view: PhotoView): Promise<void> {
  await Promise.allSettled([
    deleteObject(ref(storage, photoStoragePath(uid, weekId, view, "full"))),
    deleteObject(ref(storage, photoStoragePath(uid, weekId, view, "thumb"))),
  ]);
}

export async function getPhotoUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}
