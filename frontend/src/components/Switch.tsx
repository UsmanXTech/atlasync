import { Check } from 'lucide-react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
}

/**
 * Material Design 3 Switch (Specification #9)
 * - Track: 52×32dp, stadium pill shape (rounded-full)
 *   OFF: surface-container-highest fill with 2dp outline border
 *   ON: solid primary fill (#0052cc)
 * - Handle:
 *   OFF: 16dp circle in outline color, left-aligned
 *   ON: expands to 24dp circle in on-primary (white), translated right
 * - Checkmark: 12dp checkmark icon inside the ON handle
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  id,
  className = '',
}: SwitchProps) {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`m3-switch-track ${checked ? 'on' : ''} ${className}`}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.38 : 1 }}
    >
      <span className="m3-switch-handle">
        {checked && <Check size={12} strokeWidth={3} className="m3-switch-icon" />}
      </span>
    </button>
  );
}
