import type { InsightPoint, IssueBucket } from '../data/types';

/**
 * Material Design 3 Linear Distribution Bars (Specification #7)
 * - 4dp track thickness, rounded ends (rounded-full)
 * - secondary-container track (#d7e3f8), primary active fill
 * - JetBrains Mono counts with tabular numerals
 */
export function BarList({
  items,
  tone = 'blue',
  compact = false,
}: {
  items: IssueBucket[];
  tone?: 'blue' | 'green' | 'amber';
  compact?: boolean;
}) {
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

/**
 * Weekly activity trend visualization styled with M3 color tokens
 */
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
            stroke="var(--md-sys-color-outline-variant)"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
        ))}
        {points.map((p, i) => {
          const x0 = pad + i * groupW + (groupW - barW * 3 - 8) / 2;
          const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
          return (
            <g key={p.label}>
              <rect
                x={x0}
                y={y(p.issues)}
                width={barW}
                height={h - pad - y(p.issues)}
                fill="var(--md-sys-color-primary)"
                rx={2}
              />
              <rect
                x={x0 + barW + 4}
                y={y(p.docs)}
                width={barW}
                height={h - pad - y(p.docs)}
                fill="var(--md-sys-color-healthy-on-container)"
                rx={2}
              />
              <rect
                x={x0 + barW * 2 + 8}
                y={y(p.prs)}
                width={barW}
                height={h - pad - y(p.prs)}
                fill="var(--md-sys-color-at-risk-on-container)"
                rx={2}
              />
              <text
                x={x0 + barW * 1.5 + 4}
                y={h - 8}
                className="trend-label"
                textAnchor="middle"
                fill="var(--md-sys-color-on-surface-variant)"
                fontSize="11"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="trend-legend" style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--md-sys-color-primary)', display: 'inline-block' }} /> Issues
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--md-sys-color-healthy-on-container)', display: 'inline-block' }} /> Docs
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--md-sys-color-at-risk-on-container)', display: 'inline-block' }} /> PRs
        </span>
      </div>
    </div>
  );
}
