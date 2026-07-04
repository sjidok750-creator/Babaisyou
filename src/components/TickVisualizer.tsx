import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

/**
 * 시그니처 요소: 실행 중 틱 비주얼라이저.
 * 필름 스트립처럼 틱이 하나씩 새겨지고, 탭하면 그 틱으로 되감기(스크럽).
 */
export default function TickVisualizer() {
  const sim = useGameStore((s) => s.sim);
  const playTick = useGameStore((s) => s.playTick);
  const scrubTo = useGameStore((s) => s.scrubTo);

  if (!sim) {
    return (
      <div
        className="font-mono-tech flex h-8 items-center justify-center text-[11px] tracking-widest"
        style={{ color: 'var(--c-dim)' }}
      >
        TICK — 실행하면 여기에 틱이 새겨진다
      </div>
    );
  }

  const total = sim.history.length;

  return (
    <div className="no-scrollbar flex h-8 items-center gap-1 overflow-x-auto px-2">
      {Array.from({ length: total }, (_, t) => {
        const reached = t <= playTick;
        const current = t === playTick;
        const isLast = t === total - 1;
        const failMark = isLast && sim.outcome !== 'win';
        const winMark = isLast && sim.outcome === 'win';
        return (
          <motion.button
            key={t}
            type="button"
            onClick={() => scrubTo(t)}
            className="font-mono-tech flex h-6 min-w-6 shrink-0 items-center justify-center rounded-[2px] px-0.5 text-[10px]"
            initial={{ opacity: 0, y: 4 }}
            animate={{
              opacity: reached ? 1 : 0.3,
              y: 0,
              scale: current ? 1.15 : 1,
            }}
            style={{
              border: current
                ? '1.5px solid var(--c-glow)'
                : '1px solid var(--c-line-soft)',
              background: reached ? 'var(--c-panel)' : 'transparent',
              color: failMark
                ? '#E8503A'
                : winMark
                  ? '#41C476'
                  : current
                    ? 'var(--c-glow)'
                    : 'var(--c-dim)',
            }}
          >
            {failMark ? '✕' : winMark ? '✓' : t}
          </motion.button>
        );
      })}
    </div>
  );
}
