import { useEffect, useMemo } from 'react';
import Board from '../components/Board';
import CardDrawer from '../components/CardDrawer';
import ResultModal from '../components/ResultModal';
import RuleSlots from '../components/RuleSlots';
import TickVisualizer from '../components/TickVisualizer';
import { getLevel, levelToBoard } from '../levels';
import { useGameStore } from '../store/gameStore';

const TICK_MS = 600;

export default function Game() {
  const levelId = useGameStore((s) => s.levelId);
  const sim = useGameStore((s) => s.sim);
  const playTick = useGameStore((s) => s.playTick);
  const playing = useGameStore((s) => s.playing);
  const speed = useGameStore((s) => s.speed);
  const result = useGameStore((s) => s.result);
  const run = useGameStore((s) => s.run);
  const stepOnce = useGameStore((s) => s.stepOnce);
  const togglePlaying = useGameStore((s) => s.togglePlaying);
  const cycleSpeed = useGameStore((s) => s.cycleSpeed);
  const resetRun = useGameStore((s) => s.resetRun);
  const advanceTick = useGameStore((s) => s.advanceTick);
  const goLevels = useGameStore((s) => s.goLevels);
  const drafts = useGameStore((s) => s.drafts);

  const level = useMemo(() => getLevel(levelId), [levelId]);
  const initialBoard = useMemo(() => levelToBoard(level), [level]);

  // 재생 타이머: playing 동안 틱 진행 (배속 반영)
  useEffect(() => {
    if (!playing || !sim || result) return;
    const t = setTimeout(() => advanceTick(), TICK_MS / speed);
    return () => clearTimeout(t);
  }, [playing, sim, result, playTick, speed, advanceTick]);

  const shown = sim ? sim.history[playTick] : null;
  const board = shown?.board ?? initialBoard;
  const events = shown?.events ?? [];

  const activeRuleIndexes = useMemo(
    () => new Set(events.map((e) => e.ruleIndex)),
    [events],
  );

  const anyComplete = drafts.some(
    (d) => d.when !== null && d.target !== null && d.action !== null,
  );

  return (
    <div className="blueprint-grid relative flex h-full flex-col pb-[max(8px,env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))]">
      {/* 상단: 레벨명 · 목표 (10%) */}
      <header className="flex items-center justify-between px-4 py-1">
        <button
          type="button"
          onClick={goLevels}
          className="font-mono-tech min-h-[44px] shrink-0 pr-2 text-[13px]"
          style={{ color: 'var(--c-dim)', background: 'transparent', border: 'none' }}
        >
          ←
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-mono-tech text-[10px] tracking-[0.35em]" style={{ color: 'var(--c-dim)' }}>
            NO.{String(level.id).padStart(2, '0')}
          </p>
          <h1 className="font-display truncate text-[clamp(15px,4.5vw,19px)] font-bold leading-tight">
            {level.name}
          </h1>
          <p className="truncate text-[clamp(10px,3vw,12px)]" style={{ color: 'var(--c-glow)' }}>
            ◈ {level.winText}
          </p>
        </div>
        <div className="w-[44px] shrink-0 text-right">
          {sim && (
            <span className="font-mono-tech text-[12px]" style={{ color: 'var(--c-glow)' }}>
              T{playTick}
            </span>
          )}
        </div>
      </header>

      {/* 보드 (중앙) */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-4">
        <Board board={board} events={events} />
      </main>

      {/* 틱 비주얼라이저 */}
      <TickVisualizer />

      {/* 규칙 슬롯 */}
      <section className="px-3 py-1.5">
        <RuleSlots activeRuleIndexes={sim ? activeRuleIndexes : new Set()} />
      </section>

      {/* 카드 서랍 + 컨트롤 */}
      <section style={{ borderTop: '1px solid var(--c-line-soft)' }}>
        <CardDrawer cards={level.cards} />
        <div className="flex items-center gap-2 px-3 pb-1 pt-0.5">
          {!sim ? (
            <button
              type="button"
              onClick={run}
              disabled={!anyComplete}
              className="font-display min-h-[46px] flex-1 text-[15px] font-bold tracking-wide"
              style={{
                background: anyComplete ? 'var(--c-glow)' : 'var(--c-line-soft)',
                color: '#0E1B2C',
                border: 'none',
                opacity: anyComplete ? 1 : 0.6,
              }}
            >
              ▶ 실행
            </button>
          ) : (
            <button
              type="button"
              onClick={togglePlaying}
              className="font-display min-h-[46px] flex-1 text-[15px] font-bold"
              style={{ background: 'var(--c-paper)', color: '#0E1B2C', border: 'none' }}
            >
              {playing ? '⏸ 일시정지' : '▶ 재생'}
            </button>
          )}
          <button
            type="button"
            onClick={stepOnce}
            disabled={!anyComplete}
            className="bp-dashed min-h-[46px] min-w-[64px] text-[13px]"
            style={{ color: 'var(--c-paper)', background: 'transparent', opacity: anyComplete ? 1 : 0.5 }}
            title="한 틱씩 관찰"
          >
            ⏭ 스텝
          </button>
          <button
            type="button"
            onClick={cycleSpeed}
            className="font-mono-tech min-h-[46px] min-w-[52px] text-[13px]"
            style={{ color: 'var(--c-glow)', background: 'transparent', border: '1px solid var(--c-line)' }}
          >
            {speed}×
          </button>
          <button
            type="button"
            onClick={resetRun}
            className="bp-dashed min-h-[46px] min-w-[52px] text-[13px]"
            style={{ color: 'var(--c-paper)', background: 'transparent' }}
          >
            ↺
          </button>
        </div>
      </section>

      <ResultModal />
    </div>
  );
}
