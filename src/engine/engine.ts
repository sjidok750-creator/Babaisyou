/**
 * 규칙 대장간 — 결정론적 실행 엔진 (순수 함수, React 의존성 0)
 *
 * 결정론 규약 (테스트로 고정됨):
 *  - 틱마다 규칙을 슬롯 순서(0→n)로 평가한다.
 *  - 각 규칙의 대상 목록은 "규칙 시작 시점"의 보드 스냅샷에서
 *    스캔 순서(좌상단→우하단, y 우선)로 확정된 뒤 순서대로 적용된다.
 *  - 성공적으로 행동한 블록은 그 틱에서 다시 행동하지 않는다.
 *    (행동이 불발되면 — 이동이 막히는 등 — 행동한 것으로 치지 않는다)
 *  - 복제로 생성된 새 블록은 "행동한 것"이 아니므로 같은 틱의 이후
 *    규칙에 영향을 받을 수 있다. (단, 이미 지나간 규칙에는 안 걸린다)
 *  - frozen 블록은 freezeToggle 외의 어떤 규칙에도 걸리지 않고,
 *    합체 상대로도 소비되지 않는다.
 *  - 이웃 탐색 순서(합체 상대 선택, 복제 위치)는 위→왼→오→아래 고정.
 *  - 보드 밖은 벽으로 취급한다.
 *  - 랜덤 요소 없음. 같은 입력 → 항상 같은 출력.
 */

import type {
  Action,
  Block,
  Board,
  CellType,
  Condition,
  Dir,
  GameEvent,
  Rule,
  SimResult,
  Target,
  TickResult,
  WinCondition,
} from './types';

export const MAX_TICKS = 30;

const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/** 이웃 탐색 고정 순서: 위 → 왼 → 오 → 아래 */
const NEIGHBOR_ORDER: Dir[] = ['up', 'left', 'right', 'down'];

export function cellAt(board: Board, x: number, y: number): CellType {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return 'wall';
  return board.cells[y * board.width + x] ?? 'wall';
}

export function blockAt(board: Board, x: number, y: number): Block | undefined {
  return board.blocks.find((b) => b.x === x && b.y === y);
}

function cloneBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    cells: board.cells, // 셀은 불변 — 공유해도 안전
    blocks: board.blocks.map((b) => ({ ...b })),
    nextId: board.nextId,
  };
}

