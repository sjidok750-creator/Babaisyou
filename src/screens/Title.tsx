import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function Title() {
  const goLevels = useGameStore((s) => s.goLevels);
  const startLevel = useGameStore((s) => s.startLevel);
  const lastLevelId = useGameStore((s) => s.lastLevelId);
  const progress = useGameStore((s) => s.progress);
  const soundOn = useGameStore((s) => s.soundOn);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const theme = useGameStore((s) => s.theme);
  const toggleTheme = useGameStore((s) => s.toggleTheme);

  const hasProgress = Object.keys(progress).length > 0;

  return (
    <div className="blueprint-grid relative flex h-full flex-col items-center justify-center overflow-hidden px-8">
      {/* 앰비언트 설계도 라인 */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="200" cy="230" r="130" fill="none" stroke="var(--c-line)" strokeWidth="1" strokeDasharray="4 6" className="draw-line" />
        <rect x="90" y="120" width="220" height="220" fill="none" stroke="var(--c-line)" strokeWidth="1" className="draw-line" style={{ animationDelay: '1.2s' }} />
        <line x1="0" y1="560" x2="400" y2="560" stroke="var(--c-line)" strokeWidth="1" strokeDasharray="10 8" className="draw-line" style={{ animationDelay: '2s' }} />
        <path d="M 60 700 L 200 620 L 340 700" fill="none" stroke="var(--c-line)" strokeWidth="1" strokeDasharray="5 5" className="draw-line" style={{ animationDelay: '0.6s' }} />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative text-center"
      >
        <p className="font-mono-tech text-[clamp(11px,3vw,13px)] tracking-[0.5em]" style={{ color: 'var(--c-dim)' }}>
          RULE SMITH
        </p>
        <h1 className="font-display mt-2 text-[clamp(38px,12vw,56px)] font-bold leading-tight">
          규칙 대장간
        </h1>
        <p className="mt-3 text-[clamp(13px,3.6vw,15px)]" style={{ color: 'var(--c-dim)' }}>
          보드를 만지지 마라. 규칙을 벼려라.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="relative mt-12 flex w-full max-w-[240px] flex-col gap-3"
      >
        {hasProgress && (
          <button
            type="button"
            onClick={() => startLevel(lastLevelId)}
            className="font-display min-h-[48px] w-full text-[15px] font-semibold"
            style={{ background: 'var(--c-glow)', color: '#0E1B2C', border: 'none' }}
          >
            이어서 벼리기
          </button>
        )}
        <button
          type="button"
          onClick={goLevels}
          className="bp-dashed min-h-[48px] w-full text-[15px]"
          style={{ color: 'var(--c-paper)', background: 'rgba(20,38,60,0.5)' }}
        >
          도면 선택
        </button>
      </motion.div>

      <div className="absolute bottom-8 flex gap-5">
        <button
          type="button"
          onClick={toggleSound}
          className="font-mono-tech min-h-[44px] min-w-[44px] text-[12px]"
          style={{ color: 'var(--c-dim)', background: 'transparent', border: 'none' }}
        >
          {soundOn ? '♪ ON' : '♪ OFF'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="font-mono-tech min-h-[44px] min-w-[44px] text-[12px]"
          style={{ color: 'var(--c-dim)', background: 'transparent', border: 'none' }}
        >
          {theme === 'dark' ? '◐ 양피지' : '◑ 청사진'}
        </button>
      </div>
    </div>
  );
}
