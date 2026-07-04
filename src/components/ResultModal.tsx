import { AnimatePresence, motion } from 'framer-motion';
import { getLevel } from '../levels';
import { useGameStore } from '../store/gameStore';

export default function ResultModal() {
  const result = useGameStore((s) => s.result);
  const levelId = useGameStore((s) => s.levelId);
  const resetRun = useGameStore((s) => s.resetRun);
  const nextLevel = useGameStore((s) => s.nextLevel);
  const goLevels = useGameStore((s) => s.goLevels);
  const scrubTo = useGameStore((s) => s.scrubTo);
  const dismissResult = useGameStore((s) => s.dismissResult);
  const sim = useGameStore((s) => s.sim);

  const level = getLevel(levelId);
  const isLast = levelId >= 12;

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(4,10,18,0.72)' }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-xs p-5"
            style={{
              background: 'var(--c-panel)',
              border: '1.5px solid var(--c-line)',
              boxShadow: '0 0 0 6px rgba(61,90,115,0.15), 0 18px 50px rgba(0,0,0,0.5)',
            }}
          >
            {result.outcome === 'win' ? (
              <>
                <p
                  className="font-mono-tech text-[11px] tracking-[0.3em]"
                  style={{ color: 'var(--c-dim)' }}
                >
                  FORGED
                </p>
                <h2 className="font-display mt-1 text-[clamp(20px,6vw,26px)] font-bold">
                  규칙이 완성됐다
                </h2>
                <div className="my-4 flex justify-center gap-2 text-[clamp(26px,8vw,34px)]">
                  {[1, 2, 3].map((n) => (
                    <motion.span
                      key={n}
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.15 * n, type: 'spring', stiffness: 400, damping: 18 }}
                      style={{
                        color: n <= result.stars ? 'var(--c-glow)' : 'var(--c-line)',
                      }}
                    >
                      ★
                    </motion.span>
                  ))}
                </div>
                <div
                  className="font-mono-tech mb-4 flex justify-around text-[12px]"
                  style={{ color: 'var(--c-dim)' }}
                >
                  <span>규칙 {result.rulesUsed} / 기준 {level.par.rules}</span>
                  <span>틱 {result.ticks} / 기준 {level.par.ticks}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={nextLevel}
                    className="font-display min-h-[44px] w-full font-semibold"
                    style={{
                      background: 'var(--c-glow)',
                      color: '#0E1B2C',
                      border: 'none',
                    }}
                  >
                    {isLast ? '레벨 목록으로' : '다음 도면 →'}
                  </button>
                  <button
                    type="button"
                    onClick={resetRun}
                    className="bp-dashed min-h-[44px] w-full text-[13px]"
                    style={{ color: 'var(--c-paper)', background: 'transparent' }}
                  >
                    최소 규칙 재도전
                  </button>
                </div>
              </>
            ) : (
              <>
                <p
                  className="font-mono-tech text-[11px] tracking-[0.3em]"
                  style={{ color: '#E8503A' }}
                >
                  {result.outcome === 'loop' ? 'INFINITE LOOP' : 'STALLED'}
                </p>
                <h2 className="font-display mt-1 text-[clamp(18px,5.5vw,24px)] font-bold">
                  {result.outcome === 'loop'
                    ? '규칙이 굴레에 갇혔다'
                    : `${result.ticks}틱에서 멈췄다`}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--c-dim)' }}>
                  {result.outcome === 'loop'
                    ? '보드가 같은 상태를 영원히 반복한다. 탈출 조건을 설계하라.'
                    : '어느 규칙도 보드를 바꾸지 못했다. 어느 틱에서 어긋났는지 되감아 보라.'}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      dismissResult();
                      if (sim) scrubTo(sim.history.length - 1);
                    }}
                    className="bp-dashed min-h-[44px] w-full text-[13px]"
                    style={{ color: 'var(--c-paper)', background: 'transparent' }}
                  >
                    ⟲ 되감기 리플레이
                  </button>
                  <button
                    type="button"
                    onClick={resetRun}
                    className="font-display min-h-[44px] w-full font-semibold"
                    style={{ background: 'var(--c-paper)', color: '#0E1B2C', border: 'none' }}
                  >
                    규칙 다시 벼리기
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={goLevels}
              className="font-mono-tech mt-3 min-h-[36px] w-full text-[11px] tracking-widest"
              style={{ color: 'var(--c-dim)', background: 'transparent', border: 'none' }}
            >
              도면 목록
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
