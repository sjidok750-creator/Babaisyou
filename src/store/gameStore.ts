import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { runSimulation } from '../engine/engine';
import type {
  Action,
  Condition,
  Rule,
  SimResult,
  Target,
} from '../engine/types';
import { LEVELS, calcStars, getLevel, levelToBoard } from '../levels';
import {
  playCardSnap,
  playClear,
  playDestroy,
  playFail,
  playFreeze,
  playMerge,
  playTick,
  setMuted,
} from '../audio/sound';

export type Screen = 'title' | 'levels' | 'game';
export type Speed = 1 | 2 | 4;

export type CardPiece =
  | { part: 'when'; value: Condition }
  | { part: 'target'; value: Target }
  | { part: 'action'; value: Action };

export interface RuleDraft {
  key: number;
  when: Condition | null;
  target: Target | null;
  action: Action | null;
}

export interface LevelResult {
  outcome: 'win' | 'stable' | 'loop';
  ticks: number;
  stars: number;
  rulesUsed: number;
}

interface GameStore {
  /* 영속 상태 */
  progress: Record<number, { stars: number }>;
  soundOn: boolean;
  theme: 'dark' | 'light';
  lastLevelId: number;

  /* 화면 */
  screen: Screen;
  levelId: number;

  /* 규칙 조립 */
  drafts: RuleDraft[];
  selected: CardPiece | null;

  /* 실행/재생 */
  sim: SimResult | null;
  playTick: number;
  playing: boolean;
  speed: Speed;
  result: LevelResult | null;

  /* actions */
  goTitle: () => void;
  goLevels: () => void;
  startLevel: (id: number) => void;
  isUnlocked: (id: number) => boolean;

  selectCard: (piece: CardPiece | null) => void;
  placeSelected: (slotIdx: number) => void;
  removePiece: (slotIdx: number, part: 'when' | 'target' | 'action') => void;
  reorderDrafts: (keys: number[]) => void;
  compiledRules: () => Rule[];

  run: () => void;
  stepOnce: () => void;
  advanceTick: () => void;
  togglePlaying: () => void;
  cycleSpeed: () => void;
  resetRun: () => void;
  scrubTo: (tick: number) => void;
  dismissResult: () => void;
  nextLevel: () => void;

  toggleSound: () => void;
  toggleTheme: () => void;
}

let draftKey = 1;

function emptyDrafts(slots: number): RuleDraft[] {
  return Array.from({ length: slots }, () => ({
    key: draftKey++,
    when: null,
    target: null,
    action: null,
  }));
}

