import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { JHwpxViewer, type JHwpxViewerRef } from "../../src/react";
import "../../src/style.css";
import "./website.css";

function App() {
  const viewerRef = useRef<JHwpxViewerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentSample, setCurrentSample] = useState<string>("/rich_sample.hwpx");
  const [docTitle, setDocTitle] = useState<string>("jhwpx.js 한글 뷰어 데모.hwpx");
  const [format, setFormat] = useState<string>("HWPX");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomText, setZoomText] = useState<string>("100%");

  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && viewerRef.current) {
      viewerRef.current.load(file);
      e.target.value = "";
    }
  };

  return (
    <div className="wb-container">
      {/* Hero Showcase Bar */}
      <nav className="wb-hero-nav">
        <div className="wb-brand">
          <div className="wb-logo">한</div>
          <div>
            <div className="wb-title">jhwpx.js</div>
            <div className="wb-subtitle">한글(HWP & HWPX) 오픈소스 웹 뷰어</div>
          </div>
        </div>

        <div className="wb-links">
          <button className="wb-btn wb-btn-primary" onClick={() => fileInputRef.current?.click()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            내 한글 파일 열기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".hwpx,.hwp"
            style={{ display: "none" }}
            onChange={handleOpenFile}
          />
        </div>
      </nav>

      {/* Hero Header */}
      <header className="wb-hero-header">
        <div className="wb-badge">React & Vanilla TypeScript 지원</div>
        <h1>웹 기술로 구현된 차세대 한글(HWP / HWPX) 뷰어</h1>
        <p className="wb-desc">
          설치 없이 브라우저에서 바로 여는 초고속 한글 뷰어. <code>hwp.js</code>의 페이지 레이아웃 모델과{" "}
          <code>hwpxjs</code>의 OWPML 파싱 엔진을 결합했습니다.
        </p>

        {/* Quick Sample Selector */}
        <div className="wb-sample-chips">
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b" }}>체험 문서:</span>
          <button
            className={`wb-chip ${currentSample === "/rich_sample.hwpx" ? "active" : ""}`}
            onClick={() => setCurrentSample("/rich_sample.hwpx")}
          >
            📊 HWPX 서식 및 표
          </button>
          <button
            className={`wb-chip ${currentSample === "/sample.hwpx" ? "active" : ""}`}
            onClick={() => setCurrentSample("/sample.hwpx")}
          >
            📄 HWPX 기본 문서
          </button>
          <button
            className={`wb-chip ${currentSample === "/sample_basic.hwp" ? "active" : ""}`}
            onClick={() => setCurrentSample("/sample_basic.hwp")}
          >
            📑 HWP 5.0 리포트
          </button>
          <button
            className={`wb-chip ${currentSample === "/sample_noori.hwp" ? "active" : ""}`}
            onClick={() => setCurrentSample("/sample_noori.hwp")}
          >
            🏢 HWP 5.0 공공누리
          </button>
        </div>
      </header>

      {/* Main Interactive Viewer Section */}
      <section className="wb-viewer-section">
        {/* Viewer Control Toolbar */}
        <div className="wb-viewer-toolbar">
          <div className="wb-doc-info">
            <span className="wb-doc-badge">{format}</span>
            <span className="wb-doc-name">{docTitle}</span>
          </div>

          <div className="wb-toolbar-actions">
            {/* Page Navigation */}
            <div className="wb-tool-group">
              <button className="wb-btn-sm" onClick={() => viewerRef.current?.prevPage()} title="이전 페이지">
                ◀
              </button>
              <span className="wb-page-indicator">
                {page} / {totalPages}
              </span>
              <button className="wb-btn-sm" onClick={() => viewerRef.current?.nextPage()} title="다음 페이지">
                ▶
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="wb-tool-group">
              <button className="wb-btn-sm" onClick={() => viewerRef.current?.zoomOut()} title="축소">
                -
              </button>
              <span className="wb-zoom-indicator">{zoomText}</span>
              <button className="wb-btn-sm" onClick={() => viewerRef.current?.zoomIn()} title="확대">
                +
              </button>
              <button className="wb-btn-sm" onClick={() => viewerRef.current?.fitWidth()} title="너비 맞춤">
                너비맞춤
              </button>
            </div>

            {/* Print */}
            <button className="wb-btn-sm wb-btn-print" onClick={() => viewerRef.current?.print()} title="인쇄 및 PDF">
              인쇄 / PDF
            </button>
          </div>
        </div>

        {/* Live React Component Mount */}
        <div className="wb-viewer-frame">
          <JHwpxViewer
            ref={viewerRef}
            file={currentSample}
            initialZoom={1.0}
            onDocumentLoaded={(meta) => {
              setDocTitle(meta.title || meta.fileName || "문서");
              setFormat(meta.format.toUpperCase());
              setTotalPages(meta.pageCount);
            }}
            onPageChange={(p, t) => {
              setPage(p);
              setTotalPages(t);
            }}
            onZoomChange={(z) => {
              setZoomText(`${Math.round(z * 100)}%`);
            }}
          />
        </div>
      </section>

      {/* Code integration showcase */}
      <section className="wb-code-section">
        <h2>React에서 포함시키기 예제</h2>
        <pre className="wb-code-block">
{`import { JHwpxViewer } from "jhwpx.js/react";
import "jhwpx.js/style.css";

export function DocumentViewer() {
  return (
    <div style={{ width: "100%", height: "800px" }}>
      <JHwpxViewer file="/my-document.hwpx" initialZoom="fit-width" />
    </div>
  );
}`}
        </pre>
      </section>

      {/* Footer */}
      <footer className="wb-footer">
        <div>
          jhwpx.js © 2026
        </div>
        <div style={{ marginTop: "6px", color: "#64748b", fontSize: "13px" }}>
          Built with inspiration and technologies from <strong>hwp.js</strong> and <strong>hwpxjs</strong>.
        </div>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
