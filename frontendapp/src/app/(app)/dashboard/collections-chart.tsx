"use client";

import { useId, useState } from "react";
import type { Dashboard } from "@/types/dashboard";

type Series = Dashboard["collections_by_month"]["series"][number];

type Props = {
    months: string[];
    series: Series[];
    /** The card's title, drawn inside the dark panel. */
    title: string;
    description: string;
};

/**
 * FR-DSH-15. Collections by month, one line per investor.
 *
 * Drawn as a dark panel whatever the app theme, the way a chart on a
 * printed statement keeps its own paper: the lines are the point, and they
 * read best on a deep ground. The palette is the categorical order validated
 * against this exact surface — slot 1 is always the first investor by name,
 * so filtering to one investor never repaints them — and text never wears a
 * series colour; identity comes from the dot or line key beside the name.
 *
 * Inline SVG rather than a chart package (NFR-10). The lines are smoothed
 * with a monotone cubic curve, which rounds the corners without ever
 * overshooting a point: a month that collected nothing sits on the baseline
 * rather than dipping below it.
 */

const MAX_SERIES = 8;

/** Validated on `PANEL` for lightness, CVD separation and contrast. */
const SERIES = [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
    "#e66767",
];

const PANEL = "#171c26";
const INK = "#f2f4f7";
const INK_MUTED = "#98a2b3";
const GRID = "#2a3140";

// The plot's geometry, in SVG units. Wider than tall, since twelve months
// read left to right; the viewBox scales it to whatever width the card has.
const W = 720;
const H = 250;
const PAD = { top: 16, right: 24, bottom: 36, left: 52 };

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: number): string {
    return `Rs. ${money.format(value)}`;
}

/** `1.5L`, `20K`, `2Cr` for ticks; the tooltip and table carry the exact figure. */
function compact(value: number): string {
    const short = (n: number) => String(Number(n.toFixed(2)));

    if (value >= 10_000_000) return `${short(value / 10_000_000)}Cr`;
    if (value >= 100_000) return `${short(value / 100_000)}L`;
    if (value >= 1_000) return `${short(value / 1_000)}K`;

    return String(Math.round(value));
}

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_LONG = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
];

/** `2026-03` → `Mar 26` */
function monthLabel(month: string): string {
    const [year, mm] = month.split("-");

    return `${MONTH_NAMES[Number(mm) - 1] ?? mm} ${year.slice(2)}`;
}

/** `2026-03` → `March 2026`, for the tooltip. */
function monthName(month: string): string {
    const [year, mm] = month.split("-");

    return `${MONTH_NAMES_LONG[Number(mm) - 1] ?? mm} ${year}`;
}

/**
 * Clean y-axis ticks: a step of 1, 2 or 5 × 10ⁿ chosen so about four fit,
 * and a ceiling that is a whole number of those steps.
 */
function niceTicks(max: number): number[] {
    if (max <= 0) return [0, 250, 500, 750, 1_000];

    const rough = max / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step =
        [1, 2, 5, 10].find((unit) => rough <= unit * magnitude)! * magnitude;
    const top = Math.ceil(max / step) * step;
    const ticks: number[] = [];

    for (let tick = 0; tick <= top + step / 2; tick += step) ticks.push(tick);

    return ticks;
}

/**
 * A smooth path through the points that never overshoots them (Fritsch–
 * Carlson monotone cubic). Ordinary Catmull–Rom curves would dip below zero
 * between a paid month and an empty one, which is a value the data never had.
 */
