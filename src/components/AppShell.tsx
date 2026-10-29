import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { currentUser } from '../data/starters';
import { useConversations } from '../state/conversations';
import { providers, useSettings } from '../state/settings';
import { AiSettingsDialog } from './AiSettingsDialog';
import { DemoBadge, FreshnessLine } from './controls';
import { Icon, Logo } from './Icon';
import styles from './AppShell.module.css';

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.navItem} ${styles.active}` : styles.navItem);
const recentClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.recent} ${styles.active}` : styles.recent);

/** "Free demo · 7 left" or "Your Claude key". */
function useAiLabel() {
  const { settings, ownKey, freeUsage } = useSettings();
  if (ownKey) {
    const label = providers.find((p) => p.id === settings.provider)?.label ?? 'own';
    return `Your ${label.replace(/ \(.+\)$/, '').replace('Anthropic', 'Claude')} key`;
  }
  return freeUsage ? `Free demo · ${Math.max(freeUsage.limit - freeUsage.used, 0)} left today` : 'Free demo';
}

function Sidebar() {
  const { conversations, pins } = useConversations();
  const { openSettings } = useSettings();
  const aiLabel = useAiLabel();

  return (
    <nav aria-label="Main" className={styles.sidebar}>
      <Link to="/" className={styles.brand}>
        <Logo />
        <span>Pipeline</span>
      </Link>

      <Link to="/" className={styles.newQuestion}>
        <Icon name="plus" />
        New question
      </Link>

      <div className={styles.navGroup}>
        <NavLink to="/" end className={navClass}>
          <Icon name="ask" />
          Ask
        </NavLink>
        <NavLink to="/board" className={navClass}>
          <Icon name="board" />
          Pinned board
          <span className={styles.count}>{pins.length}</span>
        </NavLink>
      </div>

      <div className={styles.recentGroup}>
        <div className={styles.groupLabel}>Recent</div>
        {conversations.length === 0 ? (
          <p className={styles.empty}>Your questions will show up here.</p>
        ) : (
          conversations.slice(0, 8).map((c) => (
            <NavLink key={c.id} to={`/c/${c.id}`} className={recentClass}>
              {c.title}
            </NavLink>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.aiButton} onClick={openSettings}>
          <Icon name="sliders" />
          <span className={styles.aiText}>
            <span>AI settings</span>
            <span className={styles.aiMode}>{aiLabel}</span>
          </span>
        </button>
        <div className={styles.user}>
          <div aria-hidden="true" className={styles.avatar}>
            {currentUser.initials}
          </div>
          <div className={styles.userText}>
            <span className={styles.userName}>{currentUser.name}</span>
            <span className={styles.userRole}>{currentUser.role}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
      <AiSettingsDialog />
    </div>
  );
}

/** "Data as of 2:45 PM · 427 leads", or why there's no data. */
function LiveFreshness() {
  const { status, statusError } = useSettings();
  if (statusError) return <FreshnessLine state="stale">{statusError}</FreshnessLine>;
  if (!status) return <FreshnessLine state="refreshing">Connecting to the CRM…</FreshnessLine>;

  const asOf = new Date(status.as_of);
  const sameDay = asOf.toDateString() === new Date().toDateString();
  const time = asOf.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const when = sameDay ? time : `${asOf.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  const stale = Date.now() - asOf.getTime() > 2 * 60 * 60 * 1000;
  return (
    <FreshnessLine state={stale ? 'stale' : 'fresh'}>
      Data as of {when} · {status.lead_count.toLocaleString()} leads
    </FreshnessLine>
  );
}

interface TopBarProps {
  /** Where you are, e.g. "Lead sources · Q3". */
  title: ReactNode;
}

export function TopBar({ title }: TopBarProps) {
  const { openSettings } = useSettings();
  return (
    <>
      <header className={styles.topBar}>
        <span className={styles.crumb}>{title}</span>
        <div className={styles.status}>
          <LiveFreshness />
          <DemoBadge />
        </div>
      </header>

      {/* Phone layout: the sidebar folds into this header. */}
      <header className={styles.mobileBar}>
        <div className={styles.mobileRow}>
          <Link to="/" className={styles.brand}>
            <Logo />
            <span>Pipeline</span>
          </Link>
          <div className={styles.mobileActions}>
            <DemoBadge short />
            <Link to="/board" aria-label="Pinned board" className={styles.mobileIcon}>
              <Icon name="board" size={18} />
            </Link>
            <button type="button" aria-label="AI settings" className={styles.mobileIcon} onClick={openSettings}>
              <Icon name="sliders" size={18} />
            </button>
          </div>
        </div>
        <LiveFreshness />
      </header>
    </>
  );
}
