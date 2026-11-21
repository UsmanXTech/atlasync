import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Material Design 3 Card Component (Specification #2)
 * - Shape: Exactly 12dp medium radius
 * - Internal padding: Exactly 16dp
 * - Filled elevation: surface-container-lowest or surface-container-low, no drop shadows
 * - Max 2 actions in the header slot or card footer
 */
export default function Card({ title, subtitle, action, children, className = '' }: CardProps) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
