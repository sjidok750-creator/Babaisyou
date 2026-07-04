import { makeBoard } from '../engine/engine';
import type { Board } from '../engine/types';
import { validateLevel, type LevelData } from './types';

import level01 from './level01.json';
import level02 from './level02.json';
import level03 from './level03.json';
import level04 from './level04.json';
import level05 from './level05.json';
import level06 from './level06.json';
import level07 from './level07.json';
import level08 from './level08.json';
import level09 from './level09.json';
import level10 from './level10.json';
import level11 from './level11.json';
import level12 from './level12.json';

const RAW: unknown[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
  level11,
  level12,
];

/** 로드 시점에 전체 레벨 스키마 검증 (실패 시 즉시 throw) */
export const LEVELS: LevelData[] = RAW.map(validateLevel);

export function getLevel(id: number): LevelData {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error(`레벨 없음: ${id}`);
  return lv;
}

export function levelToBoard(level: LevelData): Board {
  return makeBoard(level.rows, level.blocks);
}

/**
 * 별 계산: 클리어 1개 기본.
 * 사용 규칙 수 ≤ par.rules → +1, 클리어 틱 ≤ par.ticks → +1
 */
export function calcStars(
  level: LevelData,
  rulesUsed: number,
  ticks: number,
): 1 | 2 | 3 {
  let stars = 1;
  if (rulesUsed <= level.par.rules) stars += 1;
  if (ticks <= level.par.ticks) stars += 1;
  return stars as 1 | 2 | 3;
}
