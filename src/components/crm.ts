import type { CrmStatus, DataStatus } from '../api/pipeline';

/** How each connection state reads in the interface. */
export const crmStatusLabel: Record<CrmStatus, string> = {
  demo: 'Demo data',
  connected: 'Connected',
  syncing: 'Syncing…',
  error: 'Sync failed',
  disconnected: 'Not connected',
};

/** Freshness-line shape for a status: dot when fine, ring while busy, diamond when not. */
export function crmTone(status: CrmStatus | undefined): 'fresh' | 'refreshing' | 'stale' {
  if (status === 'connected' || status === 'demo') return 'fresh';
  if (status === 'syncing') return 'refreshing';
  return 'stale';
}

export function syncedLabel(status: DataStatus): string {
  const at = new Date(status.as_of);
  const sameDay = at.toDateString() === new Date().toDateString();
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${at.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}
