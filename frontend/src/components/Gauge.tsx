interface GaugeProps {
  value: number; // 0–100
  label: string;
}

// SVG readiness ring. Pure presentation — no chart library needed.
export default function Gauge({ value, label }: GaugeProps) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;
  const tone = value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad';

  return (
    <div className="gauge">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${label}: ${value} percent`}>
        <circle className="gauge-track" cx="70" cy="70" r={r} />
        <circle
          className={`gauge-arc ${tone}`}
          cx="70"
          cy="70"
          r={r}
          strokeDasharray={`${filled} ${c}`}
        />
      </svg>
      <div className="gauge-center">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
