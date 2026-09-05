import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { HWPXViewer } from "../lib/HWPXViewer";
import type { HwpxViewerOptions } from "../lib/types";

export interface JHwpxViewerProps extends HwpxViewerOptions {
  /** File object, ArrayBuffer, Uint8Array, or URL string to load */
  file?: File | ArrayBuffer | Uint8Array | string;
  /** Optional file name hint */
  fileName?: string;
  /** Custom CSS class for the wrapper */
  className?: string;
  /** Custom style for the wrapper */
  style?: React.CSSProperties;
}

export interface JHwpxViewerRef {
  viewer: HWPXViewer | null;
  load: (source: File | ArrayBuffer | Uint8Array, name?: string) => Promise<void>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitWidth: () => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  print: () => void;
}

export const JHwpxViewer = forwardRef<JHwpxViewerRef, JHwpxViewerProps>(
  ({ file, fileName, className, style, initialZoom, pageGap, animatedZoom, onDocumentLoaded, onPageChange, onZoomChange, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerInstanceRef = useRef<HWPXViewer | null>(null);

    // Expose control methods via ref
    useImperativeHandle(ref, () => ({
      get viewer() {
        return viewerInstanceRef.current;
      },
      load: async (source, name) => {
        if (viewerInstanceRef.current) {
          await viewerInstanceRef.current.load(source, name);
        }
      },
      zoomIn: () => viewerInstanceRef.current?.zoomIn(),
      zoomOut: () => viewerInstanceRef.current?.zoomOut(),
      resetZoom: () => viewerInstanceRef.current?.resetZoom(),
      fitWidth: () => viewerInstanceRef.current?.fitWidth(),
      nextPage: () => viewerInstanceRef.current?.nextPage(),
      prevPage: () => viewerInstanceRef.current?.prevPage(),
      goToPage: (p) => viewerInstanceRef.current?.goToPage(p),
      print: () => viewerInstanceRef.current?.print(),
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const viewer = new HWPXViewer(containerRef.current, {
        initialZoom,
        pageGap,
        animatedZoom,
        onDocumentLoaded,
        onPageChange,
        onZoomChange,
        onError,
      });
      viewerInstanceRef.current = viewer;

      return () => {
        viewer.destroy();
        viewerInstanceRef.current = null;
      };
    }, []);

    // Load file on change
    useEffect(() => {
      if (!file || !viewerInstanceRef.current) return;

      if (typeof file === "string") {
        fetch(file)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          })
          .then((buf) => {
            const name = fileName || file.split("/").pop() || "document.hwpx";
            viewerInstanceRef.current?.load(buf, name);
          })
          .catch((err) => {
            onError?.(err);
          });
      } else {
        viewerInstanceRef.current.load(file, fileName);
      }
    }, [file, fileName]);

    return (
      <div
        ref={containerRef}
        className={`jhwpx-react-container ${className || ""}`}
        style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", ...style }}
      />
    );
  }
);

JHwpxViewer.displayName = "JHwpxViewer";