/** 스캔 순서: 좌상단 → 우하단 (y 우선, 그다음 x) */
function scanSort(blocks: Block[]): Block[] {
  return [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
}

/* ------------------------------ 조건 평가 ------------------------------ */

function matchesFilter(block: Block, color?: string, shape?: string): boolean {
  if (color !== undefined && block.color !== color) return false;
  if (shape !== undefined && block.shape !== shape) return false;
  return true;
}

function groupSize(board: Board, start: Block): number {
  const visited = new Set<number>([start.id]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    for (const dir of NEIGHBOR_ORDER) {
      const { dx, dy } = DELTA[dir];
      const nb = blockAt(board, cur.x + dx, cur.y + dy);
      if (nb && nb.color === start.color && !visited.has(nb.id)) {
        visited.add(nb.id);
        queue.push(nb);
      }
    }
  }
  return visited.size;
}

export function checkCondition(
  board: Board,
  block: Block,
  cond: Condition,
): boolean {
  switch (cond.kind) {
    case 'always':
      return true;
    case 'adjacent':
      return NEIGHBOR_ORDER.some((dir) => {
        const { dx, dy } = DELTA[dir];
        const nb = blockAt(board, block.x + dx, block.y + dy);
        return nb !== undefined && matchesFilter(nb, cond.color, cond.shape);
      });
    case 'group':
      return groupSize(board, block) >= cond.count;
    case 'atWall':
      return NEIGHBOR_ORDER.some((dir) => {
        const { dx, dy } = DELTA[dir];
        return cellAt(board, block.x + dx, block.y + dy) === 'wall';
      });
    case 'onGoal':
      return cellAt(board, block.x, block.y) === 'goal';
  }
}

/* ------------------------------ 대상 선택 ------------------------------ */

function matchesTarget(block: Block, target: Target): boolean {
  switch (target.kind) {
    case 'color':
      return block.color === target.color;
    case 'shape':
      return block.shape === target.shape;
    case 'all':
      return true;
    case 'edge':
      return true; // edge는 selectTargets에서 별도 처리
  }
}

/** edge 대상: 전체 블록 중 극단 블록 하나 (동률이면 스캔 순서 우선) */
function edgeBlock(board: Board, dir: Dir): Block | undefined {
  if (board.blocks.length === 0) return undefined;
  const sorted = scanSort(board.blocks);
  let best = sorted[0];
  if (!best) return undefined;
  for (const b of sorted) {
    if (dir === 'up' && b.y < best.y) best = b;
    else if (dir === 'down' && b.y > best.y) best = b;
    else if (dir === 'left' && b.x < best.x) best = b;
    else if (dir === 'right' && b.x > best.x) best = b;
  }
  return best;
}

/**
 * 규칙 시작 시점 스냅샷에서 대상 블록 id 목록 확정.
 * frozen 블록은 freezeToggle 액션이 아니면 제외.
 */
function selectTargets(board: Board, rule: Rule, acted: Set<number>): number[] {
  const allowFrozen = rule.action.kind === 'freezeToggle';
  let candidates: Block[];
  if (rule.target.kind === 'edge') {
    const b = edgeBlock(board, rule.target.dir);
    candidates = b ? [b] : [];
  } else {
    candidates = scanSort(board.blocks).filter((b) =>
      matchesTarget(b, rule.target),
    );
  }
  return candidates
    .filter((b) => !acted.has(b.id))
    .filter((b) => allowFrozen || b.state !== 'frozen')
    .filter((b) => checkCondition(board, b, rule.when))
    .map((b) => b.id);
}

/* ------------------------------ 행동 적용 ------------------------------ */

function removeBlock(board: Board, id: number): void {
  board.blocks = board.blocks.filter((b) => b.id !== id);
}

/** 행동을 적용하고, 실제로 무언가 일어났으면 true */
function applyAction(
  board: Board,
  block: Block,
  action: Action,
  ruleIndex: number,
  acted: Set<number>,
  events: GameEvent[],
): boolean {
  switch (action.kind) {
    case 'move': {
      const { dx, dy } = DELTA[action.dir];
      const nx = block.x + dx;
      const ny = block.y + dy;
      const cell = cellAt(board, nx, ny);
      if (cell === 'wall') return false;
      if (blockAt(board, nx, ny)) return false;
      const from = { x: block.x, y: block.y };
      block.x = nx;
      block.y = ny;
      events.push({
        type: 'move',
        blockId: block.id,
        from,
        to: { x: nx, y: ny },
        ruleIndex,
      });
      if (cell === 'void') {
        removeBlock(board, block.id);
        events.push({
          type: 'destroy',
          blockId: block.id,
          at: { x: nx, y: ny },
          cause: 'void',
          ruleIndex,
        });
      }
      return true;
    }
    case 'paint': {
      if (block.color === action.color) return false;
      const from = block.color;
      block.color = action.color;
      events.push({
        type: 'paint',
        blockId: block.id,
        at: { x: block.x, y: block.y },
        from,
        to: action.color,
        ruleIndex,
      });
      return true;
    }
    case 'merge': {
      if (block.tier >= 3) return false;
      for (const dir of NEIGHBOR_ORDER) {
        const { dx, dy } = DELTA[dir];
        const partner = blockAt(board, block.x + dx, block.y + dy);
        if (
          partner &&
          partner.id !== block.id &&
          partner.color === block.color &&
          partner.tier === block.tier &&
          partner.state !== 'frozen'
        ) {
          const from = { x: partner.x, y: partner.y };
          removeBlock(board, partner.id);
          acted.add(partner.id);
          block.tier += 1;
          events.push({
            type: 'merge',
            keptId: block.id,
            removedId: partner.id,
            at: { x: block.x, y: block.y },
            from,
            tier: block.tier,
            ruleIndex,
          });
          return true;
        }
      }
      return false;
    }
    case 'destroy': {
      removeBlock(board, block.id);
      events.push({
        type: 'destroy',
        blockId: block.id,
        at: { x: block.x, y: block.y },
        cause: 'rule',
        ruleIndex,
      });
      return true;
    }
    case 'clone': {
      for (const dir of NEIGHBOR_ORDER) {
        const { dx, dy } = DELTA[dir];
        const nx = block.x + dx;
        const ny = block.y + dy;
        const cell = cellAt(board, nx, ny);
        if ((cell === 'floor' || cell === 'goal') && !blockAt(board, nx, ny)) {
          const newBlock: Block = {
            id: board.nextId,
            x: nx,
            y: ny,
            color: block.color,
            shape: block.shape,
            state: 'normal',
            tier: block.tier,
          };
          board.nextId += 1;
          board.blocks.push(newBlock);
          events.push({
            type: 'clone',
            sourceId: block.id,
            newId: newBlock.id,
            from: { x: block.x, y: block.y },
            to: { x: nx, y: ny },
            ruleIndex,
          });
          return true;
        }
      }
      return false;
    }
    case 'freezeToggle': {
      const frozen = block.state !== 'frozen';
      block.state = frozen ? 'frozen' : 'normal';
      events.push({
        type: 'freeze',
        blockId: block.id,
        at: { x: block.x, y: block.y },
        frozen,
        ruleIndex,
      });
      return true;
    }
  }
}

/* ------------------------------ 틱 실행 ------------------------------ */

export function nextTick(board: Board, rules: Rule[]): TickResult {
  const b = cloneBoard(board);
  const events: GameEvent[] = [];
  const acted = new Set<number>();

  rules.forEach((rule, ruleIndex) => {
    const targetIds = selectTargets(b, rule, acted);
    for (const id of targetIds) {
      const block = b.blocks.find((blk) => blk.id === id);
      if (!block) continue; // 이 규칙 진행 중 소멸됨 (합체 소비 등)
      if (acted.has(id)) continue;
      const didAct = applyAction(b, block, rule.action, ruleIndex, acted, events);
      if (didAct) acted.add(id);
    }
  });

  return { board: b, events };
}

/* ------------------------------ 승리 판정 ------------------------------ */

export function checkWin(
  board: Board,
  win: WinCondition,
  tick: number,
): boolean {
  switch (win.kind) {
    case 'clearAll':
      return board.blocks.length === 0;
    case 'onGoal': {
      const n = board.blocks.filter(
        (b) =>
          matchesFilter(b, win.color, win.shape) &&
          cellAt(board, b.x, b.y) === 'goal',
      ).length;
      return n >= win.count;
    }
    case 'line': {
      const match = (x: number, y: number): boolean => {
        const b = blockAt(board, x, y);
        return b !== undefined && matchesFilter(b, win.color, win.shape);
      };
      const checkRows = win.orientation === 'row' || win.orientation === 'any';
      const checkCols = win.orientation === 'col' || win.orientation === 'any';
      if (checkRows) {
        for (let y = 0; y < board.height; y++) {
          let run = 0;
          for (let x = 0; x < board.width; x++) {
            run = match(x, y) ? run + 1 : 0;
            if (run >= win.count) return true;
          }
        }
      }
      if (checkCols) {
        for (let x = 0; x < board.width; x++) {
          let run = 0;
          for (let y = 0; y < board.height; y++) {
            run = match(x, y) ? run + 1 : 0;
            if (run >= win.count) return true;
          }
        }
      }
      return false;
    }
    case 'tier': {
      const n = board.blocks.filter(
        (b) =>
          b.tier >= win.tier &&
          (win.color === undefined || b.color === win.color),
      ).length;
      return n >= win.count;
    }
    case 'exactTicks':
      return tick === win.ticks && checkWin(board, win.win, tick);
  }
}

/* ------------------------------ 루프/안정 감지 ------------------------------ */

function serializeBoard(board: Board): string {
  const blocks = [...board.blocks]
    .sort((a, b) => a.id - b.id)
    .map((b) => `${b.id}:${b.x},${b.y},${b.color},${b.shape},${b.state},${b.tier}`);
  return blocks.join('|');
}

export function boardsEqual(a: Board, b: Board): boolean {
  return serializeBoard(a) === serializeBoard(b);
}

/** history에서 마지막 보드가 이전에 등장한 적 있으면 그 인덱스, 없으면 -1 */
export function detectLoop(history: TickResult[]): number {
  const lastTick = history[history.length - 1];
  if (!lastTick) return -1;
  const last = serializeBoard(lastTick.board);
  for (let i = 0; i < history.length - 1; i++) {
    const h = history[i];
    if (h && serializeBoard(h.board) === last) return i;
  }
  return -1;
}

/* ------------------------------ 시뮬레이션 ------------------------------ */

/**
 * 전체 시뮬레이션 실행.
 * 종료: (a) 승리, (b) 직전 틱과 동일 → stable(실패),
 *       (c) 과거 상태 재등장 → loop(조기 감지), (d) MAX_TICKS 초과 → loop
 */
export function runSimulation(
  initial: Board,
  rules: Rule[],
  win: WinCondition,
  maxTicks: number = MAX_TICKS,
): SimResult {
  const history: TickResult[] = [{ board: initial, events: [] }];
  const seen = new Set<string>([serializeBoard(initial)]);
  let prev = initial;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const result = nextTick(prev, rules);
    history.push(result);
    if (checkWin(result.board, win, tick)) {
      return { outcome: 'win', ticks: tick, history };
    }
    if (boardsEqual(prev, result.board)) {
      return { outcome: 'stable', ticks: tick, history };
    }
    const key = serializeBoard(result.board);
    if (seen.has(key)) {
      return { outcome: 'loop', ticks: tick, history };
    }
    seen.add(key);
    prev = result.board;
  }
  return { outcome: 'loop', ticks: maxTicks, history };
}

