import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Block, Board as BoardType, GameEvent } from '../engine/types';
import { COLOR_HEX } from './labels';

const TIER_MARK = ['', '', 'Ⅱ', 'Ⅲ'];

function BlockView({
  block,
  boardW,
  boardH,
  merged,
  reduced,
}: {
  block: Block;
  boardW: number;
  boardH: number;
  merged: boolean;
  reduced: boolean;
}) {
  const cw = 100 / boardW;
  const ch = 100 / boardH;
  const color = COLOR_HEX[block.color] ?? '#fff';
  const shapeStyle: React.CSSProperties =
    block.shape === 'circle'
      ? { borderRadius: '50%' }
      : block.shape === 'triangle'
        ? { clipPath: 'polygon(50% 6%, 96% 94%, 4% 94%)', borderRadius: 0 }
        : { borderRadius: '18%' };

  return (
    <motion.div
      className="absolute flex items-center justify-center"
      style={{
        width: `${cw}%`,
        height: `${ch}%`,
        zIndex: 10,
      }}
      initial={reduced ? false : { scale: 0, opacity: 0 }}
      animate={{
        left: `${block.x * cw}%`,
        top: `${block.y * ch}%`,
        scale: merged && !reduced ? [1, 1.3, 1] : 1,
        opacity: 1,
      }}
      exit={
        reduced
          ? { opacity: 0 }
          : { scale: 0.2, opacity: 0, filter: 'blur(4px)' }
      }
      transition={
        reduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }
      }
    >
      <div
        className="relative flex h-[76%] w-[76%] items-center justify-center"
        style={{
          ...shapeStyle,
          backgroundColor: color,
          boxShadow: `0 0 0 1.5px rgba(232,223,200,0.35), 0 2px 10px rgba(0,0,0,0.45)`,
          opacity: block.state === 'frozen' ? 0.85 : 1,
          transition: 'background-color 0.35s',
        }}
      >
        {block.tier > 1 && (
          <span
            className="font-mono-tech text-[clamp(8px,2.6vw,13px)] font-semibold"
            style={{ color: 'rgba(14,27,44,0.9)' }}
          >
            {TIER_MARK[block.tier]}
          </span>
        )}
        {block.state === 'frozen' && (
          <div
            className="pointer-events-none absolute inset-[-12%] border-2 border-dashed"
            style={{
              borderColor: 'rgba(190,225,255,0.9)',
              borderRadius: block.shape === 'circle' ? '50%' : '22%',
              background:
                'linear-gradient(135deg, rgba(190,225,255,0.35), rgba(190,225,255,0.08))',
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

/** 설계도 스타일 점선 화살표 오버레이 (이번 틱의 이동/복제 이벤트) */
function ArrowOverlay({
  events,
  boardW,
  boardH,
  reduced,
}: {
  events: GameEvent[];
  boardW: number;
  boardH: number;
  reduced: boolean;
}) {
  const arrows = events.flatMap((e, i) => {
    if (e.type === 'move' || e.type === 'clone') {
      return [{ from: e.from, to: e.to, key: `${e.type}-${i}` }];
    }
    if (e.type === 'merge') {
      return [{ from: e.from, to: e.at, key: `merge-${i}` }];
    }
    return [];
  });
  if (arrows.length === 0 || reduced) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      viewBox={`0 0 ${boardW} ${boardH}`}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L5,2.5 L0,5 z" fill="var(--c-paper)" opacity="0.8" />
        </marker>
      </defs>
      {arrows.map((a) => (
        <motion.line
          key={a.key}
          x1={a.from.x + 0.5}
          y1={a.from.y + 0.5}
          x2={a.to.x + 0.5}
          y2={a.to.y + 0.5}
          stroke="var(--c-paper)"
          strokeWidth="0.06"
          strokeDasharray="0.18 0.12"
          markerEnd="url(#arrowhead)"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeIn' }}
        />
      ))}
    </svg>
  );
}

export default function Board({
  board,
  events,
}: {
  board: BoardType;
  events: GameEvent[];
}) {
  const reduced = useReducedMotion() ?? false;
  const { width, height, cells } = board;
  const mergedIds = new Set(
    events.filter((e) => e.type === 'merge').map((e) => e.keptId),
  );

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(92vw,52vh)]"
      style={{
        border: '1.5px solid var(--c-line)',
        boxShadow: '0 0 0 6px rgba(61,90,115,0.12)',
        background: 'var(--c-panel)',
      }}
    >
      {/* 셀 레이어 */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${width}, 1fr)`,
          gridTemplateRows: `repeat(${height}, 1fr)`,
        }}
      >
        {cells.map((cell, i) => {
          const base = 'relative border-[0.5px]';
          const borderColor = 'var(--c-line-soft)';
          if (cell === 'wall') {
            return (
              <div
                key={i}
                className={base}
                style={{
                  borderColor,
                  background:
                    'repeating-linear-gradient(45deg, var(--c-line) 0 2px, transparent 2px 7px)',
                  opacity: 0.75,
                }}
              />
            );
          }
          if (cell === 'goal') {
            return (
              <div key={i} className={base} style={{ borderColor }}>
                <div
                  className="absolute inset-[14%] border-2 border-dashed"
                  style={{ borderColor: 'var(--c-glow)', opacity: 0.9 }}
                />
                <div
                  className="absolute inset-[38%] rotate-45 border"
                  style={{ borderColor: 'var(--c-glow)', opacity: 0.7 }}
                />
              </div>
            );
          }
          if (cell === 'void') {
            return (
              <div key={i} className={base} style={{ borderColor }}>
                <div
                  className="absolute inset-[10%] rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,0,0,0.85) 30%, rgba(14,27,44,0) 72%)',
                  }}
                />
                <div
                  className="absolute inset-[26%] rounded-full border border-dashed"
                  style={{ borderColor: 'rgba(232,223,200,0.3)' }}
                />
              </div>
            );
          }
          return <div key={i} className={base} style={{ borderColor }} />;
        })}
      </div>

      {/* 블록 레이어 */}
      <AnimatePresence>
        {board.blocks.map((b) => (
          <BlockView
            key={b.id}
            block={b}
            boardW={width}
            boardH={height}
            merged={mergedIds.has(b.id)}
            reduced={reduced}
          />
        ))}
      </AnimatePresence>

      <ArrowOverlay
        events={events}
        boardW={width}
        boardH={height}
        reduced={reduced}
      />
    </div>
  );
}
