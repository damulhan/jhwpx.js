import "./style.css";
import { HWPXViewer } from "./lib/HWPXViewer";
import type { DocumentMeta } from "./lib/types";

// DOM Elements
const container = document.getElementById("viewer-container") as HTMLElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const btnOpenFile = document.getElementById("btn-open-file") as HTMLButtonElement;
const btnPrevPage = document.getElementById("btn-prev-page") as HTMLButtonElement;
const btnNextPage = document.getElementById("btn-next-page") as HTMLButtonElement;
const inputPageNum = document.getElementById("input-page-num") as HTMLInputElement;
const lblTotalPages = document.getElementById("lbl-total-pages") as HTMLElement;
const btnZoomIn = document.getElementById("btn-zoom-in") as HTMLButtonElement;
const btnZoomOut = document.getElementById("btn-zoom-out") as HTMLButtonElement;
const btnZoomFit = document.getElementById("btn-zoom-fit") as HTMLButtonElement;
const lblZoomVal = document.getElementById("lbl-zoom-val") as HTMLElement;
const btnPrint = document.getElementById("btn-print") as HTMLButtonElement;
const btnFullscreen = document.getElementById("btn-fullscreen") as HTMLButtonElement;
const lblDocTitle = document.getElementById("lbl-doc-title") as HTMLElement;
const dropzone = document.getElementById("dropzone") as HTMLElement;
const loadingOverlay = document.getElementById("loading-overlay") as HTMLElement;
const loadingText = document.getElementById("loading-text") as HTMLElement;

// Show/Hide Loading
function setLoading(loading: boolean, text: string = "문서를 변환 및 파싱하고 있습니다...") {
  if (loading) {
    loadingText.innerText = text;
    loadingOverlay.classList.add("active");
  } else {
    loadingOverlay.classList.remove("active");
  }
}

// Initialize HWPXViewer instance
const viewer = new HWPXViewer(container, {
  initialZoom: 1.0,
  pageGap: 28,
  animatedZoom: true,
  onDocumentLoaded: (meta: DocumentMeta) => {
    lblDocTitle.innerText = `${meta.title || meta.fileName || "문서"} (${meta.format.toUpperCase()})`;
    lblTotalPages.innerText = String(meta.pageCount);
    inputPageNum.value = "1";
    setLoading(false);
  },
  onPageChange: (current: number, total: number) => {
    inputPageNum.value = String(current);
    lblTotalPages.innerText = String(total);
  },
  onZoomChange: (zoom: number) => {
    lblZoomVal.innerText = `${Math.round(zoom * 100)}%`;
  },
  onError: (err: Error) => {
    setLoading(false);
    alert(`문서 열기 실패: ${err.message}`);
  },
});

// Load document helper
async function loadDocumentFromUrl(url: string, fileName?: string) {
  try {
    setLoading(true, "샘플 한글 문서를 불러오는 중...");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const buf = await res.arrayBuffer();
    const name = fileName || url.split("/").pop() || "sample.hwpx";
    await viewer.load(buf, name);
  } catch (err: any) {
    setLoading(false);
    alert(`파일 로드 중 오류가 발생했습니다: ${err.message}`);
  }
}

// Event Bindings
btnOpenFile.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    setLoading(true, `${file.name} 파싱 중...`);
    try {
      await viewer.load(file);
    } finally {
      fileInput.value = "";
    }
  }
});

// Page Navigation
btnPrevPage.addEventListener("click", () => viewer.prevPage());
btnNextPage.addEventListener("click", () => viewer.nextPage());

inputPageNum.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    const val = parseInt(inputPageNum.value, 10);
    if (!isNaN(val)) viewer.goToPage(val);
  }
});

// Zoom Controls
btnZoomIn.addEventListener("click", () => viewer.zoomIn());
btnZoomOut.addEventListener("click", () => viewer.zoomOut());
btnZoomFit.addEventListener("click", () => viewer.fitWidth());

// Print & Fullscreen
btnPrint.addEventListener("click", () => viewer.print());

btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// Sample selector clicks
document.querySelectorAll<HTMLElement>(".jhwpx-sample-tag").forEach((el) => {
  el.addEventListener("click", () => {
    const sampleUrl = el.getAttribute("data-sample");
    if (sampleUrl) {
      loadDocumentFromUrl(sampleUrl);
    }
  });
});

// Drag and drop handlers
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dropzone.classList.add("active");
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
});

dropzone.addEventListener("dragleave", (e) => {
  if (e.relatedTarget === null || e.target === dropzone) {
    dropzone.classList.remove("active");
  }
});

dropzone.addEventListener("drop", async (e: DragEvent) => {
  e.preventDefault();
  dropzone.classList.remove("active");

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    setLoading(true, `${file.name} 파일을 열람하는 중...`);
    await viewer.load(file);
  }
});

// Keyboard shortcuts
window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      viewer.zoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      viewer.zoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      viewer.resetZoom();
    } else if (e.key.toLowerCase() === "p") {
      e.preventDefault();
      viewer.print();
    }
  } else if (e.key === "PageDown") {
    e.preventDefault();
    viewer.nextPage();
  } else if (e.key === "PageUp") {
    e.preventDefault();
    viewer.prevPage();
  }
});

// Load rich sample on startup
loadDocumentFromUrl("/rich_sample.hwpx", "jhwpx.js 한글 뷰어 데모.hwpx");
