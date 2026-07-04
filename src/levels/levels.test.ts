import { describe, expect, it } from 'vitest';
import { runSimulation } from '../engine/engine';
import type { Rule } from '../engine/types';
import { LEVELS, calcStars, getLevel, levelToBoard } from './index';

describe('레벨 데이터', () => {
  it('12개 레벨이 모두 로드되고 id가 1~12로 연속된다', () => {
    expect(LEVELS).toHaveLength(12);
    LEVELS.forEach((lv, i) => expect(lv.id).toBe(i + 1));
  });

  it('슬롯 수가 스펙 범위(1~5) 안에 있고 난이도 순으로 증가한다', () => {
    for (const lv of LEVELS) {
      expect(lv.slots).toBeGreaterThanOrEqual(1);
      expect(lv.slots).toBeLessThanOrEqual(5);
    }
    // 튜토리얼(1~3): 1슬롯, 4~6: 2슬롯, 7~9: 3슬롯, 10~12: 4~5슬롯
    expect(LEVELS.slice(0, 3).every((lv) => lv.slots === 1)).toBe(true);
    expect(LEVELS.slice(3, 6).every((lv) => lv.slots === 2)).toBe(true);
    expect(LEVELS.slice(6, 9).every((lv) => lv.slots === 3)).toBe(true);
    expect(LEVELS.slice(9, 12).every((lv) => lv.slots >= 4 && lv.slots <= 5)).toBe(
      true,
    );
  });

  it('모든 solution 카드는 해당 레벨의 카드 어휘로 조립 가능하다', () => {
    for (const lv of LEVELS) {
      const has = (pool: unknown[], piece: unknown): boolean =>
        pool.some((p) => JSON.stringify(p) === JSON.stringify(piece));
      for (const rule of lv.solution) {
        expect(has(lv.cards.when, rule.when), `L${lv.id} 조건`).toBe(true);
        expect(has(lv.cards.target, rule.target), `L${lv.id} 대상`).toBe(true);
        expect(has(lv.cards.action, rule.action), `L${lv.id} 행동`).toBe(true);
      }
    }
  });
});

describe('레벨 solution 시뮬레이션 검증 (클리어 가능성 보증)', () => {
  for (const lv of LEVELS) {
    it(`레벨 ${lv.id} 「${lv.name}」 — solution이 클리어된다 (par 이내)`, () => {
      const sim = runSimulation(levelToBoard(lv), lv.solution as Rule[], lv.win);
      expect(sim.outcome).toBe('win');
      // par는 solution 기준으로 3별이 가능해야 한다
      expect(sim.ticks).toBeLessThanOrEqual(lv.par.ticks);
      expect(lv.solution.length).toBeLessThanOrEqual(lv.par.rules);
      expect(calcStars(lv, lv.solution.length, sim.ticks)).toBe(3);
    });

    it(`레벨 ${lv.id} — 규칙 없이는 클리어되지 않는다`, () => {
      const sim = runSimulation(levelToBoard(lv), [], lv.win);
      expect(sim.outcome).not.toBe('win');
    });
  }
});

describe('설계 의도 검증', () => {
  it('레벨 5: 같은 카드 2장, 순서를 바꾸면 실패한다 (순서 퍼즐)', () => {
    const lv = getLevel(5);
    const [a, b] = lv.solution as Rule[];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (!a || !b) return;
    const swapped = runSimulation(levelToBoard(lv), [b, a], lv.win);
    expect(swapped.outcome).not.toBe('win');
    // 뒤바꾼 순서에서는 블록이 소멸 칸에 빨려들어간다
    const destroyed = swapped.history.some((h) =>
      h.events.some((e) => e.type === 'destroy' && e.cause === 'void'),
    );
    expect(destroyed).toBe(true);
  });

  it('레벨 9: 탈출 규칙(색칠)이 복제 규칙보다 뒤에 오면 실패한다', () => {
    const lv = getLevel(9);
    const [paint, clone] = lv.solution as Rule[];
    expect(paint).toBeDefined();
    expect(clone).toBeDefined();
    if (!paint || !clone) return;
    const swapped = runSimulation(levelToBoard(lv), [clone, paint], lv.win);
    expect(swapped.outcome).not.toBe('win');
  });

  it('레벨 9: 복제 단독은 무한 증식 후 안정 상태로 실패한다 (루프 탈출 필요)', () => {
    const lv = getLevel(9);
    const clone = lv.solution[1] as Rule;
    const sim = runSimulation(levelToBoard(lv), [clone], lv.win);
    expect(sim.outcome).not.toBe('win');
    // 복제는 실제로 여러 번 일어난다 (의도적 루프)
    const cloneCount = sim.history
      .flatMap((h) => h.events)
      .filter((e) => e.type === 'clone').length;
    expect(cloneCount).toBeGreaterThanOrEqual(3);
  });

  it('레벨 7: 얼리지 않으면 노란 블록이 소멸 칸에서 사라져 실패한다', () => {
    const lv = getLevel(7);
    const moveAll = lv.solution[1] as Rule;
    const sim = runSimulation(levelToBoard(lv), [moveAll], lv.win);
    expect(sim.outcome).not.toBe('win');
    const yellowDied = sim.history.some((h) =>
      h.events.some((e) => e.type === 'destroy' && e.cause === 'void'),
    );
    expect(yellowDied).toBe(true);
  });

  it('레벨 10: 녹이는 규칙 없이는 frozen 블록이 남아 실패한다', () => {
    const lv = getLevel(10);
    const rules = (lv.solution as Rule[]).filter(
      (r) => r.action.kind !== 'freezeToggle',
    );
    const sim = runSimulation(levelToBoard(lv), rules, lv.win);
    expect(sim.outcome).not.toBe('win');
    const last = sim.history[sim.history.length - 1];
    expect(last?.board.blocks.some((b) => b.state === 'frozen')).toBe(true);
  });

  it('레벨 11: exactTicks — 정확히 5틱에 도달해야 승리한다', () => {
    const lv = getLevel(11);
    const sim = runSimulation(levelToBoard(lv), lv.solution as Rule[], lv.win);
    expect(sim.outcome).toBe('win');
    expect(sim.ticks).toBe(5);
  });

  it('레벨 12: 얼음 제거 없이 복제+합체만으로는 실패한다 (보스 설계)', () => {
    const lv = getLevel(12);
    const rules = (lv.solution as Rule[]).filter(
      (r) => r.target.kind === 'color' && r.target.color === 'red',
    );
    const sim = runSimulation(levelToBoard(lv), rules, lv.win);
    expect(sim.outcome).not.toBe('win');
  });

  it('레벨 12: 녹이기 규칙이 내리기 규칙보다 앞에 오면 토글 반복에 갇혀 실패한다', () => {
    const lv = getLevel(12);
    const [down, toggle, merge, clone] = lv.solution as Rule[];
    if (!down || !toggle || !merge || !clone) throw new Error('solution 형식 오류');
    const swapped = runSimulation(
      levelToBoard(lv),
      [toggle, down, merge, clone],
      lv.win,
    );
    expect(swapped.outcome).not.toBe('win');
  });
});
