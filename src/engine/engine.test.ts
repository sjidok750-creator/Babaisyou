import { describe, expect, it } from 'vitest';
import {
  MAX_TICKS,
  blockAt,
  boardsEqual,
  checkWin,
  detectLoop,
  makeBoard,
  nextTick,
  runSimulation,
} from './engine';
import type { Rule } from './types';

const R = (rule: Rule): Rule => rule;

describe('이동 (move)', () => {
  it('빈 칸으로 한 칸 이동한다', () => {
    const board = makeBoard(
      ['.....', '.....', '.....'],
      [{ x: 0, y: 1, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'move', dir: 'right' },
    });
    const { board: next, events } = nextTick(board, [rule]);
    expect(blockAt(next, 1, 1)?.color).toBe('red');
    expect(events).toEqual([
      {
        type: 'move',
        blockId: 1,
        from: { x: 0, y: 1 },
        to: { x: 1, y: 1 },
        ruleIndex: 0,
      },
    ]);
  });

  it('벽/보드 밖으로는 이동하지 못한다 (불발 = 행동 아님)', () => {
    const board = makeBoard(
      ['..W', '...'],
      [{ x: 1, y: 0, color: 'red', shape: 'circle' }],
    );
    const wallRule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'right' },
    });
    const upRule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'up' },
    });
    // 오른쪽은 벽, 위는 보드 밖 → 두 규칙 다 불발
    const { board: next, events } = nextTick(board, [wallRule, upRule]);
    expect(blockAt(next, 1, 0)).toBeDefined();
    expect(events).toHaveLength(0);
  });

  it('다른 블록이 있는 칸으로 이동하지 못한다 (충돌)', () => {
    const board = makeBoard(
      ['....'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle' },
        { x: 1, y: 0, color: 'blue', shape: 'circle' },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'move', dir: 'right' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(blockAt(next, 0, 0)?.color).toBe('red');
    expect(blockAt(next, 1, 0)?.color).toBe('blue');
  });

  it('스캔 순서(좌상→우하) 덕분에 같은 방향의 행렬 이동이 한 틱에 전진한다', () => {
    // 두 블록이 위로 이동: 위쪽 블록이 먼저 움직여 자리를 비워준다
    const board = makeBoard(
      ['...', '.b.', '.r.'],
      [
        { x: 1, y: 1, color: 'blue', shape: 'circle' },
        { x: 1, y: 2, color: 'red', shape: 'circle' },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'up' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(blockAt(next, 1, 0)?.color).toBe('blue');
    expect(blockAt(next, 1, 1)?.color).toBe('red');
  });

  it('소멸 셀(void)로 이동하면 블록이 제거된다', () => {
    const board = makeBoard(
      ['.V.'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'right' },
    });
    const { board: next, events } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual(['move', 'destroy']);
  });
});

describe('행동 1회 제한', () => {
  it('한 틱에 성공적으로 행동한 블록은 이후 규칙의 영향을 받지 않는다', () => {
    const board = makeBoard(
      ['.....'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle' }],
    );
    const right = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'right' },
    });
    const { board: next } = nextTick(board, [right, right]);
    // 두 규칙 다 오른쪽 이동이지만 1칸만 이동
    expect(blockAt(next, 1, 0)).toBeDefined();
  });

  it('행동이 불발된 블록은 이후 규칙에서 행동할 수 있다', () => {
    // 왼쪽 이동은 벽에 막혀 불발 → 다음 규칙(위 이동)이 적용됨
    const board = makeBoard(
      ['...', '...'],
      [{ x: 0, y: 1, color: 'red', shape: 'circle' }],
    );
    const left = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'left' },
    });
    const up = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'up' },
    });
    const { board: next } = nextTick(board, [left, up]);
    expect(blockAt(next, 0, 0)).toBeDefined();
  });
});

