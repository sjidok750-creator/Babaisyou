import { Reorder, motion } from 'framer-motion';
import type { RuleDraft } from '../store/gameStore';
import { useGameStore } from '../store/gameStore';
import { labelAction, labelCondition, labelTarget } from './labels';

const PART_LABEL = { when: '조건', target: '대상', action: '행동' } as const;
const PART_TINT = {
  when: 'rgba(58,143,232,0.16)',
  target: 'rgba(242,194,48,0.14)',
  action: 'rgba(232,80,58,0.14)',
} as const;

function SubSlot({
  draft,
  slotIdx,
  part,
}: {
  draft: RuleDraft;
  slotIdx: number;
  part: 'when' | 'target' | 'action';
}) {
  const selected = useGameStore((s) => s.selected);
  const placeSelected = useGameStore((s) => s.placeSelected);
  const removePiece = useGameStore((s) => s.removePiece);
  const locked = useGameStore((s) => s.sim !== null);

  const value = draft[part];
  const label =
    value === null
      ? PART_LABEL[part]
      : part === 'when'
        ? labelCondition(value as never)
        : part === 'target'
          ? labelTarget(value as never)
          : labelAction(value as never);

  const receptive = selected?.part === part && !locked;

  return (
    <button
      type="button"
      data-subslot={`${slotIdx}:${part}`}
      onClick={() => {
        if (locked) return;
        if (receptive) placeSelected(slotIdx);
        else if (value !== null) removePiece(slotIdx, part);
      }}
      className="font-body relative min-h-[44px] flex-1 truncate rounded-[3px] px-1 text-[clamp(10px,3vw,13px)] leading-tight transition-colors"
      style={{
        border: receptive
          ? '1.5px dashed var(--c-glow)'
          : value
            ? '1px solid var(--c-line)'
            : '1px dashed var(--c-line-soft)',
        background: value ? PART_TINT[part] : 'transparent',
        color: value ? 'var(--c-paper)' : 'var(--c-dim)',
        boxShadow: receptive ? '0 0 12px rgba(242,194,48,0.25)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

export default function RuleSlots({
  activeRuleIndexes,
}: {
  activeRuleIndexes: Set<number>;
}) {
  const drafts = useGameStore((s) => s.drafts);
  const reorderDrafts = useGameStore((s) => s.reorderDrafts);
  const locked = useGameStore((s) => s.sim !== null);

  return (
    <Reorder.Group
      axis="y"
      values={drafts.map((d) => d.key)}
      onReorder={(keys: number[]) => reorderDrafts(keys)}
      className="flex flex-col gap-1.5"
      as="div"
    >
      {drafts.map((draft, i) => {
        const active = activeRuleIndexes.has(i);
        return (
          <Reorder.Item
            key={draft.key}
            value={draft.key}
            as="div"
            drag={locked ? false : 'y'}
            className="flex items-stretch gap-1.5"
          >
            <motion.div
              className="flex flex-1 items-stretch gap-1 rounded-[4px] p-1"
              animate={{
                boxShadow: active
                  ? '0 0 0 1.5px var(--c-glow), 0 0 18px rgba(242,194,48,0.35)'
                  : '0 0 0 1px var(--c-line-soft)',
              }}
              transition={{ duration: 0.18 }}
              style={{ background: 'var(--c-panel)' }}
            >
              <div
                className="font-mono-tech flex w-5 shrink-0 cursor-grab touch-none items-center justify-center text-[11px]"
                style={{ color: 'var(--c-dim)' }}
                title="드래그로 순서 변경"
              >
                {i + 1}
              </div>
              <SubSlot draft={draft} slotIdx={i} part="when" />
              <SubSlot draft={draft} slotIdx={i} part="target" />
              <SubSlot draft={draft} slotIdx={i} part="action" />
            </motion.div>
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}
