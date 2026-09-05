# HWP 5.0 바이너리 문서 규격 개요

HWP 5.0 형식은 마이크로소프트의 복합 파일 바이너리 형식(Compound File Binary Format, CFB / OLE2)을 기반으로 본문과 메타데이터를 저장하는 포맷입니다.

---

## 1. HWP 5.0 스트림 구조

```text
HWP 5.0 (CFB/OLE2 복합 파일)
├── FileHeader                           # 시그니처("HWP Document File"), 버전(5.0.x.x), 압축 및 암호화 플래그
├── DocInfo                              # 폰트, 글자모양, 문단모양, 스타일, 테두리, 채우기 레코드 스트림 (Deflate 압축)
├── BodyText/
│   ├── Section0                         # 본문 문단 및 컨트롤(표, 그림, 수식 등) 레코드 스트림
│   ├── Section1                         # 다중 구역인 경우 순차 스트림
│   └── ...
├── BinData/
│   ├── BIN0001.png                      # 임베디드 이미지 바이너리 스트림
│   └── ...
└── PrvText                              # 빠른 미리보기를 위한 평문 텍스트 스트림
```

---

## 2. jhwpx.js의 HWP 처리 파이프라인

1. **포맷 감지**: 파일 헤더의 8바이트 매직 넘버 (`0xD0CF11E0A1B11AE1`)로 CFB 구조 감지
2. **복합 파일 디코딩**: CFB 디렉터리 및 FAT 체인을 순회하여 `FileHeader`, `DocInfo`, `BodyText/Section*` 추출
3. **Deflate 압축 해제**: `pako` 엔진을 통해 바이트 스트림 압축 해제
4. **OWPML 변환**: `hwpxBuilder` 변환 레이어를 통해 OWPML XML 및 ZIP 패키지 IR로 실시간 변환
5. **A4 렌더링**: HWPX 렌더러와 동일한 정밀 레이아웃 파이프라인을 통해 브라우저에 표시
