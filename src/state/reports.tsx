import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AskError, generateReport, type AnswerMeta, type Report, type ReportOptions } from '../api/pipeline';
import { useSettings } from './settings';
import { load, save } from './storage';

export interface SavedReport {
  id: string;
  options: ReportOptions;
  requestedAt: string;
  status: 'pending' | 'done' | 'error';
  report?: Report;
  meta?: AnswerMeta;
  error?: { code: string; message: string };
}

const REPORTS_KEY = 'pipeline.reports';
const MAX_REPORTS = 20;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface ReportsValue {
  reports: SavedReport[];
  get: (id: string) => SavedReport | undefined;
  /** Starts a report and returns its id; it fills in when the AI finishes. */
  generate: (options: ReportOptions) => string;
  retry: (id: string) => void;
  remove: (id: string) => void;
}

const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<SavedReport[]>(() =>
    load<SavedReport[]>(REPORTS_KEY, []).map((r) =>
      r.status === 'pending'
        ? { ...r, status: 'error', error: { code: 'interrupted', message: 'This report was interrupted before it finished.' } }
        : r,
    ),
  );
  const { ownKey, setFreeUsage, refreshStatus } = useSettings();
  const latest = useRef(reports);
  latest.current = reports;

  useEffect(() => save(REPORTS_KEY, reports), [reports]);

  const patch = useCallback((id: string, change: Partial<SavedReport>) => {
    setReports((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }, []);

  const run = useCallback(
    (id: string, options: ReportOptions) => {
      generateReport(options, ownKey)
        .then(({ report, meta }) => {
          patch(id, { status: 'done', report, meta, error: undefined });
          if (meta.usage) setFreeUsage(meta.usage);
          refreshStatus();
        })
        .catch((e: unknown) => {
          const error = e instanceof AskError ? e : new AskError('error', 'Something went wrong.');
          patch(id, { status: 'error', error: { code: error.code, message: error.message } });
        });
    },
    [ownKey, patch, setFreeUsage, refreshStatus],
  );

  const generate = useCallback(
    (options: ReportOptions) => {
      const entry: SavedReport = { id: newId(), options, requestedAt: new Date().toISOString(), status: 'pending' };
      const list = [entry, ...latest.current].slice(0, MAX_REPORTS);
      latest.current = list;
      setReports(list);
      run(entry.id, options);
      return entry.id;
    },
    [run],
  );

  const retry = useCallback(
    (id: string) => {
      const entry = latest.current.find((r) => r.id === id);
      if (!entry) return;
      patch(id, { status: 'pending', error: undefined, requestedAt: new Date().toISOString() });
      run(id, entry.options);
    },
    [patch, run],
  );

  const remove = useCallback((id: string) => setReports((list) => list.filter((r) => r.id !== id)), []);

  const value = useMemo<ReportsValue>(
    () => ({ reports, get: (id) => reports.find((r) => r.id === id), generate, retry, remove }),
    [reports, generate, retry, remove],
  );

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports() {
  const value = useContext(ReportsContext);
  if (!value) throw new Error('useReports must be used inside <ReportsProvider>');
  return value;
}
