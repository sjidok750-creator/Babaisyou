# 규칙 대장간 — Rule Smith

> 보드를 만지지 마라. 규칙을 벼려라.

모바일 웹 퍼즐 게임. 플레이어는 보드를 직접 조작할 수 없다. `[조건] + [대상] + [행동]` 세 조각으로 규칙 카드를 조립해 슬롯에 배치하면, 보드가 그 규칙에 따라 틱 단위로 **결정론적으로** 실행된다. 목표 상태를 만드는 규칙 조합을 설계하는 것이 퍼즐이다.

Baba Is You가 규칙을 *발견*하는 게임이라면, 규칙 대장간은 규칙을 *설계*하는 게임이다. 조건-행동, 실행 순서, 부작용 — 프로그래밍의 본질을 코드 없이 체험한다.

## 실행

```bash
npm install
npm run dev        # 개발 서버
npm run test       # 엔진 단위 테스트 + 12개 레벨 solution 시뮬레이션 검증
npm run build      # 프로덕션 빌드 (tsc strict + vite + PWA)
npm run preview    # 빌드 결과 확인
```

배포: Netlify (`netlify.toml` 포함, publish=`dist`). 외부 서버/DB 없음 — 진행도는 localStorage(Zustand persist).

## 게임 규칙 요약

- **틱 실행**: 매 틱 규칙을 슬롯 순서(1→n)로 평가. 각 규칙은 보드 스캔 순서(좌상→우하)로 적용. 한 틱에 행동한 블록은 그 틱에서 다시 행동하지 않는다.
- **종료 판정**: 목표 달성 → 클리어 / 직전 틱과 동일(안정) → 실패 / 상태 순환·30틱 초과 → 무한 루프 실패.
- **frozen**: 얼어붙은 블록은 얼음 토글 외의 규칙에 면역이고 합체 상대로도 소비되지 않는다.
- **별점**: 클리어 1★ + 규칙 수 ≤ 기준 1★ + 틱 수 ≤ 기준 1★.

결정론 규약의 세부(이웃 탐색 순서, 복제 블록의 행동 자격 등)는 `src/engine/engine.ts` 상단 주석과 테스트에 명세되어 있다.

## 구조

```
src/
  engine/          # 순수 로직 (React 의존성 0) — types, nextTick/checkWin/runSimulation, 테스트
  levels/          # 레벨 12개 JSON + 스키마 검증 + solution 시뮬레이션 테스트
  store/           # Zustand (게임 상태, 진행도 persist)
  components/      # Board, RuleSlots, CardDrawer, TickVisualizer, ResultModal
  screens/         # Title, LevelSelect, Game
  audio/           # Web Audio 절차적 사운드 (외부 오디오 파일 없음)
```

모든 레벨 JSON은 검증된 정답을 `solution` 필드로 포함하며, 테스트가 엔진 시뮬레이션으로 "3별 클리어 가능"을 보증한다. 레벨 5는 같은 카드 2장의 순서만 바꾸면 성패가 갈리고, 레벨 9는 의도적 무한 증식을 탈출 규칙으로 끊어야 하며 — 이 설계 의도들 역시 테스트로 고정되어 있다.

## 기술 스택

React 18 · Vite · TypeScript(strict) · Tailwind CSS · Zustand · Framer Motion · vite-plugin-pwa · Vitest
