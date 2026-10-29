import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import styles from './controls.module.css';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'default' | 'lg';
  icon?: IconName;
}

export function Button({ variant = 'default', size = 'default', icon, className, children, type, ...rest }: ButtonProps) {
  const iconOnly = !children;
  return (
    <button
      type={type ?? 'button'}
      className={cx(
        styles.button,
        size !== 'default' && styles[size],
        variant !== 'default' && styles[variant],
        iconOnly && styles.iconOnly,
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

interface PinButtonProps {
  pinned: boolean;
  onToggle: () => void;
  /** "label" shows Pin/Pinned text; "icon" is the compact board version. */
  variant?: 'label' | 'icon';
}

export function PinButton({ pinned, onToggle, variant = 'label' }: PinButtonProps) {
  const icon = <Icon name={pinned ? 'pinFilled' : 'pin'} />;
  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={styles.pinIcon}
        aria-pressed={pinned}
        aria-label={pinned ? 'Unpin' : 'Pin'}
        onClick={onToggle}
      >
        {icon}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={cx(styles.button, styles.md, styles.pin, pinned && styles.pinned)}
      aria-pressed={pinned}
      onClick={onToggle}
    >
      {icon}
      {pinned ? 'Pinned' : 'Pin'}
    </button>
  );
}

interface SuggestionChipProps {
  children: ReactNode;
  onClick?: () => void;
  to?: string;
}

/** Follow-up question chip. Links when it has a destination, otherwise a button. */
export function SuggestionChip({ children, onClick, to }: SuggestionChipProps) {
  if (to) {
    return (
      <Link to={to} className={styles.suggestion}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.suggestion} onClick={onClick}>
      {children}
    </button>
  );
}

export function FilterChip({ children }: { children: ReactNode }) {
  return <span className={styles.filter}>{children}</span>;
}

export function DemoBadge({ short = false }: { short?: boolean }) {
  return <span className={styles.demo}>{short ? 'Demo' : 'Demo · fake data'}</span>;
}

interface FreshnessLineProps {
  state?: 'fresh' | 'refreshing' | 'stale';
  children: ReactNode;
}

export function FreshnessLine({ state = 'fresh', children }: FreshnessLineProps) {
  return (
    <span className={cx(styles.freshness, state === 'refreshing' && styles.refreshing, state === 'stale' && styles.stale)}>
      <span aria-hidden="true" className={styles.marker} />
      {children}
    </span>
  );
}

interface SegmentedToggleProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedToggle<T extends string>({ label, options, value, onChange }: SegmentedToggleProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segment}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
