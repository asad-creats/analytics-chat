import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { browserDemo } from '../api/pipeline';
import { TopBar } from '../components/AppShell';
import { Button } from '../components/controls';
import { Icon } from '../components/Icon';
import { useReports, type SavedReport } from '../state/reports';
import { providers, useSettings } from '../state/settings';
import {
  dailyPreset,
  type Period,
  periods,
  type ReportOptions,
  type SectionId,
  sections,
} from '../../supabase/functions/pipeline-ask/report.ts';
import styles from './Reports.module.css';

const presets: { id: string; label: string; detail: string; options: ReportOptions }[] = [
  { id: 'daily', label: 'Daily report', detail: 'Yesterday’s leads, speed, waiting leads, what’s coming up', options: dailyPreset },
  {
    id: 'weekly',
    label: 'Weekly team review',
    detail: 'Last 7 days: activity, speed, pipeline, what leads are saying',
    options: {
      preset: 'custom',
      period: 'last_7_days',
      sections: ['agent_activity', 'speed_to_lead', 'pipeline', 'appointments', 'notes_themes'],
    },
  },
  {
    id: 'deals',
    label: 'Deals & deadlines',
    detail: 'Closings in the next 14 days and contingencies due',
    options: { preset: 'custom', period: 'this_week', sections: ['deals_closing', 'contingencies', 'pipeline'] },
  },
];

const sectionIds = Object.keys(sections) as SectionId[];

export function reportTitle(r: SavedReport) {
  return r.report?.title ?? (r.options.preset === 'daily' ? 'Daily report' : 'Custom report');
}

export function Reports() {
  const navigate = useNavigate();
  const { reports, generate, remove } = useReports();
  const { status, ownKey, settings, openSettings } = useSettings();
  const [options, setOptions] = useState<ReportOptions>({ ...dailyPreset, sections: [...dailyPreset.sections] });
  const [presetId, setPresetId] = useState('daily');

  const choosePreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)!;
    setPresetId(id);
    setOptions({ ...preset.options, sections: [...preset.options.sections], agent: options.agent, focus: options.focus });
  };

  /** Period and sections define a preset; agent and focus can be added to any. */
  const change = (patch: Partial<ReportOptions>) => {
    const reshapes = 'period' in patch || 'sections' in patch;
    if (reshapes) setPresetId('custom');
    setOptions((o) => ({ ...o, ...patch, ...(reshapes ? { preset: 'custom' as const } : {}) }));
  };

  const toggleSection = (id: SectionId) =>
    change({
      sections: options.sections.includes(id)
        ? options.sections.filter((s) => s !== id)
        : sectionIds.filter((s) => s === id || options.sections.includes(s)),
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (options.sections.length === 0) return;
    navigate(`/reports/${generate(options)}`);
  };

  const engine = ownKey
    ? `Written by your ${providers.find((p) => p.id === settings.provider)?.label ?? ''} key.`
    : browserDemo
      ? 'Without a key you get a sample report from fixed queries. Add a key for the period, agent and focus you choose.'
      : 'Uses 3 of your free questions. Add your own key for no limit.';

  return (
    <>
      <TopBar title="Reports" />
      <div className={styles.page}>
        <form className={styles.builder} onSubmit={submit}>
          <div className={styles.head}>
            <h1 className={styles.title}>Generate a report</h1>
            <p className={styles.lede}>
              The AI works through all of the CRM data for the sections you pick and pulls out what matters most.
            </p>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Start from</legend>
            <div className={styles.presets}>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.preset}
                  aria-pressed={presetId === p.id}
                  onClick={() => choosePreset(p.id)}
                >
                  <strong>{p.label}</strong>
                  <span>{p.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.legend}>Period</span>
              <select value={options.period} onChange={(e) => change({ period: e.target.value as Period })}>
                {(Object.keys(periods) as Period[]).map((p) => (
                  <option key={p} value={p}>
                    {periods[p][0].toUpperCase() + periods[p].slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.legend}>Whose data</span>
              <select value={options.agent ?? ''} onChange={(e) => change({ agent: e.target.value || null })}>
                <option value="">Whole team</option>
                {(status?.agents ?? []).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Sections</legend>
            <div className={styles.sections}>
              {sectionIds.map((id) => (
                <label key={id} className={styles.section}>
                  <input type="checkbox" checked={options.sections.includes(id)} onChange={() => toggleSection(id)} />
                  <span>
                    <strong>{sections[id].label}</strong>
                    <span>{sections[id].brief.split('.')[0]}.</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={styles.field}>
            <span className={styles.legend}>Anything specific to pull out? (optional)</span>
            <textarea
              rows={2}
              value={options.focus ?? ''}
              onChange={(e) => change({ focus: e.target.value })}
              placeholder="e.g. buyers who mention pre-approval, Zillow leads that went quiet, who needs coaching on follow-up"
            />
          </label>

          <div className={styles.submitRow}>
            <Button type="submit" variant="primary" size="lg" disabled={options.sections.length === 0} icon="report">
              Generate report
            </Button>
            <span className={styles.engine}>
              {engine}{' '}
              {!ownKey && (
                <button type="button" className={styles.inlineLink} onClick={openSettings}>
                  AI settings
                </button>
              )}
            </span>
          </div>
        </form>

        <aside className={styles.saved} aria-labelledby="saved-reports">
          <h2 id="saved-reports" className={styles.legend}>
            Your reports
          </h2>
          {reports.length === 0 ? (
            <p className={styles.empty}>Reports you generate are kept here, in this browser.</p>
          ) : (
            <ul className={styles.savedList}>
              {reports.map((r) => (
                <li key={r.id} className={styles.savedItem}>
                  <Link to={`/reports/${r.id}`} className={styles.savedLink}>
                    <Icon name="report" />
                    <span>
                      <strong>{reportTitle(r)}</strong>
                      <small>
                        {r.status === 'pending'
                          ? 'Writing…'
                          : r.status === 'error'
                            ? 'Didn’t finish'
                            : new Date(r.requestedAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                        {' · '}
                        {periods[r.options.period]}
                      </small>
                    </span>
                  </Link>
                  <button type="button" className={styles.delete} aria-label={`Delete ${reportTitle(r)}`} onClick={() => remove(r.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
