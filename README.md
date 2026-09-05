# jhwpx.js

**jhwpx.js**는 한글 문서 표준인 **HWPX (OWPML ZIP+XML)** 및 구형 바이너리 **HWP (5.0 CFB/OLE2)** 형식을 웹 브라우저에서 직접 파싱하고, 실제 한글 워드프로세서처럼 A4 용지 레이아웃으로 렌더링해주는 통합 한글 웹 뷰어 라이브러리 및 웹 애플리케이션입니다.

`hwp.js`의 뷰어 레이아웃/UX 설계와 `ssabro/hwpxjs`의 파싱 코어 기술을 계승·발전시켜 순수 JavaScript/TypeScript로 완성되었습니다.

---

## 주요 특징

- 🚀 **HWPX & HWP 듀얼 포맷 자동 지원**
  - 파일 헤더 매직 넘버를 자동 분석하여 `.hwpx`와 `.hwp`를 모두 매끄럽게 처리합니다.
  - HWP 바이너리 문서는 브라우저 내부에서 OWPML 패키지 규격으로 실시간 변환되어 동일한 렌더러를 통해 출력됩니다.
- 📄 **워드프로세서 A4 용지 렌더링**
  - 실제 용지 규격(A4 210x297mm 및 문서 지정 여백)과 용지 그림자 효과 적용
  - 문단 서식(정렬, 줄간격), 글자 서식(글꼴, 크기, 굵게, 기울임, 밑줄, 글자색, 배경음영) 반영
  - 표 렌더링 (셀 병합 `rowspan`, `colspan`, 테두리, 배경색)
  - 본문 삽입 이미지(`BinData`) 인라인 디코딩 및 표시
- 🛠️ **모던 인터랙티브 툴바 UI**
  - **파일 열기 및 드래그 & 드롭**: 로컬 한글 문서를 브라우저에 바로 끌어다 놓아 열람
  - **줌(Zoom) 제어**: 확대(Zoom In), 축소(Zoom Out), 100% 리셋, 너비 맞춤(Fit Width)
  - **페이지 네비게이션**: 이전/다음 페이지 이동 및 페이지 번호 직접 입력 점프
  - **인쇄 및 PDF 저장**: 브라우저 인쇄(`window.print()`) 최적화 CSS 제공
  - **전체화면(Fullscreen)** 모드 지원
  - **샘플 문서 원클릭 체험**: HWPX 표 서식 데모, HWP 5.0 리포트 문서 등 기본 탑재
- 📦 **재사용 가능한 라이브러리 모듈 제공**
  - 다른 웹 서비스나 React, Vue, Angular, 바닐라 JS 프로젝트에 `<div id="viewer"></div>` 형태로 임베드 가능

---

## 프로젝트 구조

```text
jhwpx.js/
├── index.html                   # 뷰어 웹 애플리케이션 진입점
├── src/
│   ├── main.ts                  # 뷰어 UI 컨트롤러 및 이벤트 바인딩
│   ├── style.css                # Pretendard 폰트 기반 모던 UI 및 A4 인쇄 스타일
│   ├── lib/                     # jhwpx.js 코어 라이브러리
│   │   ├── HWPXViewer.ts        # 뷰어 마운트 및 줌/페이지 라이프사이클 관리 클래스
│   │   ├── PageRenderer.ts      # OWPML XML -> A4 용지 HTML 정밀 렌더링 엔진
│   │   ├── types.ts             # 뷰어 옵션 및 문서 메타데이터 타입 정의
│   │   └── index.ts             # 라이브러리 메인 export
│   └── vendor/
│       └── hwpxjs.bundle.js     # HWPX/HWP 파싱 코어 브라우저 번들
└── public/
    ├── rich_sample.hwpx         # 표 및 스타일이 포함된 HWPX 샘플
    ├── sample.hwpx              # 기본 HWPX 텍스트 샘플
    ├── sample_basic.hwp         # HWP 5.0 리포트 샘플
    └── sample_noori.hwp         # HWP 5.0 공공누리 문서 샘플
```

---

## 라이브러리 사용법 (Quick Start)

### 1. HTML 엘리먼트에 뷰어 생성

```html
<div id="viewer" style="width: 100vw; height: 100vh;"></div>
```

### 2. TypeScript / JavaScript 연동

```ts
import { HWPXViewer } from "./src/lib";

const container = document.getElementById("viewer")!;
const viewer = new HWPXViewer(container, {
  initialZoom: 1.0,         // 초기 줌 배율 (또는 'fit-width')
  pageGap: 24,              // 페이지 간 간격 (px)
  onDocumentLoaded: (meta) => {
    console.log("문서 제목:", meta.title);
    console.log("문서 포맷:", meta.format); // 'hwpx' | 'hwp'
    console.log("총 페이지 수:", meta.pageCount);
  },
  onPageChange: (current, total) => {
    console.log(`페이지: ${current} / ${total}`);
  }
});

// 파일 열기 (File 객체 또는 ArrayBuffer/Uint8Array)
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await viewer.load(file);
  }
});

// 주요 제어 메소드
viewer.zoomIn();       // 확대 (+15%)
viewer.zoomOut();      // 축소 (-15%)
viewer.fitWidth();     // 창 너비에 맞춤
viewer.nextPage();     // 다음 페이지
viewer.prevPage();     // 이전 페이지
viewer.goToPage(3);    // 3페이지로 이동
viewer.print();        // 인쇄 / PDF 저장 창 열기
```

---

## 로컬 개발 및 실행

```bash
cd jhwpx.js

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과물 미리보기
npm run preview
```
