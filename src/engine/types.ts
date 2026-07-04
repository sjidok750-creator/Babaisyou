/**
 * 규칙 대장간 (Rule Smith) — 코어 엔진 타입.
 * 이 모듈은 React/DOM 의존성이 전혀 없어야 한다.
 */

export type Color = 'red' | 'blue' | 'yellow' | 'green';
export type Shape = 'circle' | 'square' | 'triangle';
export type BlockState = 'normal' | 'frozen' | 'charged';
export type CellType = 'floor' | 'wall' | 'goal' | 'void';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface XY {
  x: number;
  y: number;
}

export interface Block {
  id: number;
  x: number;
  y: number;
  color: Color;
  shape: Shape;
  state: BlockState;
  /** 합체 등급 1~3. 같은 등급끼리만 합체 가능, 결과는 +1. */
  tier: number;
}

export interface Board {
  width: number;
  height: number;
  /** row-major, 길이 width*height */
  cells: CellType[];
  blocks: Block[];
  /** 복제 시 결정론적 id 발급용 카운터 */
  nextId: number;
}

/* ------------------------------ 규칙 DSL ------------------------------ */

export type Condition =
  | { kind: 'always' }
  | { kind: 'adjacent'; color?: Color; shape?: Shape }
  | { kind: 'group'; count: number }
  | { kind: 'atWall' }
  | { kind: 'onGoal' };

export type Target =
  | { kind: 'color'; color: Color }
  | { kind: 'shape'; shape: Shape }
  | { kind: 'all' }
  | { kind: 'edge'; dir: Dir };

export type Action =
  | { kind: 'move'; dir: Dir }
  | { kind: 'paint'; color: Color }
  | { kind: 'merge' }
  | { kind: 'destroy' }
  | { kind: 'clone' }
  | { kind: 'freezeToggle' };

export interface Rule {
  when: Condition;
  target: Target;
  action: Action;
}

/* ------------------------------ 승리 조건 ------------------------------ */

export type WinCondition =
  | { kind: 'clearAll' }
  | { kind: 'onGoal'; color?: Color; shape?: Shape; count: number }
  | {
      kind: 'line';
      color?: Color;
      shape?: Shape;
      count: number;
      orientation: 'row' | 'col' | 'any';
    }
  | { kind: 'tier'; tier: number; count: number; color?: Color }
  | { kind: 'exactTicks'; ticks: number; win: WinCondition };

/* ------------------------------ 이벤트 ------------------------------ */

export type GameEvent =
  | { type: 'move'; blockId: number; from: XY; to: XY; ruleIndex: number }
  | {
      type: 'paint';
      blockId: number;
      at: XY;
      from: Color;
      to: Color;
      ruleIndex: number;
    }
  | {
      type: 'merge';
      keptId: number;
      removedId: number;
      at: XY;
      from: XY;
      tier: number;
      ruleIndex: number;
    }
  | {
      type: 'destroy';
      blockId: number;
      at: XY;
      cause: 'rule' | 'void';
      ruleIndex: number;
    }
  | {
      type: 'clone';
      sourceId: number;
      newId: number;
      from: XY;
      to: XY;
      ruleIndex: number;
    }
  | {
      type: 'freeze';
      blockId: number;
      at: XY;
      frozen: boolean;
      ruleIndex: number;
    };

export interface TickResult {
  board: Board;
  events: GameEvent[];
}

export type Outcome = 'win' | 'stable' | 'loop';

export interface SimResult {
  outcome: Outcome;
  /** 실행된 틱 수 (승리/판정이 난 틱 번호) */
  ticks: number;
  /** history[0] = 초기 상태(events 없음), history[t] = t번째 틱 결과 */
  history: TickResult[];
}