function smoothPath(points: { x: number; y: number }[]): string {
    const n = points.length;

    if (n === 0) return "";
    if (n === 1) return `M${points[0].x},${points[0].y}`;

    const dx = points.slice(1).map((p, i) => p.x - points[i].x);
    const dy = points.slice(1).map((p, i) => p.y - points[i].y);
    const slope = dx.map((d, i) => dy[i] / d);

    const tangent: number[] = [slope[0]];

    for (let i = 1; i < n - 1; i += 1) {
        tangent.push(
            slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
        );
    }

    tangent.push(slope[n - 2]);

    for (let i = 0; i < n - 1; i += 1) {
        if (slope[i] === 0) {
            tangent[i] = 0;
            tangent[i + 1] = 0;
            continue;
        }

        const a = tangent[i] / slope[i];
        const b = tangent[i + 1] / slope[i];
        const s = a * a + b * b;

        if (s > 9) {
            const t = 3 / Math.sqrt(s);

            tangent[i] = t * a * slope[i];
            tangent[i + 1] = t * b * slope[i];
        }
    }

    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

    for (let i = 0; i < n - 1; i += 1) {
        const h = dx[i] / 3;
        const c1x = points[i].x + h;
        const c1y = points[i].y + tangent[i] * h;
        const c2x = points[i + 1].x - h;
        const c2y = points[i + 1].y - tangent[i + 1] * h;

        d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${points[i + 1].x.toFixed(1)},${points[i + 1].y.toFixed(1)}`;
    }

    return d;
}

export function CollectionsChart({
    months,
    series,
    title,
    description,
}: Props) {
    const id = useId();
    const [hover, setHover] = useState<number | null>(null);
    const [showTable, setShowTable] = useState(false);

    // Past eight, the rest fold into "Other" rather than take a ninth colour
    // no reader could tell from the first eight.
    const shown: Series[] =
        series.length <= MAX_SERIES
            ? series
            : [
                  ...series.slice(0, MAX_SERIES - 1),
                  {
                      investor_id: 0,
                      investor_name: "Other",
                      values: months.map((_, at) =>
                          series
                              .slice(MAX_SERIES - 1)
                              .reduce(
                                  (sum, row) => sum + Number(row.values[at]),
                                  0
                              )
                              .toFixed(2)
                      ),
                  },
              ];

    const numeric = shown.map((row) => row.values.map(Number));
    const ticks = niceTicks(Math.max(0, ...numeric.flat()));
    const max = ticks[ticks.length - 1];

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const baseline = PAD.top + plotH;
    const slot = months.length > 1 ? plotW / (months.length - 1) : plotW;

    const x = (at: number) => PAD.left + at * slot;
    const y = (value: number) => PAD.top + plotH - (value / max) * plotH;

    function pointerAt(event: React.PointerEvent<SVGSVGElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        const px = ((event.clientX - box.left) / box.width) * W;
        const at = Math.round((px - PAD.left) / slot);

        setHover(Math.max(0, Math.min(months.length - 1, at)));
    }

    const empty = numeric.flat().every((value) => value === 0);

    const last = months.length - 1;
    const total = numeric.reduce(
        (sum, values) => sum + values.reduce((a, b) => a + b, 0),
        0
    );
    const latest = numeric.reduce((sum, values) => sum + values[last], 0);
    const previous =
        last > 0 ? numeric.reduce((sum, values) => sum + values[last - 1], 0) : 0;
    const change = previous > 0 ? ((latest - previous) / previous) * 100 : null;

    // Which month the legend chips describe: the hovered one, else the latest.
    const focus = hover ?? last;

    return (
        <section
            className="rounded-2xl px-5 pb-5 pt-5 sm:px-6"
            style={{ background: PANEL, color: INK }}
            aria-label={title}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: INK_MUTED }}
                    >
                        {title}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">
                        {pkr(total)}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
                        collected in the last twelve months
                        {change !== null ? (
                            <>
                                {" · "}
                                <span
                                    className="font-medium"
                                    style={{
                                        color: change >= 0 ? "#3ccb7f" : "#f97066",
                                    }}
                                >
                                    {change >= 0 ? "▲" : "▼"}{" "}
                                    {Math.abs(change).toFixed(0)}%
                                </span>{" "}
                                vs the month before
                            </>
                        ) : null}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: INK_MUTED }}>
                        {description}
                    </p>
                </div>

                {/* Legend, for two or more series. A single series is named
                    by the title. Chips carry the month in focus. */}
                {shown.length > 1 ? (
                    <ul className="flex flex-wrap gap-2 sm:justify-end">
                        {shown.map((row, i) => (
                            <li
                                key={row.investor_id}
                                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                }}
                            >
                                <span
                                    aria-hidden
                                    className="inline-block size-2 rounded-full"
                                    style={{ background: SERIES[i] }}
                                />
                                <span>{row.investor_name}</span>
                                <span
                                    className="tabular-nums"
                                    style={{ color: INK_MUTED }}
                                >
                                    {compact(numeric[i][focus])}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>

            <div className="relative mt-5">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="block h-auto w-full"
                    role="img"
                    aria-labelledby={`${id}-title`}
                    onPointerMove={pointerAt}
                    onPointerLeave={() => setHover(null)}
                >
                    <title id={`${id}-title`}>
                        Collections by month for the last twelve months
                    </title>

                    <defs>
                        {/* A wash under each line, fading to nothing. */}
                        {shown.map((row, i) => (
                            <linearGradient
                                key={row.investor_id}
                                id={`${id}-fill-${i}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={SERIES[i]}
                                    stopOpacity={0.28}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={SERIES[i]}
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        ))}

                        {/* Diagonal hatching for the month still in progress:
                            its figure is not final, and the texture says so
                            without a colour or a word. */}
                        <pattern
                            id={`${id}-hatch`}
                            width="8"
                            height="8"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(45)"
                        >
                            <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="8"
                                stroke={INK}
                                strokeOpacity={0.12}
                                strokeWidth={2}
                            />
                        </pattern>
                    </defs>

                    {/* Gridlines: hairline, recessive, one per tick. */}
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line
                                x1={PAD.left}
                                x2={W - PAD.right}
                                y1={y(tick)}
                                y2={y(tick)}
                                stroke={GRID}
                                strokeWidth={1}
                            />
                            <text
                                x={PAD.left - 10}
                                y={y(tick)}
                                dy="0.35em"
                                textAnchor="end"
                                fontSize={11}
                                fill={INK_MUTED}
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {compact(tick)}
                            </text>
                        </g>
                    ))}

                    {/* The current month, hatched: still being collected. */}
                    {months.length > 1 ? (
                        <rect
                            x={x(last) - slot / 2}
                            y={PAD.top}
                            width={slot / 2 + 6}
                            height={plotH}
                            fill={`url(#${id}-hatch)`}
                        />
                    ) : null}

                    {/* Month ticks: a short mark on every month, a label on
                        every other, since twelve labels would crowd. */}
                    {months.map((month, at) => (
                        <g key={month}>
                            <line
                                x1={x(at)}
                                x2={x(at)}
                                y1={baseline}
                                y2={baseline + 5}
                                stroke={GRID}
                                strokeWidth={1}
                            />
                            {at % 2 === months.length % 2 ? (
                                <text
                                    x={x(at)}
                                    y={baseline + 20}
                                    textAnchor="middle"
                                    fontSize={11}
                                    fill={INK_MUTED}
                                >
                                    {monthLabel(month)}
                                </text>
                            ) : null}
                        </g>
                    ))}

                    {/* The month in focus: a soft band and a crosshair. */}
                    {hover !== null ? (
                        <>
                            <rect
                                x={x(hover) - slot / 2}
                                y={PAD.top}
                                width={slot}
                                height={plotH}
                                fill={INK}
                                fillOpacity={0.04}
                            />
                            <line
                                x1={x(hover)}
                                x2={x(hover)}
                                y1={PAD.top}
                                y2={baseline}
                                stroke={INK_MUTED}
                                strokeWidth={1}
                                strokeOpacity={0.6}
                            />
                        </>
                    ) : null}

                    {/* Washes first, so every line sits above every fill. */}
                    {numeric.map((values, i) => {
                        const line = smoothPath(
                            values.map((value, at) => ({ x: x(at), y: y(value) }))
                        );

                        return (
                            <path
                                key={shown[i].investor_id}
                                d={`${line} L${x(last).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`}
                                fill={`url(#${id}-fill-${i})`}
                                stroke="none"
                            />
                        );
                    })}

                    {/* Lines: 2px, round joins. Markers ride on a 2px ring in
                        the panel colour so they stay legible where lines cross. */}
                    {numeric.map((values, i) => (
                        <g key={shown[i].investor_id}>
                            <path
                                d={smoothPath(
                                    values.map((value, at) => ({
                                        x: x(at),
                                        y: y(value),
                                    }))
                                )}
                                fill="none"
                                stroke={SERIES[i]}
                                strokeWidth={2.5}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {values.map((value, at) =>
                                hover === at || (hover === null && at === last) ? (
                                    <circle
                                        key={at}
                                        cx={x(at)}
                                        cy={y(value)}
                                        r={4.5}
                                        fill={SERIES[i]}
                                        stroke={PANEL}
                                        strokeWidth={2}
                                    />
                                ) : null
                            )}
                        </g>
                    ))}

                    {empty ? (
                        <text
                            x={PAD.left + plotW / 2}
                            y={PAD.top + plotH / 2}
                            textAnchor="middle"
                            fontSize={12}
                            fill={INK_MUTED}
                        >
                            Nothing collected in the last twelve months.
                        </text>
                    ) : null}
                </svg>

                {/* One tooltip, every series at that month. Values lead. */}
                {hover !== null ? (
                    <div
                        className="pointer-events-none absolute top-1 min-w-40 rounded-lg px-3 py-2 text-xs shadow-xl"
                        style={{
                            background: "#232a36",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: INK,
                            ...(hover < months.length / 2
                                ? {
                                      left: `${(x(hover) / W) * 100}%`,
                                      marginLeft: 14,
                                  }
                                : {
                                      right: `${100 - (x(hover) / W) * 100}%`,
                                      marginRight: 14,
                                  }),
                        }}
                    >
                        <p className="mb-1.5 font-semibold">
                            {monthName(months[hover])}
                            {hover === last ? (
                                <span
                                    className="ml-1 font-normal"
                                    style={{ color: INK_MUTED }}
                                >
                                    · so far
                                </span>
                            ) : null}
                        </p>
                        <ul className="flex flex-col gap-1">
                            {shown.map((row, i) => (
                                <li
                                    key={row.investor_id}
                                    className="flex items-center justify-between gap-4"
                                >
                                    <span
                                        className="flex items-center gap-2"
                                        style={{ color: INK_MUTED }}
                                    >
                                        <span
                                            aria-hidden
                                            className="inline-block h-0.5 w-3 rounded-full"
                                            style={{ background: SERIES[i] }}
                                        />
                                        {shown.length > 1
                                            ? row.investor_name
                                            : "Collected"}
                                    </span>
                                    <span className="font-semibold tabular-nums">
                                        {pkr(numeric[i][hover])}
                                    </span>
                                </li>
                            ))}
                            {shown.length > 1 ? (
                                <li
                                    className="mt-1 flex items-center justify-between gap-4 pt-1"
                                    style={{
                                        borderTop: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                >
                                    <span style={{ color: INK_MUTED }}>Total</span>
                                    <span className="font-semibold tabular-nums">
                                        {pkr(
                                            numeric.reduce(
                                                (sum, values) =>
                                                    sum + values[hover],
                                                0
                                            )
                                        )}
                                    </span>
                                </li>
                            ) : null}
                        </ul>
                    </div>
                ) : null}
            </div>

            {/* The same figures as a table, so nothing depends on hovering. */}
            <button
                type="button"
                onClick={() => setShowTable(!showTable)}
                className="mt-2 text-xs underline-offset-4 hover:underline"
                style={{ color: INK_MUTED }}
                aria-expanded={showTable}
            >
                {showTable ? "Hide table" : "Show as table"}
            </button>

            {showTable ? (
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                        <thead style={{ color: INK_MUTED }}>
                            <tr style={{ borderBottom: `1px solid ${GRID}` }}>
                                <th className="px-2 py-1.5 font-medium">
                                    Investor
                                </th>
                                {months.map((month) => (
                                    <th
                                        key={month}
                                        className="px-2 py-1.5 text-right font-medium"
                                    >
                                        {monthLabel(month)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((row, i) => (
                                <tr
                                    key={row.investor_id}
                                    style={{ borderBottom: `1px solid ${GRID}` }}
                                >
                                    <td className="px-2 py-1.5">
                                        {row.investor_name}
                                    </td>
                                    {numeric[i].map((value, at) => (
                                        <td
                                            key={at}
                                            className="px-2 py-1.5 text-right tabular-nums"
                                        >
                                            {money.format(value)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
