import { Check, type LucideIcon } from 'lucide-react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedButtonProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Material Design 3 Segmented Button (Specification #10)
 * - Height: Exactly 40dp (h-10)
 * - Shape: Fully rounded outer corners (rounded-full)
 * - Border: 1dp outline-variant border
 * - 2 to 5 segments max
 * - Selected Segment: secondary-container fill (#d7e3f8), on-secondary-container text, leading Check icon
 * - Unselected Segment: transparent fill, on-surface text
 */
export default function SegmentedButton<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedButtonProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`segmented ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={String(option.value)}
            type="button"
            className={`segmented-item ${isSelected ? 'active' : ''}`}
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
          >
            {isSelected ? (
              <Check size={14} strokeWidth={2.5} />
            ) : Icon ? (
              <Icon size={14} />
            ) : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
