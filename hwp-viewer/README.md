# HWP 뷰어

브라우저에서 `.hwp`(한글 5.x) / `.hwpx`(OWPML) 문서를 여는 클라이언트 사이드 뷰어입니다.
**파일은 서버로 전송되지 않고 100% 브라우저 안에서 파싱됩니다.**

## 현재 상태

| 기능 | 상태 |
|---|---|
| HWPX 본문 텍스트 + 문자 서식(굵게/기울임/밑줄/크기/색) | ✅ |
| HWPX 표 (셀 병합 포함) | ✅ |
| HWP 5.x 문서 속성 판정 (압축/암호화/배포용) | ✅ |
| HWP 5.x 미리보기 텍스트(PrvText) 표시 | ✅ |
| HWP 5.x 본문 레코드 파서 | 🚧 M2 예정 |
| 이미지, 문서 검색, 내보내기 | 🚧 M3~M4 예정 |

전체 로드맵은 [docs/plan.md](docs/plan.md) 참고.

## 실행

```bash
npm install
npm run dev     # 개발 서버
npm test        # 파서 단위 테스트 (Vitest)
npm run build   # 타입체크 + 프로덕션 빌드
```

## 구조

```
src/
  parser/          # UI와 분리된 순수 TS 파서 (테스트 대상)
    model.ts       #   공통 문서 모델 (Paragraph/Run/Table)
    detect.ts      #   매직 바이트 포맷 감지 (ZIP=PK → hwpx, CFB → hwp)
    hwpx/parse.ts  #   HWPX: fflate ZIP 해제 + DOMParser XML 파싱
    hwp/preview.ts #   HWP 5.x: cfb로 FileHeader/PrvText 스트림 읽기
  viewer/          # React 렌더링 (DropZone, DocumentView)
```

설계 원칙: 두 포맷의 파서가 하나의 공통 문서 모델로 수렴하고, 렌더러는 모델만 안다.

## 지원하지 않는 것

- 암호화된 HWP, 배포용(DRM) 문서 — 기술적으로 열 수 없어 안내 메시지를 표시
- 한글 3.x 이하의 옛 포맷
- 한글과 동일한 페이지 레이아웃 재현 (목표는 "읽기용 뷰어")
