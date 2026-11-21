interface GaugeProps {
  value: number; // 0–100
  label: string;
}

/**
 * Material Design 3 Linear Progress Readiness Indicator (Specification #7)
 * - Track thickness: Exactly 4dp
 * - Geometry: Flat linear shape with rounded ends (rounded-full)
 * - Colors: Active indicator = primary (#0052cc); track = secondary-container (#d7e3f8)
 * - Numeric readout: Prominent bold percentage readout beside or above the indicator
 */
export default function Gauge({ value, label }: GaugeProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const tone = value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad';

  return (
    <div className="readiness-meter" role="region" aria-label={`${label}: ${value} percent`}>
      <div className="readiness-numeric">{value}%</div>
      <div className="readiness-track-wrap">
        <div className="readiness-track-label">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
        <div
          className="linear-progress"
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`linear-progress-fill ${tone}`}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
      </div>
    </div>
  );
}
