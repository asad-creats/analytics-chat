import type { Answer } from '../api/pipeline';
import { ChartFigure, ColumnChart, DataTable, HBarChart, LineChart, type SeriesSlot } from './charts';

type ChartSpec = NonNullable<Answer['chart']>;

/** Formats a value in the chart's unit: 19.4%, 11 min, $612K, 1,204. */
export function formatValue(value: number, unit = ''): string {
  const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  if (unit === '$') {
    const abs = Math.abs(value);
    if (abs >= 1e6) return `$${round(value / 1e6)}M`;
    if (abs >= 1e3) return `$${Math.round(value / 1e3)}K`;
    return `$${Math.round(value)}`;
  }
  const n = round(value).toLocaleString();
  if (unit === '%') return `${n}%`;
  if (unit) return `${n} ${unit}`;
  return n;
}

/** A round axis maximum just above the largest value: 19.4 -> 20, 61 -> 80, 412 -> 500. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= max)!;
  return step * magnitude;
}

function ticksFor(max: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 100) / 100);
}

function tableFor(chart: ChartSpec) {
  const labels = chart.series[0]?.points.map((p) => p.label) ?? [];
  return {
    columns: [
      { key: 'label', label: '' },
      ...chart.series.map((s, i) => ({ key: `s${i}`, label: s.name, align: 'right' as const })),
    ],
    rows: labels.map((label, row) => ({
      label,
      ...Object.fromEntries(
        chart.series.map((s, i) => {
          const point = s.points.find((p) => p.label === label) ?? s.points[row];
          return [`s${i}`, point ? formatValue(point.value, chart.unit) : '–'];
        }),
      ),
    })),
  };
}

function describe(chart: ChartSpec): string {
  const parts = chart.series.map(
    (s) => `${s.name}: ${s.points.map((p) => `${p.label} ${formatValue(p.value, chart.unit)}`).join(', ')}`,
  );
  return `${chart.title}. ${parts.join('. ')}`;
}

interface AnswerChartProps {
  chart: ChartSpec;
  /** Full size on the answer page; compact on board cards. */
  size?: 'full' | 'compact';
  padded?: boolean;
}

export function ChartBody({ chart, size = 'full' }: AnswerChartProps) {
  const points = chart.series[0]?.points ?? [];
  const max = niceMax(Math.max(...chart.series.flatMap((s) => s.points.map((p) => p.value)), 0));
  const label = describe(chart);

  if (chart.type === 'bar') {
    return (
      <HBarChart
        density={size === 'full' ? 'full' : 'mini'}
        max={max}
        ariaLabel={label}
        ticks={size === 'full' ? ticksFor(max).map((v) => ({ value: v, label: formatValue(v, chart.unit) })) : []}
        rows={points.map((p) => ({ label: p.label, value: p.value, display: formatValue(p.value, chart.unit) }))}
      />
    );
  }

  if (chart.type === 'column') {
    return (
      <ColumnChart
        columns={points.map((p) => ({ label: p.label, value: p.value }))}
        max={max}
        height={size === 'full' ? 140 : 72}
        ariaLabel={label}
      />
    );
  }

  const peak = chart.series.reduce(
    (best, s, si) => {
      s.points.forEach((p, i) => {
        if (p.value > best.value) best = { series: si, index: i, value: p.value };
      });
      return best;
    },
    { series: 0, index: 0, value: -Infinity },
  );
  return (
    <LineChart
      variant={size === 'full' ? 'full' : 'mini'}
      categories={points.map((p) => p.label)}
      series={chart.series.map((s, i) => ({
        label: s.name,
        values: s.points.map((p) => p.value),
        slot: (i + 1) as SeriesSlot,
      }))}
      domainMax={max * 1.12}
      ticks={size === 'full' ? ticksFor(max) : []}
      yTitle={size === 'full' && chart.unit ? (chart.unit === '%' ? 'Percent' : chart.unit === 'min' ? 'Minutes' : chart.unit) : undefined}
      labelled={size === 'full' ? [] : [peak.index, points.length - 1]}
      callout={
        size === 'full' && chart.series.length > 1
          ? { series: peak.series, index: peak.index, title: formatValue(peak.value, chart.unit) }
          : undefined
      }
      ariaLabel={label}
    />
  );
}

/** The chart with its caption and a Chart/Table toggle. */
export function AnswerChart({ chart, padded }: AnswerChartProps) {
  return (
    <ChartFigure
      padded={padded}
      title={chart.title}
      subtitle={chart.subtitle ?? ''}
      chartLabel={chart.type === 'line' ? 'Line' : 'Bar'}
      chart={<ChartBody chart={chart} />}
      table={tableFor(chart)}
    />
  );
}

export function AnswerTable({ table }: { table: NonNullable<Answer['table']> }) {
  const columns = table.columns.map((label, i) => ({
    key: String(i),
    label,
    // Numbers and durations read better right-aligned.
    align: table.rows.every((r) => /^[$\d.,%\s]+(min|h|d|K|M)?$|^\d+[dhm]( \d+[hm])?$/.test(r[i] ?? '')) ? ('right' as const) : undefined,
  }));
  return (
    <DataTable
      caption={table.title}
      minWidth={table.columns.length > 4 ? 640 : undefined}
      columns={columns}
      rows={table.rows.map((row) => Object.fromEntries(row.map((cell, i) => [String(i), cell])))}
    />
  );
}
