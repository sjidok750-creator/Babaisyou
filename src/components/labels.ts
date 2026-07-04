import type { Action, Condition, Target } from '../engine/types';

export const COLOR_KO: Record<string, string> = {
  red: '빨강',
  blue: '파랑',
  yellow: '노랑',
  green: '초록',
};

export const COLOR_HEX: Record<string, string> = {
  red: '#E8503A',
  blue: '#3A8FE8',
  yellow: '#F2C230',
  green: '#41C476',
};

export const SHAPE_KO: Record<string, string> = {
  circle: '원',
  square: '사각',
  triangle: '삼각',
};

const DIR_KO: Record<string, string> = {
  up: '위',
  down: '아래',
  left: '왼쪽',
  right: '오른쪽',
};

const DIR_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export function labelCondition(c: Condition): string {
  switch (c.kind) {
    case 'always':
      return '항상';
    case 'adjacent': {
      const parts: string[] = [];
      if (c.color) parts.push(COLOR_KO[c.color] ?? c.color);
      if (c.shape) parts.push(SHAPE_KO[c.shape] ?? c.shape);
      return `${parts.join(' ') || '블록'}과 인접하면`;
    }
    case 'group':
      return `같은 색 ${c.count}개 모이면`;
    case 'atWall':
      return '벽에 닿으면';
    case 'onGoal':
      return '목표 칸 위면';
  }
}

export function labelTarget(t: Target): string {
  switch (t.kind) {
    case 'color':
      return COLOR_KO[t.color] ?? t.color;
    case 'shape':
      return SHAPE_KO[t.shape] ?? t.shape;
    case 'all':
      return '모든 블록';
    case 'edge':
      return `가장 ${DIR_KO[t.dir]} 블록`;
  }
}

export function labelAction(a: Action): string {
  switch (a.kind) {
    case 'move':
      return `${DIR_ARROW[a.dir]} 이동`;
    case 'paint':
      return `${COLOR_KO[a.color]}이 된다`;
    case 'merge':
      return '합체한다';
    case 'destroy':
      return '사라진다';
    case 'clone':
      return '복제된다';
    case 'freezeToggle':
      return '얼음 ⇄';
  }
}
