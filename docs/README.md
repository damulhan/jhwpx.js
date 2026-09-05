# jhwpx.js 문서 (Documentation)

`jhwpx.js`는 한글 문서 표준인 **HWPX (OWPML)** 및 **HWP 5.0 (바이너리)** 형식을 웹 브라우저에서 직접 파싱하고 렌더링하기 위한 통합 라이브러리입니다.

---

## 목차 (Table of Contents)

1. [HWPX (OWPML) 문서 규격 개요](./hwpx/OWPML_Overview.md)
   - ZIP 컨테이너 패키징 규격 (`mimetype`, `META-INF/`)
   - OPF 매니페스트 및 스파인 구조 (`content.hpf`)
   - 본문 XML 구조 (`section*.xml`)
   - 스타일 및 폰트 정의 (`header.xml`)
2. [HWP 5.0 바이너리 문서 규격 개요](./hwp/HWP5_Overview.md)
   - OLE2 / CFB 구조
   - FileHeader, DocInfo, BodyText 레코드 스트림
   - OWPML 변환 원리
3. [jhwpx.js 아키텍처 및 렌더링 파이프라인](./ARCHITECTURE.md)
   - 뷰어 생명주기 (Lifecycle)
   - A4 용지 규격 변환 및 CSS 레이아웃 모델
   - React 컴포넌트 (`JhwpxViewer`) 연동 방법

---

## 저작권 및 표준 규격 참조

- **OWPML (KS X 6101)**: 국가기술표준원 한글 개방형 문서 규격
- **한글 문서 파일 형식 5.0**: (주)한글과컴퓨터 공개 기술 문서
