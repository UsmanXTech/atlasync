import type { InsightPoint, IssueBucket } from '../data/types';

// Horizontal distribution bars (e.g. issues by status / priority).
// `compact` narrows the label/count columns for side-by-side groups in a
// narrow card — the track stays readable and the count carries precision.
export function BarList({ items, tone = 'blue', compact = false }: { items: IssueBucket[]; tone?: 'blue' | 'green' | 'amber'; compact?: boolean }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className={`bar-list${compact ? ' compact' : ''}`}>
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="bar-label">{item.label}</span>
          <div className="bar-track">
            <div
              className={`bar-fill ${tone}`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="bar-count">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

// Grouped weekly bars for the Insights view (issues / docs / PRs).
export function TrendChart({ points }: { points: InsightPoint[] }) {
  const max = Math.max(...points.flatMap((p) => [p.issues, p.docs, p.prs]), 1);
  const w = 560;
  const h = 220;
  const pad = 28;
  const groupW = (w - pad * 2) / points.length;
  const barW = Math.min(14, groupW / 5);

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Weekly activity trend">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={w - pad}
            y1={h - pad - f * (h - pad * 2)}
            y2={h - pad - f * (h - pad * 2)}
            className="trend-grid"
          />
        ))}
        {points.map((p, i) => {
          const x0 = pad + i * groupW + (groupW - barW * 3 - 8) / 2;
          const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
          return (
            <g key={p.label}>
              <rect x={x0} y={y(p.issues)} width={barW} height={h - pad - y(p.issues)} className="trend-bar blue" rx={2} />
              <rect x={x0 + barW + 4} y={y(p.docs)} width={barW} height={h - pad - y(p.docs)} className="trend-bar green" rx={2} />
              <rect x={x0 + barW * 2 + 8} y={y(p.prs)} width={barW} height={h - pad - y(p.prs)} className="trend-bar amber" rx={2} />
              <text x={x0 + barW * 1.5 + 4} y={h - 8} className="trend-label" textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="trend-legend">
        <span><i className="dot blue" /> Issues</span>
        <span><i className="dot green" /> Docs</span>
        <span><i className="dot amber" /> PRs</span>
      </div>
    </div>
  );
}