describe('합체 (merge)', () => {
  it('같은 색·같은 등급 인접 블록과 합쳐 등급이 오른다 (상대 선택: 위>왼>오>아래)', () => {
    const board = makeBoard(
      ['...', 'rr.', '.r.'],
      [
        { x: 0, y: 1, color: 'red', shape: 'circle' }, // id 1 — 행동 주체(스캔 첫번째)
        { x: 1, y: 1, color: 'red', shape: 'circle' }, // id 2 — 오른쪽
        { x: 1, y: 2, color: 'red', shape: 'circle' }, // id 3
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'merge' },
    });
    const { board: next, events } = nextTick(board, [rule]);
    // id1이 오른쪽 이웃 id2를 흡수 (위/왼쪽 이웃 없음)
    const merged = blockAt(next, 0, 1);
    expect(merged?.id).toBe(1);
    expect(merged?.tier).toBe(2);
    // id3은 남은 인접 동색이 없어 불발
    expect(blockAt(next, 1, 2)?.tier).toBe(1);
    expect(events).toHaveLength(1);
  });

  it('등급이 다르면 합쳐지지 않는다', () => {
    const board = makeBoard(
      ['rr'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle', tier: 2 },
        { x: 1, y: 0, color: 'red', shape: 'circle', tier: 1 },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'merge' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(2);
  });

  it('합체에 소비된 블록은 같은 틱에서 다시 행동/소비되지 않는다', () => {
    // r r r 가로 3개: id1이 id2를 흡수. id3은 id2가 사라져 상대가 없음
    const board = makeBoard(
      ['rrr'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle' },
        { x: 1, y: 0, color: 'red', shape: 'circle' },
        { x: 2, y: 0, color: 'red', shape: 'circle' },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'merge' },
    });
    const { board: next, events } = nextTick(board, [rule]);
    expect(events).toHaveLength(1);
    expect(next.blocks).toHaveLength(2);
    expect(blockAt(next, 0, 0)?.tier).toBe(2);
    expect(blockAt(next, 2, 0)?.tier).toBe(1);
  });

  it('3등급은 더 이상 합쳐지지 않는다', () => {
    const board = makeBoard(
      ['rr'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle', tier: 3 },
        { x: 1, y: 0, color: 'red', shape: 'circle', tier: 3 },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'merge' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(2);
  });
});

describe('frozen 면역', () => {
  it('frozen 블록은 이동/색변환 규칙에 걸리지 않는다', () => {
    const board = makeBoard(
      ['...'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle', state: 'frozen' }],
    );
    const move = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'right' },
    });
    const paint = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'paint', color: 'blue' },
    });
    const { board: next, events } = nextTick(board, [move, paint]);
    expect(blockAt(next, 0, 0)?.color).toBe('red');
    expect(events).toHaveLength(0);
  });

  it('frozen 블록은 합체 상대로 소비되지 않는다', () => {
    const board = makeBoard(
      ['rr'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle' },
        { x: 1, y: 0, color: 'red', shape: 'circle', state: 'frozen' },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'merge' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(2);
    expect(blockAt(next, 0, 0)?.tier).toBe(1);
  });

  it('freezeToggle은 frozen 블록에도 적용되어 녹인다', () => {
    const board = makeBoard(
      ['..'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle', state: 'frozen' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'freezeToggle' },
    });
    const { board: next, events } = nextTick(board, [rule]);
    expect(blockAt(next, 0, 0)?.state).toBe('normal');
    expect(events[0]).toMatchObject({ type: 'freeze', frozen: false });
  });
});

