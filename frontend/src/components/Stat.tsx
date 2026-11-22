import type { LucideIcon } from 'lucide-react';

interface StatProps {
  label: string;
  value: string;
  delta: string;
  tone: 'up' | 'down' | 'flat' | 'bad';
  icon: LucideIcon;
  // Phase 3.1 — when present the stat is a button that asks
  // Intelligence about this metric. A stat without onClick stays inert
  // so no number leaks into a live prompt unasked.
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Material Design 3 Stat Tile
 * - Title Medium label
 * - Title Large value with tabular numbers
 * - Semantic status container tone deltas
 */
export default function Stat({ label, value, delta, tone, icon: Icon, onClick, ariaLabel }: StatProps) {
  const inner = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className="stat-value tabular-nums">{value}</div>
      <div className={`stat-delta ${tone}`}>{delta}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="stat stat-clickable" onClick={onClick} aria-label={ariaLabel ?? label}>
        {inner}
      </button>
    );
  }
  return <div className="stat">{inner}</div>;
}
