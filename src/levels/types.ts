import type { BlockSpec } from '../engine/engine';
import type { Action, Condition, Rule, Target, WinCondition } from '../engine/types';

export interface CardVocabulary {
  when: Condition[];
  target: Target[];
  action: Action[];
}

export interface LevelData {
  id: number;
  name: string;
  tagline: string;
  rows: string[];
  blocks: BlockSpec[];
  slots: number;
  cards: CardVocabulary;
  win: WinCondition;
  winText: string;
  par: { ticks: number; rules: number };
  solution: Rule[];
}

const COLORS = ['red', 'blue', 'yellow', 'green'];
const SHAPES = ['circle', 'square', 'triangle'];
const DIRS = ['up', 'down', 'left', 'right'];

function fail(levelId: unknown, msg: string): never {
  throw new Error(`레벨 스키마 오류 (id=${String(levelId)}): ${msg}`);
}

function isCondition(c: unknown): boolean {
  if (typeof c !== 'object' || c === null) return false;
  const o = c as Record<string, unknown>;
  switch (o.kind) {
    case 'always':
    case 'atWall':
    case 'onGoal':
      return true;
    case 'adjacent':
      return (
        (o.color === undefined || COLORS.includes(o.color as string)) &&
        (o.shape === undefined || SHAPES.includes(o.shape as string))
      );
    case 'group':
      return typeof o.count === 'number' && o.count >= 2;
    default:
      return false;
  }
}

function isTarget(t: unknown): boolean {
  if (typeof t !== 'object' || t === null) return false;
  const o = t as Record<string, unknown>;
  switch (o.kind) {
    case 'color':
      return COLORS.includes(o.color as string);
    case 'shape':
      return SHAPES.includes(o.shape as string);
    case 'all':
      return true;
    case 'edge':
      return DIRS.includes(o.dir as string);
    default:
      return false;
  }
}

function isAction(a: unknown): boolean {
  if (typeof a !== 'object' || a === null) return false;
  const o = a as Record<string, unknown>;
  switch (o.kind) {
    case 'move':
      return DIRS.includes(o.dir as string);
    case 'paint':
      return COLORS.includes(o.color as string);
    case 'merge':
    case 'destroy':
    case 'clone':
    case 'freezeToggle':
      return true;
    default:
      return false;
  }
}

function isWin(w: unknown): boolean {
  if (typeof w !== 'object' || w === null) return false;
  const o = w as Record<string, unknown>;
  switch (o.kind) {
    case 'clearAll':
      return true;
    case 'onGoal':
      return typeof o.count === 'number';
    case 'line':
      return (
        typeof o.count === 'number' &&
        ['row', 'col', 'any'].includes(o.orientation as string)
      );
    case 'tier':
      return typeof o.tier === 'number' && typeof o.count === 'number';
    case 'exactTicks':
      return typeof o.ticks === 'number' && isWin(o.win);
    default:
      return false;
  }
}

/** JSON에서 읽은 원시 데이터를 검증해 LevelData로 확정한다 */
export function validateLevel(raw: unknown): LevelData {
  const o = raw as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== 'number') fail(id, 'id가 숫자가 아님');
  if (typeof o.name !== 'string' || o.name.length === 0) fail(id, 'name 누락');
  if (typeof o.tagline !== 'string') fail(id, 'tagline 누락');
  if (typeof o.winText !== 'string') fail(id, 'winText 누락');

  const rows = o.rows;
  if (!Array.isArray(rows) || rows.length < 3) fail(id, 'rows가 유효하지 않음');
  const width = (rows[0] as string).length;
  if (width < 3 || width > 8 || rows.length > 8) {
    fail(id, `보드 크기 범위 초과: ${width}x${rows.length}`);
  }
  for (const r of rows) {
    if (typeof r !== 'string' || r.length !== width) fail(id, '행 길이 불일치');
    if (!/^[.WGV]+$/.test(r)) fail(id, `허용되지 않는 셀 문자: ${r}`);
  }

  const blocks = o.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) fail(id, '블록 없음');
  const seen = new Set<string>();
  for (const b of blocks as Record<string, unknown>[]) {
    const x = b.x as number;
    const y = b.y as number;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      x < 0 ||
      y < 0 ||
      x >= width ||
      y >= rows.length
    ) {
      fail(id, `블록 좌표 범위 밖: (${String(b.x)},${String(b.y)})`);
    }
    const cell = (rows[y] as string)[x];
    if (cell === 'W' || cell === 'V') fail(id, `블록이 벽/소멸 셀 위에 있음: (${x},${y})`);
    const key = `${x},${y}`;
    if (seen.has(key)) fail(id, `블록 좌표 중복: (${x},${y})`);
    seen.add(key);
    if (!COLORS.includes(b.color as string)) fail(id, `블록 색 오류: ${String(b.color)}`);
    if (!SHAPES.includes(b.shape as string)) fail(id, `블록 모양 오류: ${String(b.shape)}`);
  }

  const slots = o.slots;
  if (typeof slots !== 'number' || slots < 1 || slots > 5) fail(id, 'slots 범위 오류');

  const cards = o.cards as Record<string, unknown[]>;
  if (!cards || !Array.isArray(cards.when) || !Array.isArray(cards.target) || !Array.isArray(cards.action)) {
    fail(id, 'cards 구조 오류');
  }
  cards.when.forEach((c) => isCondition(c) || fail(id, `조건 카드 오류: ${JSON.stringify(c)}`));
  cards.target.forEach((t) => isTarget(t) || fail(id, `대상 카드 오류: ${JSON.stringify(t)}`));
  cards.action.forEach((a) => isAction(a) || fail(id, `행동 카드 오류: ${JSON.stringify(a)}`));

  if (!isWin(o.win)) fail(id, `승리 조건 오류: ${JSON.stringify(o.win)}`);

  const par = o.par as Record<string, unknown>;
  if (!par || typeof par.ticks !== 'number' || typeof par.rules !== 'number') {
    fail(id, 'par 오류');
  }

  const solution = o.solution;
  if (!Array.isArray(solution) || solution.length === 0) fail(id, 'solution 누락');
  if (solution.length > slots) fail(id, 'solution이 슬롯 수보다 많음');
  for (const r of solution as Record<string, unknown>[]) {
    if (!isCondition(r.when) || !isTarget(r.target) || !isAction(r.action)) {
      fail(id, `solution 규칙 오류: ${JSON.stringify(r)}`);
    }
  }

  return raw as LevelData;
}