/* ------------------------------ 보드 생성 유틸 ------------------------------ */

const CELL_CHARS: Record<string, CellType> = {
  '.': 'floor',
  W: 'wall',
  G: 'goal',
  V: 'void',
};

/** 문자열 행 배열로 보드 셀 생성 ('.'=floor, 'W'=wall, 'G'=goal, 'V'=void) */
export function parseCells(rows: string[]): {
  width: number;
  height: number;
  cells: CellType[];
} {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells: CellType[] = [];
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`보드 행 길이가 일치하지 않음: "${row}"`);
    }
    for (const ch of row) {
      // 소문자는 블록 위치 주석용 — floor로 취급
      const cell = /[a-z]/.test(ch) ? 'floor' : CELL_CHARS[ch];
      if (!cell) throw new Error(`알 수 없는 셀 문자: "${ch}"`);
      cells.push(cell);
    }
  }
  return { width, height, cells };
}

export interface BlockSpec {
  x: number;
  y: number;
  color: Block['color'];
  shape: Block['shape'];
  state?: Block['state'];
  tier?: number;
}

export function makeBoard(rows: string[], blockSpecs: BlockSpec[]): Board {
  const { width, height, cells } = parseCells(rows);
  const blocks: Block[] = blockSpecs.map((s, i) => ({
    id: i + 1,
    x: s.x,
    y: s.y,
    color: s.color,
    shape: s.shape,
    state: s.state ?? 'normal',
    tier: s.tier ?? 1,
  }));
  return { width, height, cells, blocks, nextId: blocks.length + 1 };
}
