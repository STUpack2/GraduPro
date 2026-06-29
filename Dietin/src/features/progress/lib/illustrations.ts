import frontSvg from "./illustrations/front.svg?raw";
import sideSvg from "./illustrations/side.svg?raw";
import backSvg from "./illustrations/back.svg?raw";
import type { PhotoView } from "../types";

const SVGS: Record<PhotoView, string> = {
  front: frontSvg,
  side: sideSvg,
  back: backSvg,
};

export function silhouetteHtml(view: PhotoView): string {
  return SVGS[view];
}