describe('복제 (clone)', () => {
  it('빈 인접 칸(위>왼>오>아래 순)으로 복제된다', () => {
    const board = makeBoard(
      ['W..', '.r.', '...'],
      [{ x: 1, y: 1, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'clone' },
    });
    // 위 (1,0)은 floor → 위로 복제
    const { board: next, events } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(2);
    expect(blockAt(next, 1, 0)?.color).toBe('red');
    expect(events[0]).toMatchObject({ type: 'clone', newId: 2 });
    expect(next.nextId).toBe(3);
  });

  it('복제된 새 블록은 같은 틱의 이후 규칙에 영향을 받는다', () => {
    const board = makeBoard(
      ['...'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle' }],
    );
    const clone = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'clone' },
    });
    const paint = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'paint', color: 'blue' },
    });
    const { board: next } = nextTick(board, [clone, paint]);
    // 원본은 복제로 행동 완료 → 빨강 유지. 새 블록은 파랑으로 칠해짐
    const colors = next.blocks.map((b) => b.color).sort();
    expect(colors).toEqual(['blue', 'red']);
  });

  it('빈 인접 칸이 없으면 복제는 불발된다 (void/벽에는 복제 불가)', () => {
    const board = makeBoard(
      ['WrV'],
      [{ x: 1, y: 0, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'clone' },
    });
    const { board: next, events } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(1);
    expect(events).toHaveLength(0);
  });
});

