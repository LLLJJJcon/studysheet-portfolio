// Standard page dimensions in millimeters for A4 and 16:9 formats
export const PAGE_SIZES = {
  A4: { width: 210, height: 297 },
  '16:9': { width: 338, height: 190 },
} as const;

// Page margin offsets in millimeters
export const PAGE_MARGINS = {
  top: 5,
  right: 5,
  bottom: 5,
  left: 5,
} as const;

// Approximate character capacity per page at default 7pt font size
export const CHARS_PER_PAGE: Record<string, number> = {
  A4: 6600,
  '16:9': 4200,
};

// Screen dots per inch used for rendering calculations
export const SCREEN_DPI = 96;

// Conversion factor from millimeters to pixels
export const MM_TO_PX = SCREEN_DPI / 25.4;

// Minimum spacing between adjacent chunks in pixels
export const CHUNK_GAP = 4;

// Inner padding of container boxes in pixels
export const CONTAINER_PADDING = 8;

// Height of the container title bar in pixels
export const TITLE_BAR_HEIGHT = 20;
