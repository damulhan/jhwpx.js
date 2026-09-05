import { HWPXViewer } from "../lib/HWPXViewer";
import type { DocumentMeta } from "../lib/types";

export class JHwpxViewerElement extends HTMLElement {
  private viewer: HWPXViewer | null = null;
  private isConnectedDOM = false;

  static get observedAttributes(): string[] {
    return ["file", "zoom", "page-gap"];
  }

  constructor() {
    super();
  }

  connectedCallback(): void {
    if (this.isConnectedDOM) return;
    this.isConnectedDOM = true;

    // Ensure styling container
    if (!this.style.display || this.style.display === "inline") {
      this.style.display = "block";
    }
    this.style.position = "relative";
    this.style.overflow = "hidden";

    const initialZoomAttr = this.getAttribute("zoom");
    const initialZoom = initialZoomAttr
      ? !isNaN(Number(initialZoomAttr))
        ? Number(initialZoomAttr)
        : (initialZoomAttr as "fit-width" | "fit-page")
      : "fit-width";

    const pageGapAttr = this.getAttribute("page-gap");
    const pageGap = pageGapAttr && !isNaN(Number(pageGapAttr)) ? Number(pageGapAttr) : 24;

    this.viewer = new HWPXViewer(this, {
      initialZoom,
      pageGap,
      onDocumentLoaded: (meta: DocumentMeta) => {
        this.dispatchEvent(new CustomEvent("document-loaded", { detail: meta, bubbles: true }));
      },
      onPageChange: (page: number, total: number) => {
        this.dispatchEvent(new CustomEvent("page-change", { detail: { page, total }, bubbles: true }));
      },
      onZoomChange: (zoom: number) => {
        this.dispatchEvent(new CustomEvent("zoom-change", { detail: { zoom }, bubbles: true }));
      },
      onError: (err: Error) => {
        this.dispatchEvent(new CustomEvent("error", { detail: err, bubbles: true }));
      },
    });

    const file = this.getAttribute("file");
    if (file) {
      this.load(file);
    }
  }

  disconnectedCallback(): void {
    this.viewer?.destroy();
    this.viewer = null;
    this.isConnectedDOM = false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.viewer || oldValue === newValue) return;

    if (name === "file" && newValue) {
      this.load(newValue);
    } else if (name === "zoom" && newValue) {
      const z = !isNaN(Number(newValue)) ? Number(newValue) : (newValue as "fit-width" | "fit-page");
      this.setZoom(z);
    }
  }

  get instance(): HWPXViewer | null {
    return this.viewer;
  }

  async load(source: File | ArrayBuffer | Uint8Array | string, name?: string): Promise<void> {
    if (!this.viewer) return;

    if (typeof source === "string") {
      try {
        const res = await fetch(source);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const resolvedName = name || source.split("/").pop() || "document.hwpx";
        await this.viewer.load(buf, resolvedName);
      } catch (err: any) {
        this.dispatchEvent(new CustomEvent("error", { detail: err, bubbles: true }));
      }
    } else {
      await this.viewer.load(source, name);
    }
  }

  setZoom(zoom: number | "fit-width" | "fit-page"): void {
    if (zoom === "fit-width") {
      this.fitWidth();
    } else if (zoom === "fit-page") {
      this.viewer?.fitPage();
    } else {
      this.viewer?.setZoom(zoom);
    }
  }

  zoomIn(): void {
    this.viewer?.zoomIn();
  }

  zoomOut(): void {
    this.viewer?.zoomOut();
  }

  resetZoom(): void {
    this.viewer?.resetZoom();
  }

  fitWidth(): void {
    this.viewer?.fitWidth();
  }

  nextPage(): void {
    this.viewer?.nextPage();
  }

  prevPage(): void {
    this.viewer?.prevPage();
  }

  goToPage(page: number): void {
    this.viewer?.goToPage(page);
  }

  print(): void {
    this.viewer?.print();
  }
}

// Automatically register custom element
if (typeof window !== "undefined" && !customElements.get("jhwpx-viewer")) {
  customElements.define("jhwpx-viewer", JHwpxViewerElement);
}

export default JHwpxViewerElement;
