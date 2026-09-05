import type { CSSProperties } from "vue";
import type { HwpxViewerOptions, DocumentMeta } from "../lib/types";
import type { HWPXViewer } from "../lib/HWPXViewer";

export interface JHwpxViewerVueProps extends HwpxViewerOptions {
  /** File object, ArrayBuffer, Uint8Array, or URL string to load */
  file?: File | ArrayBuffer | Uint8Array | string;
  /** Optional file name hint */
  fileName?: string;
  /** Custom CSS class for the wrapper */
  className?: string;
  /** Custom style for the wrapper */
  style?: CSSProperties;
}

export interface JHwpxViewerVueExpose {
  viewer: HWPXViewer | null;
  load: (source: File | ArrayBuffer | Uint8Array | string, name?: string) => Promise<void>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitWidth: () => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  print: () => void;
}

export type { DocumentMeta, HwpxViewerOptions };
