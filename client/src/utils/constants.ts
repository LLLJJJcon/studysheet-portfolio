// Page size constants in mm
export const PAGE_SIZES = {
  A4: { width: 210, height: 297 },
  '16:9': { width: 338, height: 190 },
} as const;

// Margins in mm
export const PAGE_MARGINS = {
  top: 5,
  right: 5,
  bottom: 5,
  left: 5,
} as const;

// Characters per page at default (7pt) font size
export const CHARS_PER_PAGE: Record<string, number> = {
  A4: 6600,
  '16:9': 4200,
};

// DPI for rendering (screen)
export const SCREEN_DPI = 96;

// mm to px conversion factor
export const MM_TO_PX = SCREEN_DPI / 25.4;

// Minimum gap between chunks in px
export const CHUNK_GAP = 4;

// Container box padding in px
export const CONTAINER_PADDING = 8;

// Title bar height in px
export const TITLE_BAR_HEIGHT = 20;
