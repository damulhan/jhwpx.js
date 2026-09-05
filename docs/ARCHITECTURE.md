# jhwpx.js 아키텍처 및 렌더링 파이프라인

`jhwpx.js`는 웹 브라우저 환경에서 고성능으로 한글 문서를 처리하고, 반응형 인터페이스와 고품질 인쇄를 지원할 수 있도록 모듈화된 계층형 구조로 설계되었습니다.

---

## 1. 아키텍처 다이어그램

```text
[Input Source] (File / Blob / ArrayBuffer)
      │
      ▼
[detectFormat] ───► HWP 5.0 (CFB) ──► [hwpToHwpx] ──┐
      │                                             │ (OWPML ZIP)
      └──────────► HWPX (OWPML) ────────────────────┴─► [JSZip.loadAsync]
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                                    [Header / Styles]                  [Section XMLs]
                                    - fontfaces                        - paragraphs (hp:p)
                                    - charProperties                   - runs (hp:t)
                                    - paraProperties                   - tables (hp:tbl)
                                            │                                   │
                                            └─────────────────┬─────────────────┘
                                                              ▼
                                                     [PageRenderer]
                                                     - A4 시트 규격 및 여백 계산
                                                     - 인라인 서식 CSS 적용
                                                     - 표 / 셀 병합 렌더링
                                                     - BinData 이미지 임베딩
                                                              │
                                                              ▼
                                                     [HWPXViewer]
                                                     - 줌(Zoom) 변환 (CSS scale)
                                                     - IntersectionObserver (페이지 트래킹)
                                                     - @media print 인쇄 최적화
```

---

## 2. React 컴포넌트 (`JhwpxViewer`) 연동

React 프로젝트에서 손쉽게 뷰어를 임베드할 수 있도록 전용 컴포넌트가 제공됩니다:

```tsx
import React from 'react';
import { JhwpxViewer } from 'jhwpx.js/react';

function MyDocumentPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <JhwpxViewer
        file="/sample.hwpx"
        initialZoom="fit-width"
        onDocumentLoaded={(meta) => console.log('Loaded:', meta.title)}
        onPageChange={(page, total) => console.log(`Page: ${page}/${total}`)}
      />
    </div>
  );
}
```
