import { motion } from 'framer-motion';
import type { CardVocabulary } from '../levels/types';
import type { CardPiece } from '../store/gameStore';
import { useGameStore } from '../store/gameStore';
import { COLOR_HEX, labelAction, labelCondition, labelTarget } from './labels';

const PART_KO = { when: '조건', target: '대상', action: '행동' } as const;

function Card({ piece }: { piece: CardPiece }) {
  const selected = useGameStore((s) => s.selected);
  const selectCard = useGameStore((s) => s.selectCard);
  const placeSelected = useGameStore((s) => s.placeSelected);
  const locked = useGameStore((s) => s.sim !== null);

  const label =
    piece.part === 'when'
      ? labelCondition(piece.value)
      : piece.part === 'target'
        ? labelTarget(piece.value)
        : labelAction(piece.value);

  const isSelected =
    selected !== null && JSON.stringify(selected) === JSON.stringify(piece);

  // 대상 카드에 색 힌트 점 표시
  const dotColor =
    piece.part === 'target' && piece.value.kind === 'color'
      ? COLOR_HEX[piece.value.color]
      : piece.part === 'action' && piece.value.kind === 'paint'
        ? COLOR_HEX[piece.value.color]
        : null;

  return (
    <motion.button
      type="button"
      drag={!locked}
      dragSnapToOrigin
      dragElastic={0.2}
      whileDrag={{ scale: 1.12, zIndex: 50 }}
      onDragEnd={(e) => {
        // 드롭 위치의 서브 슬롯을 찾아 장착 (드래그 앤 드롭)
        const pt = e as PointerEvent;
        const el = document
          .elementFromPoint(pt.clientX, pt.clientY)
          ?.closest('[data-subslot]');
        if (el) {
          const attr = (el as HTMLElement).dataset.subslot ?? '';
          const [idxStr, part] = attr.split(':');
          if (part === piece.part) {
            useGameStore.setState({ selected: piece });
            placeSelected(Number(idxStr));
            return;
          }
        }
        selectCard(null);
      }}
      onClick={() => {
        if (locked) return;
        selectCard(isSelected ? null : piece);
      }}
      className="font-body relative flex min-h-[44px] shrink-0 touch-none items-center gap-1.5 rounded-[4px] px-2.5 text-[clamp(11px,3.1vw,13px)]"
      style={{
        border: isSelected
          ? '1.5px solid var(--c-glow)'
          : '1px solid var(--c-line)',
        background: isSelected ? 'rgba(242,194,48,0.12)' : 'var(--c-panel)',
        color: 'var(--c-paper)',
        boxShadow: isSelected
          ? '0 0 14px rgba(242,194,48,0.3)'
          : '0 1px 4px rgba(0,0,0,0.3)',
        opacity: locked ? 0.45 : 1,
      }}
    >
      {dotColor && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
      )}
      {label}
    </motion.button>
  );
}

export default function CardDrawer({ cards }: { cards: CardVocabulary }) {
  const groups: { part: CardPiece['part']; items: CardPiece[] }[] = [
    { part: 'when', items: cards.when.map((value) => ({ part: 'when', value })) },
    {
      part: 'target',
      items: cards.target.map((value) => ({ part: 'target', value })),
    },
    {
      part: 'action',
      items: cards.action.map((value) => ({ part: 'action', value })),
    },
  ];

  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 py-1.5">
      {groups.map((g) => (
        <div key={g.part} className="flex shrink-0 items-center gap-1.5">
          <span
            className="font-mono-tech shrink-0 text-[10px] tracking-widest"
            style={{ color: 'var(--c-dim)', writingMode: 'vertical-rl' }}
          >
            {PART_KO[g.part]}
          </span>
          {g.items.map((piece, i) => (
            <Card key={`${g.part}-${i}`} piece={piece} />
          ))}
        </div>
      ))}
    </div>
  );
}
