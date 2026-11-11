import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { browserDemo } from '../api/pipeline';
import { currentUser } from '../data/starters';
import { useConversations } from '../state/conversations';
import { providers, useSettings } from '../state/settings';
import { AiSettingsDialog } from './AiSettingsDialog';
import { DemoBadge, FreshnessLine } from './controls';
import { crmStatusLabel, crmTone, syncedLabel } from './crm';
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
  if (browserDemo) return 'Sample answers (no key)';
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
        <NavLink to="/reports" className={navClass}>
          <Icon name="report" />
          Reports
        </NavLink>
        <NavLink to="/board" className={navClass}>
          <Icon name="board" />
          Pinned board
          <span className={styles.count}>{pins.length}</span>
        </NavLink>
        <NavLink to="/data" className={navClass}>
          <Icon name="database" />
          Data source
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
        <DataSourceCard />
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

/** Which CRM the answers come from, and whether it's connected. */
function DataSourceCard() {
  const { status, statusError } = useSettings();
  const crm = status?.crm;
  return (
    <Link to="/data" className={styles.sourceCard}>
      <span className={styles.sourceLabel}>Data source</span>
      <span className={styles.sourceName}>
        <Icon name="database" />
        {crm?.name ?? (statusError ? 'Not connected' : 'Connecting…')}
      </span>
      <FreshnessLine state={statusError ? 'stale' : crmTone(crm?.status)}>
        {statusError
          ? statusError
          : status && crm
            ? `${crmStatusLabel[crm.status]} · synced ${syncedLabel(status)}`
            : browserDemo
              ? 'Loading the demo database…'
              : 'Checking…'}
      </FreshnessLine>
    </Link>
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

/** "Demo CRM · data as of 2:45 PM · 427 leads", or why there's no data. Links to the data source page. */
function LiveFreshness() {
  const { status, statusError } = useSettings();
  let line: ReactNode;
  if (statusError) {
    line = <FreshnessLine state="stale">{statusError}</FreshnessLine>;
  } else if (!status) {
    line = (
      <FreshnessLine state="refreshing">{browserDemo ? 'Loading the demo database…' : 'Connecting to the CRM…'}</FreshnessLine>
    );
  } else {
    const stale = Date.now() - new Date(status.as_of).getTime() > 2 * 60 * 60 * 1000;
    line = (
      <FreshnessLine state={stale ? 'stale' : crmTone(status.crm?.status)}>
        {status.crm?.name ?? 'CRM'} · data as of {syncedLabel(status)} · {status.lead_count.toLocaleString()} leads
      </FreshnessLine>
    );
  }
  return (
    <Link to="/data" className={styles.freshLink}>
      {line}
    </Link>
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
            <Link to="/reports" aria-label="Reports" className={styles.mobileIcon}>
              <Icon name="report" size={18} />
            </Link>
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
