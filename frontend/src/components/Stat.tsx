import type { LucideIcon } from 'lucide-react';

interface StatProps {
  label: string;
  value: string;
  delta: string;
  tone: 'up' | 'down' | 'flat' | 'bad';
  icon: LucideIcon;
}

/**
 * Material Design 3 Stat Tile
 * - Title Medium label
 * - Title Large value with tabular numbers
 * - Semantic status container tone deltas
 */
export default function Stat({ label, value, delta, tone, icon: Icon }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className="stat-value tabular-nums">{value}</div>
      <div className={`stat-delta ${tone}`}>{delta}</div>
    </div>
  );
}
