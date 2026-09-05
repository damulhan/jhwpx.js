import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { JHwpxViewer, type JHwpxViewerRef } from "../../src/react";
import "../../src/style.css";
import "./website.css";

type Lang = "ko" | "en";

interface I18nContent {
  title: string;
  subtitle: string;
  openFileBtn: string;
  badge: string;
  heroH1: string;
  heroDesc: string;
  sampleLabel: string;
  samples: {
    rich: string;
    sample: string;
    basicHwp: string;
    nooriHwp: string;
  };
  toolbar: {
    prevPage: string;
    nextPage: string;
    zoomOut: string;
    zoomIn: string;
    fitWidth: string;
    print: string;
  };
  codeTitle: string;
  codeDesc: string;
  footerCredits: string;
}

const translations: Record<Lang, I18nContent> = {
  ko: {
    title: "jhwpx.js",
    subtitle: "한글(HWP & HWPX) 오픈소스 웹 뷰어",
    openFileBtn: "내 한글 파일 열기",
    badge: "React · Vue 3 · Angular · Web Component 지원",
    heroH1: "웹 기술로 구현된 차세대 한글(HWP / HWPX) 뷰어",
    heroDesc:
      "별도 프로그램 설치 없이 브라우저에서 바로 여는 고성능 한글 뷰어. hahnlee/hwp.js의 페이지 레이아웃 모델과 ssabro/hwpxjs의 OWPML 파싱 엔진을 결합했습니다.",
    sampleLabel: "체험 문서:",
    samples: {
      rich: "📊 HWPX 서식 및 표",
      sample: "📄 HWPX 기본 문서",
      basicHwp: "📑 HWP 5.0 리포트",
      nooriHwp: "🏢 HWP 5.0 공공누리",
    },
    toolbar: {
      prevPage: "이전 페이지",
      nextPage: "다음 페이지",
      zoomOut: "축소",
      zoomIn: "확대",
      fitWidth: "너비맞춤",
      print: "인쇄 / PDF",
    },
    codeTitle: "React에서 포함시키기 예제",
    codeDesc: "단 3줄의 코드로 리액트 애플리케이션에 뷰어를 임베드할 수 있습니다.",
    footerCredits: "hwp.js 및 hwpxjs 오픈소스 프로젝트의 기술과 영감을 받아 제작되었습니다.",
  },
  en: {
    title: "jhwpx.js",
    subtitle: "Open-source Web Viewer for Hangul (HWP & HWPX)",
    openFileBtn: "Open HWP/HWPX File",
    badge: "React · Vue 3 · Angular · Web Component",
    heroH1: "Next-gen Hangul (HWP / HWPX) Web Document Viewer",
    heroDesc:
      "High-performance Hancom Word Processor (HWP 5.0 & HWPX OWPML) viewer running entirely in your browser without plugins. Built upon hahnlee/hwp.js page layout UX and ssabro/hwpxjs OWPML parser.",
    sampleLabel: "Demo Documents:",
    samples: {
      rich: "📊 HWPX Rich Table",
      sample: "📄 HWPX Standard",
      basicHwp: "📑 HWP 5.0 Report",
      nooriHwp: "🏢 HWP 5.0 Public Notice",
    },
    toolbar: {
      prevPage: "Previous Page",
      nextPage: "Next Page",
      zoomOut: "Zoom Out",
      zoomIn: "Zoom In",
      fitWidth: "Fit Width",
      print: "Print / PDF",
    },
    codeTitle: "React Embedding Example",
    codeDesc: "Embed the viewer into any React app with just 3 lines of code.",
    footerCredits: "Inspired by and built with technologies from hwp.js and hwpxjs open-source projects.",
  },
};

function App() {
  const [lang, setLang] = useState<Lang>("ko");
  const t = translations[lang];

  const viewerRef = useRef<JHwpxViewerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentSample, setCurrentSample] = useState<string>("./rich_sample.hwpx");
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
            <div className="wb-title">{t.title}</div>
            <div className="wb-subtitle">{t.subtitle}</div>
          </div>
        </div>

        <div className="wb-links">
          {/* Language Selector */}
          <div className="wb-lang-toggle" role="group" aria-label="Language selection">
            <button
              className={`wb-lang-btn ${lang === "ko" ? "active" : ""}`}
              onClick={() => setLang("ko")}
            >
              한국어
            </button>
            <button
              className={`wb-lang-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")}
            >
              English
            </button>
          </div>

          <button className="wb-btn wb-btn-primary" onClick={() => fileInputRef.current?.click()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            {t.openFileBtn}
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
        <div className="wb-badge">{t.badge}</div>
        <h1>{t.heroH1}</h1>
        <p className="wb-desc">{t.heroDesc}</p>

        {/* Quick Sample Selector */}
        <div className="wb-sample-chips">
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b" }}>{t.sampleLabel}</span>
          <button
            className={`wb-chip ${currentSample === "./rich_sample.hwpx" ? "active" : ""}`}
            onClick={() => setCurrentSample("./rich_sample.hwpx")}
          >
            {t.samples.rich}
          </button>
          <button
            className={`wb-chip ${currentSample === "./sample.hwpx" ? "active" : ""}`}
            onClick={() => setCurrentSample("./sample.hwpx")}
          >
            {t.samples.sample}
          </button>
          <button
            className={`wb-chip ${currentSample === "./sample_basic.hwp" ? "active" : ""}`}
            onClick={() => setCurrentSample("./sample_basic.hwp")}
          >
            {t.samples.basicHwp}
          </button>
          <button
            className={`wb-chip ${currentSample === "./sample_noori.hwp" ? "active" : ""}`}
            onClick={() => setCurrentSample("./sample_noori.hwp")}
          >
            {t.samples.nooriHwp}
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
              <button
                className="wb-btn-sm"
                onClick={() => viewerRef.current?.prevPage()}
                title={t.toolbar.prevPage}
              >
                ◀
              </button>
              <span className="wb-page-indicator">
                {page} / {totalPages}
              </span>
              <button
                className="wb-btn-sm"
                onClick={() => viewerRef.current?.nextPage()}
                title={t.toolbar.nextPage}
              >
                ▶
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="wb-tool-group">
              <button
                className="wb-btn-sm"
                onClick={() => viewerRef.current?.zoomOut()}
                title={t.toolbar.zoomOut}
              >
                -
              </button>
              <span className="wb-zoom-indicator">{zoomText}</span>
              <button
                className="wb-btn-sm"
                onClick={() => viewerRef.current?.zoomIn()}
                title={t.toolbar.zoomIn}
              >
                +
              </button>
              <button
                className="wb-btn-sm"
                onClick={() => viewerRef.current?.fitWidth()}
                title={t.toolbar.fitWidth}
              >
                {t.toolbar.fitWidth}
              </button>
            </div>

            {/* Print */}
            <button
              className="wb-btn-sm wb-btn-print"
              onClick={() => viewerRef.current?.print()}
              title={t.toolbar.print}
            >
              {t.toolbar.print}
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
              setDocTitle(meta.title || meta.fileName || "document");
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
        <h2>{t.codeTitle}</h2>
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
          {t.footerCredits}
        </div>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
