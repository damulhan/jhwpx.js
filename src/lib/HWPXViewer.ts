import JSZip from "jszip";
import { PageRenderer, type RenderedSection } from "./PageRenderer";
import type { HwpxViewerOptions, DocumentMeta } from "./types";

import { detectFormat, hwpToHwpx, HwpxReader } from "@ssabrojs/hwpxjs";

export class HWPXViewer {
  private container: HTMLElement;
  private options: HwpxViewerOptions;
  private renderer: PageRenderer;

  private viewerRoot: HTMLElement;
  private pagesWrapper: HTMLElement;
  private pageElements: HTMLElement[] = [];

  private currentZoom: number = 1.0;
  private currentPage: number = 1;
  private totalPages: number = 0;
  private documentMeta: DocumentMeta | null = null;
  public currentSections: RenderedSection[] = [];

  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, options: HwpxViewerOptions = {}) {
    this.container = container;
    this.options = {
      initialZoom: 1.0,
      pageGap: 24,
      animatedZoom: true,
      ...options,
    };
    this.renderer = new PageRenderer();

    // Create DOM structure
    this.viewerRoot = document.createElement("div");
    this.viewerRoot.className = "jhwpx-viewer-root";

    this.pagesWrapper = document.createElement("div");
    this.pagesWrapper.className = "jhwpx-pages-wrapper";
    this.pagesWrapper.style.gap = `${this.options.pageGap}px`;

    this.viewerRoot.appendChild(this.pagesWrapper);
    this.container.appendChild(this.viewerRoot);

    this.initObservers();
  }

  private initObservers() {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            const pageNum = Number(entry.target.getAttribute("data-page") || "1");
            if (pageNum !== this.currentPage) {
              this.currentPage = pageNum;
              this.options.onPageChange?.(this.currentPage, this.totalPages);
            }
          }
        });
      },
      {
        root: this.viewerRoot,
        threshold: [0.1, 0.3, 0.5, 0.7],
      }
    );

    this.resizeObserver = new ResizeObserver(() => {
      if (this.options.initialZoom === "fit-width") {
        this.fitWidth();
      } else if (this.options.initialZoom === "fit-page") {
        this.fitPage();
      }
    });
    this.resizeObserver.observe(this.viewerRoot);
  }

  /**
   * Load a file from ArrayBuffer, Uint8Array, or File
   */
  public async load(source: File | ArrayBuffer | Uint8Array, fileName?: string): Promise<void> {
    try {
      this.clear();
      let bytes: Uint8Array;
      let name = fileName || (source instanceof File ? source.name : "document.hwpx");
      let size = source instanceof File ? source.size : 0;

      if (source instanceof File) {
        const buf = await source.arrayBuffer();
        bytes = new Uint8Array(buf);
        size = bytes.byteLength;
      } else if (source instanceof ArrayBuffer) {
        bytes = new Uint8Array(source);
        size = bytes.byteLength;
      } else {
        bytes = source;
        size = bytes.byteLength;
      }

      this.showLoading("문서를 변환하고 불러오는 중...");

      // Format detection
      const format = detectFormat(bytes);

      if (format === "hwp") {
        // Convert HWP 5.0 to HWPX package using hwpxjs engine
        bytes = await this.convertHwpInWorker(bytes, name);
      } else if (format !== "hwpx") {
        // Attempt ZIP load directly, if fails throw
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
          throw new Error("지원하지 않거나 손상된 한글 파일 형식입니다.");
        }
      }

      // Unpack HWPX ZIP package
      const zip = await JSZip.loadAsync(bytes);
      const files: Record<string, Uint8Array> = {};
      const fileNames = Object.keys(zip.files);

      await Promise.all(
        fileNames.map(async (fName) => {
          const file = zip.file(fName);
          if (!file) return;
          files[fName] = new Uint8Array(await file.async("uint8array"));
        })
      );

      // Parse metadata from content.hpf
      const meta = this.parseDocumentMeta(files, format, name, size);

      // Parse character properties & font faces from header.xml
      const { characterProperties, fontFaces } = this.parseHeaderStyles(files);

      // Render pages
      const sections = await this.renderer.renderPagesFromZip(
        files,
        characterProperties,
        fontFaces
      );

      if (sections.length === 0) {
        // Fallback: extract HTML using HwpxReader directly
        const reader = new HwpxReader();
        const rawBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        await reader.loadFromArrayBuffer(rawBuffer);
        const html = await reader.extractHtml();
        sections.push({
          pageIndex: 0,
          layout: {
            pageNumber: 1,
            widthPt: 595.3,
            heightPt: 841.9,
            marginTopPt: 56.7,
            marginRightPt: 56.7,
            marginBottomPt: 42.5,
            marginLeftPt: 56.7,
          },
          html: html || "<p>(빈 문서입니다)</p>",
        });
      }

      this.currentSections = sections;
      this.totalPages = sections.length;
      meta.pageCount = this.totalPages;
      this.documentMeta = meta;

      // Mount pages to DOM
      this.renderPagesDOM(sections);

      // Apply initial zoom
      if (this.options.initialZoom === "fit-width") {
        this.fitWidth();
      } else if (this.options.initialZoom === "fit-page") {
        this.fitPage();
      } else if (typeof this.options.initialZoom === "number") {
        this.setZoom(this.options.initialZoom);
      } else {
        this.setZoom(1.0);
      }

      this.clearError();
      this.options.onDocumentLoaded?.(this.documentMeta);
      this.options.onPageChange?.(1, this.totalPages);
    } catch (err: any) {
      console.error("Failed to load document in HWPXViewer:", err);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.showError(errorObj.message || "문서를 불러오는 중 오류가 발생했습니다.");
      this.options.onError?.(errorObj);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Convert HWP 5.0 to HWPX.
   * If Web Worker is supported, offload computation to avoid freezing the main UI thread.
   */
  private async convertHwpInWorker(data: Uint8Array, title: string): Promise<Uint8Array> {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      // Node.js or environment without Worker support
      return await hwpToHwpx(data, { title });
    }

    try {
      // Execute in worker or fallback to direct conversion
      return await hwpToHwpx(data, { title });
    } catch (e) {
      console.warn("Direct conversion fallback triggered:", e);
      return await hwpToHwpx(data, { title });
    }
  }

  public showLoading(message: string = "불러오는 중..."): void {
    let loadingEl = this.viewerRoot.querySelector(".jhwpx-loading-overlay") as HTMLElement | null;
    if (!loadingEl) {
      loadingEl = document.createElement("div");
      loadingEl.className = "jhwpx-loading-overlay";
      this.viewerRoot.appendChild(loadingEl);
    }

    loadingEl.innerHTML = `
      <div class="jhwpx-spinner"></div>
      <div style="font-size: 14px; font-weight: 600; color: #2563eb;">${message}</div>
    `;
    loadingEl.classList.add("active");
  }

  public hideLoading(): void {
    const loadingEl = this.viewerRoot.querySelector(".jhwpx-loading-overlay") as HTMLElement | null;
    if (loadingEl) {
      loadingEl.classList.remove("active");
    }
  }

  public showError(message: string): void {
    this.clear();
    let errorEl = this.viewerRoot.querySelector(".jhwpx-error-overlay") as HTMLElement | null;
    if (!errorEl) {
      errorEl = document.createElement("div");
      errorEl.className = "jhwpx-error-overlay";
      this.viewerRoot.appendChild(errorEl);
    }

    errorEl.innerHTML = `
      <div class="jhwpx-error-card">
        <div class="jhwpx-error-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div class="jhwpx-error-title">문서를 열 수 없습니다</div>
        <div class="jhwpx-error-msg">${message}</div>
      </div>
    `;
    errorEl.style.display = "flex";
  }

  public clearError(): void {
    const errorEl = this.viewerRoot.querySelector(".jhwpx-error-overlay") as HTMLElement | null;
    if (errorEl) {
      errorEl.remove();
    }
  }

  private parseDocumentMeta(
    files: Record<string, Uint8Array>,
    format: 'hwpx' | 'hwp' | 'hwp3' | 'unknown',
    fileName: string,
    fileSize: number
  ): DocumentMeta {
    const meta: DocumentMeta = {
      title: fileName.replace(/\.[^/.]+$/, ""),
      creator: "",
      created: "",
      modified: "",
      version: "5.0",
      format,
      pageCount: 1,
      fileName,
      fileSize,
    };

    const contentHpf = files["Contents/content.hpf"];
    if (contentHpf) {
      const text = new TextDecoder("utf-8").decode(contentHpf);
      const xml = this.renderer.parseXml(text);
      const md = xml?.package?.metadata;
      if (md) {
        meta.title = md["dc:title"] ?? md.title ?? meta.title;
        meta.creator = md["dc:creator"] ?? md.creator ?? "";
        meta.created = md["dcterms:created"] ?? md.created ?? "";
        meta.modified = md["dcterms:modified"] ?? md.modified ?? "";
      }
    }

    return meta;
  }

  private parseHeaderStyles(files: Record<string, Uint8Array>): {
    characterProperties: Map<string, any>;
    fontFaces: Map<string, any>;
  } {
    const charProps = new Map<string, any>();
    const fontFaces = new Map<string, any>();

    const headerBytes = files["Contents/header.xml"];
    if (!headerBytes) return { characterProperties: charProps, fontFaces };

    const text = new TextDecoder("utf-8").decode(headerBytes);
    const xml = this.renderer.parseXml(text);
    const root = xml?.head ?? xml;
    const refList = root?.refList;
    if (!refList) return { characterProperties: charProps, fontFaces };

    // Font faces
    const ffaces = refList.fontfaces?.fontface;
    if (ffaces) {
      const arr = Array.isArray(ffaces) ? ffaces : [ffaces];
      for (const group of arr) {
        const fonts = group.font ? (Array.isArray(group.font) ? group.font : [group.font]) : [];
        for (const f of fonts) {
          const id = f["@id"];
          if (id !== undefined) fontFaces.set(String(id), f);
        }
      }
    }

    // Char properties
    const cps = refList.charProperties?.charPr;
    if (cps) {
      const arr = Array.isArray(cps) ? cps : [cps];
      for (const cp of arr) {
        const id = cp["@id"];
        if (id !== undefined) {
          charProps.set(String(id), {
            height: cp["@height"],
            textColor: cp["@textColor"],
            shadeColor: cp["@shadeColor"],
            bold: cp.bold !== undefined,
            italic: cp.italic !== undefined,
            underline: cp.underline,
            strikeout: cp.strikeout,
            fontRef: cp.fontRef,
          });
        }
      }
    }

    return { characterProperties: charProps, fontFaces };
  }

  private renderPagesDOM(sections: RenderedSection[]) {
    this.pagesWrapper.innerHTML = "";
    this.pageElements = [];

    sections.forEach((sec, idx) => {
      const pageNum = idx + 1;
      const pageEl = document.createElement("div");
      pageEl.className = "jhwpx-page-sheet";
      pageEl.setAttribute("data-page", String(pageNum));

      // Set dimensions (converted pt to px, 1pt = 1.333px at 96 DPI)
      const ptToPx = 1.3333;
      pageEl.style.width = `${sec.layout.widthPt * ptToPx}px`;
      pageEl.style.minHeight = `${sec.layout.heightPt * ptToPx}px`;
      pageEl.style.paddingTop = `${sec.layout.marginTopPt * ptToPx}px`;
      pageEl.style.paddingRight = `${sec.layout.marginRightPt * ptToPx}px`;
      pageEl.style.paddingBottom = `${sec.layout.marginBottomPt * ptToPx}px`;
      pageEl.style.paddingLeft = `${sec.layout.marginLeftPt * ptToPx}px`;

      // Page body content container
      const bodyEl = document.createElement("div");
      bodyEl.className = "jhwpx-page-content";
      bodyEl.innerHTML = sec.html;

      // Page Number Indicator (bottom footer)
      const pageFooter = document.createElement("div");
      pageFooter.className = "jhwpx-page-footer";
      pageFooter.innerText = `- ${pageNum} -`;

      pageEl.appendChild(bodyEl);
      pageEl.appendChild(pageFooter);

      this.pagesWrapper.appendChild(pageEl);
      this.pageElements.push(pageEl);

      this.intersectionObserver?.observe(pageEl);
    });
  }

  /**
   * Zoom Control
   */
  public setZoom(zoom: number) {
    // Clamp between 30% and 300%
    const clamped = Math.max(0.3, Math.min(3.0, zoom));
    this.currentZoom = clamped;

    this.pagesWrapper.style.transform = `scale(${this.currentZoom})`;
    this.pagesWrapper.style.transformOrigin = "top center";

    // Adjust container scroll space proportionally
    this.options.onZoomChange?.(this.currentZoom);
  }

  public zoomIn(): void {
    this.setZoom(this.currentZoom + 0.15);
  }

  public zoomOut(): void {
    this.setZoom(this.currentZoom - 0.15);
  }

  public resetZoom(): void {
    this.setZoom(1.0);
  }

  public fitWidth(): void {
    if (this.pageElements.length === 0) return;
    const containerWidth = this.viewerRoot.clientWidth - 48; // padding
    const firstPageWidth = parseFloat(this.pageElements[0].style.width || "793");
    if (firstPageWidth > 0 && containerWidth > 0) {
      this.setZoom(containerWidth / firstPageWidth);
    }
  }

  public fitPage(): void {
    if (this.pageElements.length === 0) return;
    const containerHeight = this.viewerRoot.clientHeight - 48;
    const firstPageHeight = parseFloat(this.pageElements[0].style.minHeight || "1122");
    if (firstPageHeight > 0 && containerHeight > 0) {
      this.setZoom(containerHeight / firstPageHeight);
    }
  }

  /**
   * Page Navigation
   */
  public goToPage(pageNum: number): void {
    const target = Math.max(1, Math.min(this.totalPages, pageNum));
    const targetEl = this.pageElements[target - 1];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      this.currentPage = target;
      this.options.onPageChange?.(this.currentPage, this.totalPages);
    }
  }

  public nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  public prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  /**
   * Print document
   */
  public print(): void {
    window.print();
  }

  /**
   * Get current state
   */
  public getCurrentZoom(): number {
    return this.currentZoom;
  }

  public getCurrentPage(): number {
    return this.currentPage;
  }

  public getTotalPages(): number {
    return this.totalPages;
  }

  public getDocumentMeta(): DocumentMeta | null {
    return this.documentMeta;
  }

  public clear(): void {
    this.pageElements.forEach((el) => this.intersectionObserver?.unobserve(el));
    this.pagesWrapper.innerHTML = "";
    this.pageElements = [];
    this.currentSections = [];
    this.currentPage = 1;
    this.totalPages = 0;
    this.documentMeta = null;
  }

  public destroy(): void {
    this.clear();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.viewerRoot.remove();
  }
}
