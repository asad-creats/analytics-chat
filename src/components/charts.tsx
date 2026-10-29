import { useState, type ReactNode } from 'react';
import { SegmentedToggle } from './controls';
import styles from './charts.module.css';

export type SeriesSlot = 1 | 2 | 3 | 4 | 5;
const seriesColor = (slot: SeriesSlot) => `var(--series-${slot})`;

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/* ---------- Horizontal bars ---------- */

export interface BarRow {
  label: string;
  sub?: string;
  value: number;
  display: ReactNode;
  /** Slot 5 is "everyone else". */
  slot?: SeriesSlot;
  emphasis?: boolean;
}

interface HBarChartProps {
  rows: BarRow[];
  max: number;
  ariaLabel: string;
  /** full: answer page with grid and axis. compact: thread card. mini: board card. */
  density?: 'full' | 'compact' | 'mini';
  ticks?: { value: number; label: string }[];
  axisTitles?: { rows: string; values: string };
  annotation?: { row: number; text: string };
}

export function HBarChart({ rows, max, ariaLabel, density = 'full', ticks = [], axisTitles, annotation }: HBarChartProps) {
  const pct = (value: number) => `${(100 * value) / max}%`;
  return (
    <div role="img" aria-label={ariaLabel} className={cx(styles.hbar, styles[density])}>
      {rows.map((row, index) => (
        <div key={row.label} className={styles.hbarRow}>
          {density === 'full' ? (
            <div className={styles.rowLabel}>
              <span className={styles.rowName}>{row.label}</span>
              {row.sub && <span className={styles.rowSub}>{row.sub}</span>}
            </div>
          ) : (
            <span>{row.label}</span>
          )}
          <div className={styles.track}>
            {density === 'full' &&
              ticks.map((tick) => (
                <div
                  key={tick.value}
                  className={tick.value === 0 ? styles.axisLine : styles.gridLine}
                  style={{ left: pct(tick.value) }}
                />
              ))}
            <div className={styles.bar} style={{ width: pct(row.value), background: seriesColor(row.slot ?? 1) }} />
            {annotation?.row === index && (
              <div className={styles.annotation} style={{ left: `calc(${pct(row.value)} + 12px)` }}>
                <span aria-hidden="true" className={styles.annotationRule} />
                {annotation.text}
              </div>
            )}
          </div>
          <span className={cx(styles.value, 'tabular', (row.emphasis ?? index === 0) && styles.valueStrong)}>
            {row.display}
          </span>
        </div>
      ))}
      {density === 'full' && ticks.length > 0 && (
        <div className={styles.hbarRow}>
          <div className={styles.axisTitle}>{axisTitles?.rows}</div>
          <div className={cx(styles.tickRow, 'tabular')}>
            {ticks.map((tick, i) => (
              <span
                key={tick.value}
                className={i === 0 ? styles.tickFirst : i === ticks.length - 1 ? styles.tickLast : styles.tick}
                style={i === 0 || i === ticks.length - 1 ? undefined : { left: pct(tick.value) }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div className={styles.axisTitle}>{axisTitles?.values}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Columns ---------- */

export interface Column {
  label: string;
  value: number;
  /** A period still in progress: drawn faded. */
  partial?: boolean;
}

interface ColumnChartProps {
  columns: Column[];
  max: number;
  /** Height in px that `max` maps to. */
  height: number;
  ariaLabel: string;
  emphasis?: number;
  reference?: { value: number; label: string };
}

export function ColumnChart({ columns, max, height, ariaLabel, emphasis, reference }: ColumnChartProps) {
  const px = (value: number) => (height * value) / max;
  return (
    <div className={styles.columns}>
      <div role="img" aria-label={ariaLabel} className={styles.columnPlot} style={{ height: height + 24 }}>
        {reference && (
          <>
            <div className={styles.reference} style={{ bottom: px(reference.value) }} />
            <span className={styles.referenceLabel} style={{ bottom: px(reference.value) + 3 }}>
              {reference.label}
            </span>
          </>
        )}
        {columns.map((column, index) => (
          <div key={column.label} className={styles.column}>
            <span className={cx('tabular', index === emphasis && styles.valueStrong)}>{column.value}</span>
            <div
              className={cx(styles.columnBar, column.partial && styles.partial)}
              style={{ height: px(column.value) }}
            />
          </div>
        ))}
      </div>
      <div className={styles.columnLabels} aria-hidden="true">
        {columns.map((column) => (
          <span key={column.label}>{column.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Lines ---------- */

export interface LineSeries {
  label: string;
  values: number[];
  slot: SeriesSlot;
}

interface LineChartProps {
  categories: string[];
  series: LineSeries[];
  /** Value that maps to the top of the plot. */
  domainMax: number;
  ariaLabel: string;
  /** full: the 720-wide answer chart. mini: the board card sparkline. */
  variant?: 'full' | 'mini';
  ticks?: number[];
  yTitle?: string;
  /** Category to shade and call out. */
  focus?: number;
  callout?: { series: number; index: number; title: string; detail?: string };
  /** mini only: indexes whose values get printed above the point. */
  labelled?: number[];
}

// x0..x1 is where the first and last points sit; points spread evenly between.
const layouts = {
  full: { width: 720, height: 240, x0: 64, x1: 584, top: 20, base: 200, r: 3.5 },
  mini: { width: 320, height: 112, x0: 24, x1: 296, top: 0, base: 88, r: 3 },
};

export function LineChart({
  categories,
  series,
  domainMax,
  ariaLabel,
  variant = 'full',
  ticks = [],
  yTitle,
  focus,
  callout,
  labelled = [],
}: LineChartProps) {
  const l = layouts[variant];
  const step = categories.length > 1 ? (l.x1 - l.x0) / (categories.length - 1) : 0;
  const x = (i: number) => l.x0 + i * step;
  const y = (v: number) => l.base - (v / domainMax) * (l.base - l.top);
  const plotEnd = variant === 'full' ? 600 : l.width - 8;
  const last = categories.length - 1;

  return (
    <svg
      viewBox={`0 0 ${l.width} ${l.height}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className={cx(styles.line, variant === 'mini' && styles.lineMini)}
    >
      <line x1={variant === 'full' ? 40 : 8} x2={plotEnd} y1={l.base} y2={l.base} className={styles.svgAxis} />
      {ticks.map((tick) => (
        <g key={tick}>
          {tick > 0 && <line x1={40} x2={plotEnd} y1={y(tick)} y2={y(tick)} className={styles.svgGrid} />}
          <text x={32} y={y(tick) + 4} textAnchor="end" className={styles.svgMuted}>
            {tick}
          </text>
        </g>
      ))}
      {yTitle && (
        <text x={0} y={14} className={styles.svgMuted}>
          {yTitle}
        </text>
      )}
      {categories.map((category, i) => (
        <text
          key={category}
          x={x(i)}
          y={l.height - (variant === 'full' ? 18 : 8)}
          textAnchor="middle"
          className={i === focus ? styles.svgStrong : styles.svgMuted}
        >
          {category}
        </text>
      ))}
      {focus !== undefined && (
        <rect
          x={x(focus) - 40}
          y={l.top}
          width={80}
          height={l.base - l.top}
          style={{ fill: seriesColor(2), opacity: 0.06 }}
        />
      )}
      {series.map((s, si) => (
        <g key={s.label} style={{ color: seriesColor(s.slot) }}>
          <polyline
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            className={styles.svgLine}
          />
          {s.values.map((v, i) => {
            const big = (callout?.series === si && callout.index === i) || (variant === 'mini' && i === last);
            return (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={big ? l.r + 1.5 : l.r}
                className={big ? styles.svgPointRing : styles.svgPoint}
              />
            );
          })}
          {variant === 'full' && (
            <text x={x(last) + 12} y={y(s.values[last]) + 4} className={styles.svgLabel}>
              {s.label} · {s.values[last]}
            </text>
          )}
          {variant === 'mini' &&
            labelled.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={y(s.values[i]) - 12}
                textAnchor="middle"
                className={i === last ? styles.svgStrong : styles.svgSecondary}
              >
                {s.values[i]}
              </text>
            ))}
        </g>
      ))}
      {callout && (
        <g>
          <text
            x={x(callout.index) + 12}
            y={y(series[callout.series].values[callout.index]) - 4}
            className={styles.svgStrong}
          >
            {callout.title}
          </text>
          {callout.detail && (
            <text
              x={x(callout.index) + 12}
              y={y(series[callout.series].values[callout.index]) + 12}
              className={styles.svgSecondary}
            >
              {callout.detail}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/* ---------- Table ---------- */

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  muted?: boolean;
  strong?: boolean;
}

interface DataTableProps {
  columns: TableColumn[];
  rows: Record<string, ReactNode>[];
  caption?: string;
  /** Wide tables scroll inside their box rather than squashing. */
  minWidth?: number;
}

export function DataTable({ columns, rows, caption, minWidth }: DataTableProps) {
  return (
    <div className={styles.tableBox}>
      <table className={styles.table} style={{ minWidth }}>
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={{ textAlign: column.align ?? 'left' }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(column.muted && styles.muted, column.strong && styles.strong, column.align === 'right' && 'tabular')}
                  style={{ textAlign: column.align ?? 'left' }}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Figure with Chart/Table toggle ---------- */

interface ChartFigureProps {
  title: string;
  subtitle: string;
  /** "Bar" or "Line": the label on the chart half of the toggle. */
  chartLabel: string;
  chart: ReactNode;
  table: DataTableProps;
  /** Answer page pads the figure; thread cards sit flush. */
  padded?: boolean;
}

export function ChartFigure({ title, subtitle, chartLabel, chart, table, padded = false }: ChartFigureProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <figure className={cx(styles.figure, padded && styles.figurePadded)}>
      <div className={styles.figureHead}>
        <figcaption className={styles.caption}>
          <span className={styles.captionTitle}>{title}</span>
          <span className={styles.captionSub}>{subtitle}</span>
        </figcaption>
        <SegmentedToggle
          label="Chart type"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: chartLabel },
            { value: 'table', label: 'Table' },
          ]}
        />
      </div>
      {view === 'chart' ? chart : <DataTable {...table} caption={title} />}
    </figure>
  );
}
