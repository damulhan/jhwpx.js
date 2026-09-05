import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ChangeDetectionStrategy,
  type OnInit,
  type OnDestroy,
  type OnChanges,
  type SimpleChanges,
} from "@angular/core";
import { HWPXViewer } from "../lib/HWPXViewer";
import type { DocumentMeta } from "../lib/types";

@Component({
  selector: "jhwpx-viewer",
  standalone: true,
  template: `
    <div
      #container
      [class]="'jhwpx-angular-container ' + (className || '')"
      [style]="containerStyle"
      style="width: 100%; height: 100%; position: relative; overflow: hidden;"
    ></div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JHwpxViewerComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild("container", { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  /** File object, ArrayBuffer, Uint8Array, or URL string */
  @Input() file?: File | ArrayBuffer | Uint8Array | string;
  /** Optional file name hint */
  @Input() fileName?: string;
  /** Initial zoom level ('fit-width', 'fit-page', or number) */
  @Input() initialZoom: number | "fit-width" | "fit-page" = "fit-width";
  /** Gap between pages in px */
  @Input() pageGap = 24;
  /** Enable animated zoom transition */
  @Input() animatedZoom = true;
  /** Custom CSS class */
  @Input() className = "";
  /** Custom inline style string or object */
  @Input() containerStyle: Record<string, string> | string = "";

  @Output() documentLoaded = new EventEmitter<DocumentMeta>();
  @Output() pageChange = new EventEmitter<{ page: number; total: number }>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() error = new EventEmitter<Error>();

  private viewer: HWPXViewer | null = null;

  ngOnInit(): void {
    if (!this.containerRef?.nativeElement) return;

    this.viewer = new HWPXViewer(this.containerRef.nativeElement, {
      initialZoom: this.initialZoom,
      pageGap: this.pageGap,
      animatedZoom: this.animatedZoom,
      onDocumentLoaded: (meta) => this.documentLoaded.emit(meta),
      onPageChange: (page, total) => this.pageChange.emit({ page, total }),
      onZoomChange: (zoom) => this.zoomChange.emit(zoom),
      onError: (err) => this.error.emit(err),
    });

    if (this.file) {
      this.load(this.file, this.fileName);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["file"] && !changes["file"].firstChange && this.file) {
      this.load(this.file, this.fileName);
    }
  }

  ngOnDestroy(): void {
    this.viewer?.destroy();
    this.viewer = null;
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
        this.error.emit(err instanceof Error ? err : new Error(String(err)));
      }
    } else {
      await this.viewer.load(source, name);
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

export default JHwpxViewerComponent;
