export interface HwpxViewerOptions {
  /** Initial scale ratio (e.g. 1.0 for 100%, 'fit-width', or 'fit-page') */
  initialZoom?: number | 'fit-width' | 'fit-page';
  /** Page gap in pixels between A4 sheets */
  pageGap?: number;
  /** Whether to enable smooth transition on zoom */
  animatedZoom?: boolean;
  /** Callback fired when document metadata is loaded */
  onDocumentLoaded?: (info: DocumentMeta) => void;
  /** Callback fired when current active page changes on scroll */
  onPageChange?: (page: number, totalPages: number) => void;
  /** Callback fired when zoom level changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback fired on loading error */
  onError?: (error: Error) => void;
}

export interface DocumentMeta {
  title?: string;
  creator?: string;
  created?: string;
  modified?: string;
  version?: string;
  format: 'hwpx' | 'hwp' | 'hwp3' | 'unknown';
  pageCount: number;
  fileName?: string;
  fileSize?: number;
}

export interface PageLayoutInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
}
