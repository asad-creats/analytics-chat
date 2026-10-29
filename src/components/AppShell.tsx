import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { currentUser, dataset, recentConversations } from '../data/demo';
import { usePins } from '../state/pins';
import { DemoBadge, FreshnessLine } from './controls';
import { Icon, Logo } from './Icon';
import styles from './AppShell.module.css';

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.navItem} ${styles.active}` : styles.navItem);
const recentClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.recent} ${styles.active}` : styles.recent);

function Sidebar() {
  const { pinned } = usePins();
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
          <span className={styles.count}>{pinned.length}</span>
        </NavLink>
      </div>

      <div className={styles.recentGroup}>
        <div className={styles.groupLabel}>Recent</div>
        {recentConversations.map((item) => (
          <NavLink key={item.to} to={item.to} className={recentClass}>
            {item.title}
          </NavLink>
        ))}
      </div>

      <div className={styles.user}>
        <div aria-hidden="true" className={styles.avatar}>
          {currentUser.initials}
        </div>
        <div className={styles.userText}>
          <span className={styles.userName}>{currentUser.name}</span>
          <span className={styles.userRole}>{currentUser.role}</span>
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
    </div>
  );
}

interface TopBarProps {
  /** Where you are, e.g. "Lead sources · Q3". */
  title: ReactNode;
}

export function TopBar({ title }: TopBarProps) {
  const freshness = `Data as of ${dataset.asOf} · ${dataset.leadCount} leads`;
  return (
    <>
      <header className={styles.topBar}>
        <span className={styles.crumb}>{title}</span>
        <div className={styles.status}>
          <FreshnessLine>{freshness}</FreshnessLine>
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
            <DemoBadge />
            <Link to="/board" aria-label="Pinned board" className={styles.mobileIcon}>
              <Icon name="board" size={18} />
            </Link>
          </div>
        </div>
        <FreshnessLine>{freshness}</FreshnessLine>
      </header>
    </>
  );
}
