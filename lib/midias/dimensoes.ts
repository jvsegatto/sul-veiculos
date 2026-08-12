import type { MediaDimensions, MediaType } from "@/lib/types"

export const STORY_DIMENSIONS: MediaDimensions = { width: 1080, height: 1920, aspectRatio: "9:16" }
export const POST_DIMENSIONS: MediaDimensions = { width: 1080, height: 1440, aspectRatio: "3:4" }
export const CAROUSEL_SLIDE_COUNT = 5
export const CAROUSEL_DIMENSIONS: MediaDimensions = {
  width: 1080,
  height: 1440,
  aspectRatio: "3:4",
  slideCount: CAROUSEL_SLIDE_COUNT,
}

export function getDimensionsForType(type: MediaType): MediaDimensions {
  if (type === "story") return STORY_DIMENSIONS
  if (type === "carousel") return CAROUSEL_DIMENSIONS
  return POST_DIMENSIONS
}