describe('조건 (WHEN)', () => {
  it('adjacent: 지정 색과 인접할 때만 발동한다', () => {
    const board = makeBoard(
      ['rb.', '..r'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle' },
        { x: 1, y: 0, color: 'blue', shape: 'circle' },
        { x: 2, y: 1, color: 'red', shape: 'circle' },
      ],
    );
    const rule = R({
      when: { kind: 'adjacent', color: 'blue' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'paint', color: 'green' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(blockAt(next, 0, 0)?.color).toBe('green'); // 파랑과 인접
    expect(blockAt(next, 2, 1)?.color).toBe('red'); // 인접 아님(대각선 불인정)
  });

  it('group: 같은 색 N개 이상 연결 시 발동한다', () => {
    const board = makeBoard(
      ['rr.', 'r.r'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle' },
        { x: 1, y: 0, color: 'red', shape: 'circle' },
        { x: 0, y: 1, color: 'red', shape: 'circle' },
        { x: 2, y: 1, color: 'red', shape: 'circle' }, // 고립
      ],
    );
    const rule = R({
      when: { kind: 'group', count: 3 },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'paint', color: 'blue' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(blockAt(next, 0, 0)?.color).toBe('blue');
    expect(blockAt(next, 1, 0)?.color).toBe('blue');
    expect(blockAt(next, 0, 1)?.color).toBe('blue');
    expect(blockAt(next, 2, 1)?.color).toBe('red'); // 그룹 크기 1
  });

  it('atWall: 벽 셀 또는 보드 가장자리와 인접할 때 발동한다', () => {
    const board = makeBoard(
      ['.....', '..W..', '.....'],
      [
        { x: 0, y: 1, color: 'red', shape: 'circle' }, // 왼쪽 가장자리
        { x: 3, y: 1, color: 'blue', shape: 'circle' }, // 벽 옆
        { x: 2, y: 0, color: 'green', shape: 'circle' }, // 위 가장자리+벽 아래
        { x: 3, y: 2, color: 'yellow', shape: 'circle' }, // 아래 가장자리
      ],
    );
    const rule = R({
      when: { kind: 'atWall' },
      target: { kind: 'all' },
      action: { kind: 'paint', color: 'red' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(next.blocks.every((b) => b.color === 'red')).toBe(true);
  });

  it('onGoal: 목표 셀 위에서만 발동한다', () => {
    const board = makeBoard(
      ['G.'],
      [
        { x: 0, y: 0, color: 'red', shape: 'circle' },
        { x: 1, y: 0, color: 'red', shape: 'square' },
      ],
    );
    const rule = R({
      when: { kind: 'onGoal' },
      target: { kind: 'all' },
      action: { kind: 'paint', color: 'blue' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(blockAt(next, 0, 0)?.color).toBe('blue');
    expect(blockAt(next, 1, 0)?.color).toBe('red');
  });
});

describe('대상 (TARGET)', () => {
  it('edge: 가장 위 블록 하나만 대상이 된다 (동률은 스캔 순서 우선)', () => {
    const board = makeBoard(
      ['.r.', 'b.g'],
      [
        { x: 1, y: 0, color: 'red', shape: 'circle' },
        { x: 0, y: 1, color: 'blue', shape: 'circle' },
        { x: 2, y: 1, color: 'green', shape: 'circle' },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'edge', dir: 'up' },
      action: { kind: 'paint', color: 'yellow' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(blockAt(next, 1, 0)?.color).toBe('yellow');
    expect(blockAt(next, 0, 1)?.color).toBe('blue');
  });

  it('shape 대상: 모양이 일치하는 블록만 대상이 된다', () => {
    const board = makeBoard(
      ['...'],
      [
        { x: 0, y: 0, color: 'red', shape: 'triangle' },
        { x: 2, y: 0, color: 'red', shape: 'circle' },
      ],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'shape', shape: 'triangle' },
      action: { kind: 'destroy' },
    });
    const { board: next } = nextTick(board, [rule]);
    expect(next.blocks).toHaveLength(1);
    expect(next.blocks[0]?.shape).toBe('circle');
  });
});

describe('규칙 순서 (우선순위)', () => {
  it('같은 두 카드라도 순서가 다르면 결과가 다르다', () => {
    // A: 벽에 닿으면 위로 / B: 항상 오른쪽으로
    const rows = ['.....', '.....', '.....', '.....', '.....'];
    const blocks = [{ x: 0, y: 4, color: 'red', shape: 'circle' } as const];
    const ruleA = R({
      when: { kind: 'atWall' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'move', dir: 'up' },
    });
    const ruleB = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'move', dir: 'right' },
    });
    const simAB = runSimulation(
      makeBoard(rows, [...blocks]),
      [ruleA, ruleB],
      { kind: 'onGoal', count: 99 }, // 승리 없이 궤적만 관찰
      4,
    );
    const simBA = runSimulation(
      makeBoard(rows, [...blocks]),
      [ruleB, ruleA],
      { kind: 'onGoal', count: 99 },
      4,
    );
    const lastAB = simAB.history[simAB.history.length - 1]?.board.blocks[0];
    const lastBA = simBA.history[simBA.history.length - 1]?.board.blocks[0];
    // A 먼저: 왼쪽 벽을 타고 위로 / B 먼저: 바닥을 타고 오른쪽으로
    expect(lastAB).toMatchObject({ x: 0, y: 0 });
    expect(lastBA).toMatchObject({ x: 4, y: 4 });
  });
});

describe('시뮬레이션 종료 판정', () => {
  it('안정 상태(직전 틱과 동일)를 실패로 감지한다', () => {
    const board = makeBoard(
      ['..'],
      [{ x: 1, y: 0, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'move', dir: 'right' },
    });
    const sim = runSimulation(board, [rule], { kind: 'clearAll' });
    expect(sim.outcome).toBe('stable');
    expect(sim.ticks).toBe(1);
  });

  it('과거 상태로 되돌아오는 순환(주기 2)을 loop로 감지한다', () => {
    // freezeToggle 단독 → 얼었다 녹았다 무한 반복
    const board = makeBoard(
      ['..'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'all' },
      action: { kind: 'freezeToggle' },
    });
    const sim = runSimulation(board, [rule], { kind: 'clearAll' });
    expect(sim.outcome).toBe('loop');
    expect(sim.ticks).toBe(2);
    expect(detectLoop(sim.history)).toBe(0);
  });

  it('틱 상한을 초과하면 loop 판정한다 (기본 상한 30)', () => {
    expect(MAX_TICKS).toBe(30);
    // 복제 증식은 매 틱 보드를 바꾸므로 상한까지 도달한다
    const rows = Array.from({ length: 8 }, () => '........');
    const board = makeBoard(rows, [
      { x: 0, y: 0, color: 'red', shape: 'circle' },
    ]);
    const clone = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'clone' },
    });
    const sim = runSimulation(board, [clone], { kind: 'onGoal', count: 1 }, 4);
    expect(sim.outcome).toBe('loop');
    expect(sim.ticks).toBe(4);
  });

  it('승리 시 즉시 종료하고 틱 수를 보고한다', () => {
    const board = makeBoard(
      ['....G'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle' }],
    );
    const rule = R({
      when: { kind: 'always' },
      target: { kind: 'color', color: 'red' },
      action: { kind: 'move', dir: 'right' },
    });
    const sim = runSimulation(board, [rule], {
      kind: 'onGoal',
      color: 'red',
      count: 1,
    });
    expect(sim.outcome).toBe('win');
    expect(sim.ticks).toBe(4);
  });
});

describe('승리 조건', () => {
  it('line: 가로로 연속 N개 (색 필터) 판정', () => {
    const board = makeBoard(
      ['bbb', '...'],
      [
        { x: 0, y: 0, color: 'blue', shape: 'circle' },
        { x: 1, y: 0, color: 'blue', shape: 'square' },
        { x: 2, y: 0, color: 'blue', shape: 'circle' },
      ],
    );
    expect(
      checkWin(board, { kind: 'line', color: 'blue', count: 3, orientation: 'row' }, 1),
    ).toBe(true);
    expect(
      checkWin(board, { kind: 'line', color: 'blue', count: 3, orientation: 'col' }, 1),
    ).toBe(false);
  });

  it('exactTicks: 정확히 N틱에 도달해야만 승리', () => {
    const board = makeBoard(
      ['G..'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle' }],
    );
    const win = {
      kind: 'exactTicks',
      ticks: 3,
      win: { kind: 'onGoal', count: 1 },
    } as const;
    expect(checkWin(board, win, 2)).toBe(false);
    expect(checkWin(board, win, 3)).toBe(true);
  });

  it('tier: 지정 등급 이상 블록 개수 판정', () => {
    const board = makeBoard(
      ['r.'],
      [{ x: 0, y: 0, color: 'red', shape: 'circle', tier: 3 }],
    );
    expect(checkWin(board, { kind: 'tier', tier: 3, count: 1 }, 1)).toBe(true);
    expect(
      checkWin(board, { kind: 'tier', tier: 3, count: 1, color: 'blue' }, 1),
    ).toBe(false);
  });
});

describe('결정론', () => {
  it('같은 입력은 항상 같은 결과를 낸다', () => {
    const rows = ['......', '..W...', '.V....', '......'];
    const blocks = [
      { x: 0, y: 0, color: 'red', shape: 'circle' },
      { x: 3, y: 3, color: 'blue', shape: 'square' },
      { x: 5, y: 0, color: 'red', shape: 'triangle' },
    ] as const;
    const rules: Rule[] = [
      {
        when: { kind: 'always' },
        target: { kind: 'color', color: 'red' },
        action: { kind: 'move', dir: 'down' },
      },
      {
        when: { kind: 'adjacent', color: 'red' },
        target: { kind: 'color', color: 'blue' },
        action: { kind: 'clone' },
      },
      {
        when: { kind: 'group', count: 2 },
        target: { kind: 'all' },
        action: { kind: 'merge' },
      },
    ];
    const a = runSimulation(makeBoard(rows, [...blocks]), rules, {
      kind: 'clearAll',
    });
    const b = runSimulation(makeBoard(rows, [...blocks]), rules, {
      kind: 'clearAll',
    });
    expect(a.outcome).toBe(b.outcome);
    expect(a.ticks).toBe(b.ticks);
    a.history.forEach((h, i) => {
      const other = b.history[i];
      expect(other).toBeDefined();
      if (other) expect(boardsEqual(h.board, other.board)).toBe(true);
    });
  });
});
