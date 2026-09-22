import type { Asset } from '@/api/types';

/** Каркасные аксонометрии по типу объекта. Линии, без фотореализма. */
export function AssetFigure({ kind }: { kind: Asset['figure'] }) {
  if (kind === 'intake') {
    return (
      <svg viewBox="0 0 260 130" width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label="Каркасная схема водозаборного сооружения">
        <g stroke="var(--bst-accent-700)" strokeWidth="1" fill="none">
          <path d="M40 100 130 126 220 100 130 74Z" />
          <path d="M40 100V64M220 100V64M130 126V90M40 64 130 38 220 64 130 90Z" />
          <circle cx="130" cy="62" r="16" />
          <path d="M130 46V30M114 62H98M146 62h16" />
        </g>
        <g stroke="var(--bst-accent-400)" strokeWidth="0.8" fill="none" strokeDasharray="4 3">
          <path d="M20 110H240M20 118H240" />
        </g>
      </svg>
    );
  }

  if (kind === 'mill') {
    return (
      <svg viewBox="0 0 260 130" width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label="Каркасная схема кормоцеха с силосами">
        <g stroke="var(--bst-accent-700)" strokeWidth="1" fill="none">
          <path d="M50 104 120 122 190 104 120 86Z" />
          <path d="M50 104V52M190 104V52M120 122V70M50 52 120 34 190 52 120 70Z" />
          <path d="M196 96V44M228 96V44M196 44a16 8 0 0 1 32 0M196 96a16 8 0 0 0 32 0" />
        </g>
        <g stroke="var(--bst-accent-400)" strokeWidth="0.8" fill="none">
          <path d="M80 98V46M150 98V46M120 34V18" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 260 130" width="100%" height="auto" style={{ display: 'block' }} role="img" aria-label="Каркасная аксонометрия здания молочного комплекса">
      <g stroke="var(--bst-accent-700)" strokeWidth="1" fill="none">
        <path d="M30 96 130 124 230 96 130 68Z" />
        <path d="M30 96V56M230 96V56M130 124V84" />
        <path d="M30 56 130 28 230 56 130 84Z" />
        <path d="M130 28V12M30 56 130 40 230 56" />
      </g>
      <g stroke="var(--bst-accent-400)" strokeWidth="0.8" fill="none">
        <path d="M55 89V49M80 82V42M105 75V35M155 75V35M180 82V42M205 89V49" />
      </g>
    </svg>
  );
}