function playEventSounds(sim: SimResult, tick: number): void {
  const events = sim.history[tick]?.events ?? [];
  playTick();
  if (events.some((e) => e.type === 'merge')) playMerge();
  if (events.some((e) => e.type === 'destroy')) playDestroy();
  if (events.some((e) => e.type === 'freeze')) playFreeze();
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      progress: {},
      soundOn: true,
      theme: 'dark',
      lastLevelId: 1,

      screen: 'title',
      levelId: 1,
      drafts: [],
      selected: null,
      sim: null,
      playTick: 0,
      playing: false,
      speed: 1,
      result: null,

      goTitle: () => set({ screen: 'title' }),
      goLevels: () => set({ screen: 'levels' }),

      startLevel: (id) => {
        const level = getLevel(id);
        set({
          screen: 'game',
          levelId: id,
          lastLevelId: id,
          drafts: emptyDrafts(level.slots),
          selected: null,
          sim: null,
          playTick: 0,
          playing: false,
          result: null,
        });
      },

      isUnlocked: (id) => {
        if (id === 1) return true;
        return (get().progress[id - 1]?.stars ?? 0) > 0;
      },

      selectCard: (piece) => set({ selected: piece }),

      placeSelected: (slotIdx) => {
        const { selected, drafts, sim } = get();
        if (!selected || sim) return;
        const next = drafts.map((d, i) =>
          i === slotIdx ? { ...d, [selected.part]: selected.value } : d,
        );
        playCardSnap();
        set({ drafts: next, selected: null });
      },

      removePiece: (slotIdx, part) => {
        const { drafts, sim } = get();
        if (sim) return;
        const next = drafts.map((d, i) =>
          i === slotIdx ? { ...d, [part]: null } : d,
        );
        set({ drafts: next });
      },

      reorderDrafts: (keys) => {
        const { drafts, sim } = get();
        if (sim) return;
        const byKey = new Map(drafts.map((d) => [d.key, d]));
        const next = keys
          .map((k) => byKey.get(k))
          .filter((d): d is RuleDraft => d !== undefined);
        if (next.length === drafts.length) set({ drafts: next });
      },

      compiledRules: () => {
        return get()
          .drafts.filter(
            (d): d is RuleDraft & Rule =>
              d.when !== null && d.target !== null && d.action !== null,
          )
          .map((d) => ({ when: d.when, target: d.target, action: d.action }));
      },

      run: () => {
        const { levelId, compiledRules } = get();
        const rules = compiledRules();
        if (rules.length === 0) return;
        const level = getLevel(levelId);
        const sim = runSimulation(levelToBoard(level), rules, level.win);
        set({ sim, playTick: 0, playing: true, result: null });
      },

      stepOnce: () => {
        const { sim, levelId, compiledRules } = get();
        if (!sim) {
          const rules = compiledRules();
          if (rules.length === 0) return;
          const level = getLevel(levelId);
          const created = runSimulation(levelToBoard(level), rules, level.win);
          set({ sim: created, playTick: 0, playing: false, result: null });
          return;
        }
        set({ playing: false });
        get().advanceTick();
      },

      advanceTick: () => {
        const { sim, playTick, levelId, compiledRules, soundOn, result } = get();
        if (!sim || result) return;
        const last = sim.history.length - 1;
        if (playTick >= last) {
          // 재생 끝 → 판정 확정
          const level = getLevel(levelId);
          const rulesUsed = compiledRules().length;
          if (sim.outcome === 'win') {
            const stars = calcStars(level, rulesUsed, sim.ticks);
            const prev = get().progress[levelId]?.stars ?? 0;
            if (soundOn) playClear();
            set({
              playing: false,
              result: { outcome: 'win', ticks: sim.ticks, stars, rulesUsed },
              progress: {
                ...get().progress,
                [levelId]: { stars: Math.max(prev, stars) },
              },
            });
          } else {
            if (soundOn) playFail();
            set({
              playing: false,
              result: {
                outcome: sim.outcome,
                ticks: sim.ticks,
                stars: 0,
                rulesUsed,
              },
            });
          }
          return;
        }
        const nextTickIdx = playTick + 1;
        if (soundOn) playEventSounds(sim, nextTickIdx);
        set({ playTick: nextTickIdx });
      },

      togglePlaying: () => {
        const { sim, playing } = get();
        if (!sim) return;
        set({ playing: !playing });
      },

      cycleSpeed: () => {
        const order: Speed[] = [1, 2, 4];
        const idx = order.indexOf(get().speed);
        const next = order[(idx + 1) % order.length] ?? 1;
        set({ speed: next });
      },

      resetRun: () =>
        set({ sim: null, playTick: 0, playing: false, result: null }),

      scrubTo: (tick) => {
        const { sim } = get();
        if (!sim) return;
        const clamped = Math.max(0, Math.min(tick, sim.history.length - 1));
        set({ playTick: clamped, playing: false });
      },

      dismissResult: () => set({ result: null }),

      nextLevel: () => {
        const { levelId } = get();
        const next = LEVELS.find((l) => l.id === levelId + 1);
        if (next) get().startLevel(next.id);
        else set({ screen: 'levels', sim: null, result: null });
      },

      toggleSound: () => {
        const next = !get().soundOn;
        setMuted(!next);
        set({ soundOn: next });
      },

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        set({ theme: next });
      },
    }),
    {
      name: 'rule-smith-save',
      partialize: (s) => ({
        progress: s.progress,
        soundOn: s.soundOn,
        theme: s.theme,
        lastLevelId: s.lastLevelId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setMuted(!state.soundOn);
          document.documentElement.dataset.theme = state.theme;
        }
      },
    },
  ),
);
