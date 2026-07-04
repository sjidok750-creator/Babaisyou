import { motion } from 'framer-motion';
import { LEVELS } from '../levels';
import { useGameStore } from '../store/gameStore';

export default function LevelSelect() {
  const goTitle = useGameStore((s) => s.goTitle);
  const startLevel = useGameStore((s) => s.startLevel);
  const isUnlocked = useGameStore((s) => s.isUnlocked);
  const progress = useGameStore((s) => s.progress);

  return (
    <div className="blueprint-grid flex h-full flex-col px-5 pb-6 pt-[max(20px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goTitle}
          className="font-mono-tech min-h-[44px] text-[13px]"
          style={{ color: 'var(--c-dim)', background: 'transparent', border: 'none' }}
        >
          ← 타이틀
        </button>
        <p className="font-mono-tech text-[11px] tracking-[0.4em]" style={{ color: 'var(--c-dim)' }}>
          BLUEPRINTS
        </p>
      </div>
      <h1 className="font-display mt-2 text-[clamp(22px,7vw,30px)] font-bold">도면 선택</h1>

      <div className="mt-5 grid grid-cols-3 gap-3 overflow-y-auto pb-4">
        {LEVELS.map((lv, i) => {
          const unlocked = isUnlocked(lv.id);
          const stars = progress[lv.id]?.stars ?? 0;
          return (
            <motion.button
              key={lv.id}
              type="button"
              disabled={!unlocked}
              onClick={() => startLevel(lv.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex aspect-square flex-col items-center justify-center gap-1 p-1"
              style={{
                border: unlocked ? '1.5px solid var(--c-line)' : '1px dashed var(--c-line-soft)',
                background: unlocked ? 'var(--c-panel)' : 'transparent',
                opacity: unlocked ? 1 : 0.45,
              }}
            >
              <span
                className="font-mono-tech text-[clamp(18px,6vw,24px)] font-semibold"
                style={{ color: unlocked ? 'var(--c-paper)' : 'var(--c-dim)' }}
              >
                {unlocked ? String(lv.id).padStart(2, '0') : '🔒'}
              </span>
              <span
                className="w-full truncate px-1 text-center text-[clamp(9px,2.6vw,11px)]"
                style={{ color: 'var(--c-dim)' }}
              >
                {unlocked ? lv.name : '잠김'}
              </span>
              <span className="text-[clamp(10px,3vw,12px)] tracking-widest">
                {[1, 2, 3].map((n) => (
                  <span key={n} style={{ color: n <= stars ? 'var(--c-glow)' : 'var(--c-line)' }}>
                    ★
                  </span>
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
