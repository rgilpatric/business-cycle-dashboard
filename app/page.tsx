// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type FredPoint = {
  date: string;
  value: number;
};

type ResidentialIndicator = {
  name: string;
  latest: number;
  latestLabel: string;
  yoy: number;
  sixMonth: number;
  weakening: boolean;
  unit: string;
  longTrend: number[];
  shortTrend: number[];
  rocTrend: number[];
  xAxis: string[];
  longXAxis: string[];
  yAxis: number[];
  rocAxis: number[];
};

async function loadFredCsv(fileName: string): Promise<FredPoint[]> {
  const res = await fetch(`/data/${fileName}`);
  const text = await res.text();

  const lines = text.trim().split("\n").slice(1);

  return lines
    .map((line) => {
      const [date, raw] = line.split(",");
      return { date, value: Number(raw) };
    })
    .filter((d) => Number.isFinite(d.value));
}

function pctChange(current: number, prior: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return 0;
  return ((current / prior) - 1) * 100;
}

function latestValue(data: FredPoint[]): number {
  return data[data.length - 1]?.value ?? 0;
}

function yoyChange(data: FredPoint[]): number {
  if (data.length < 13) return 0;
  return pctChange(data[data.length - 1].value, data[data.length - 13].value);
}

function sixMonthMomentum(data: FredPoint[]): number {
  if (data.length < 7) return 0;
  return pctChange(data[data.length - 1].value, data[data.length - 7].value);
}

function formatMillions(value: number): string {
  return `${(value / 1000).toFixed(3)}M`;
}

function formatThousands(value: number): string {
  return `${Math.round(value)}k`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function axisLabels(data: FredPoint[]): string[] {
  if (!data.length) return [];
  return [
    data[0].date.slice(0, 4),
    data[Math.floor(data.length / 2)].date.slice(0, 4),
    data[data.length - 1].date.slice(0, 4),
  ];
}

function longAxisLabels(data: FredPoint[]): string[] {
  if (!data.length) return [];
  return [
    data[0].date.slice(0, 4),
    data[Math.floor(data.length / 3)].date.slice(0, 4),
    data[Math.floor((2 * data.length) / 3)].date.slice(0, 4),
    data[data.length - 1].date.slice(0, 4),
  ];
}

function makeAxis(values: number[]): number[] {
  if (!values.length) return [0, 0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  return [Number(min.toFixed(1)), Number(mid.toFixed(1)), Number(max.toFixed(1))];
}

function scoreIndicator(yoy: number, sixMonth: number): number {
  if (yoy > 5 && sixMonth > 0) return 0;
  if (yoy < 0 && sixMonth < 0) return 2;
  return 1;
}

function scoreLabel(score: number): string {
  if (score < 0.75) return "Expanding";
  if (score < 1.5) return "Slowing";
  return "Contracting";
}

function scoreTone(score: number): string {
  if (score < 0.75) return "text-green-700";
  if (score < 1.5) return "text-amber-700";
  return "text-red-700";
}

function cardTone(score: number): string {
  if (score < 0.75) return "bg-green-50 border-green-200";
  if (score < 1.5) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function buildIndicator(
  name: string,
  data: FredPoint[],
  formatter: (v: number) => string,
  unit: string
): ResidentialIndicator {
  const latest = latestValue(data);
  const yoy = yoyChange(data);
  const sixMonth = sixMonthMomentum(data);

  const longTrend = data.map((d) => d.value);
  const shortTrend = data.slice(-12).map((d) => d.value);

  const rocTrend = data.slice(-12).map((_, idx) => {
    const sourceIndex = data.length - 12 + idx;
    if (sourceIndex < 12) return 0;
    return Number(
      pctChange(data[sourceIndex].value, data[sourceIndex - 12].value).toFixed(1)
    );
  });

  return {
    name,
    latest,
    latestLabel: formatter(latest),
    yoy,
    sixMonth,
    weakening: yoy < 0 || sixMonth < 0,
    unit,
    longTrend,
    shortTrend,
    rocTrend,
    xAxis: axisLabels(data),
    longXAxis: longAxisLabels(data),
    yAxis: makeAxis(longTrend),
    rocAxis: makeAxis(rocTrend),
  };
}

function Sparkline({
  values,
  yAxis,
  xAxis,
  title,
  tall = false,
}: {
  values: number[];
  yAxis: number[];
  xAxis: string[];
  title: string;
  tall?: boolean;
}) {
  const width = 360;
  const height = tall ? 180 : 110;
  const leftPad = 42;
  const rightPad = 12;
  const topPad = 18;
  const bottomPad = 28;

  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerWidth = width - leftPad - rightPad;
  const innerHeight = height - topPad - bottomPad;

  const points = values
    .map((v, i) => {
      const x = leftPad + (i / Math.max(values.length - 1, 1)) * innerWidth;
      const y = topPad + innerHeight - ((v - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={tall ? "h-44 w-full" : "h-28 w-full"}>
      <text x={leftPad} y={10} fontSize="10" className="fill-slate-500">
        {title}
      </text>

      <line x1={leftPad} y1={topPad} x2={leftPad} y2={height - bottomPad} stroke="currentColor" className="text-slate-300" />
      <line x1={leftPad} y1={height - bottomPad} x2={width - rightPad} y2={height - bottomPad} stroke="currentColor" className="text-slate-300" />

      {yAxis.map((label, idx) => {
        const y = topPad + (idx / Math.max(yAxis.length - 1, 1)) * innerHeight;
        return (
          <g key={`y-${idx}`}>
            <text x={4} y={y + 4} fontSize="10" className="fill-slate-500">
              {label}
            </text>
            <line
              x1={leftPad}
              y1={y}
              x2={width - rightPad}
              y2={y}
              stroke="currentColor"
              className="text-slate-200"
              strokeDasharray="3 3"
            />
          </g>
        );
      })}

      {xAxis.map((label, idx) => {
        const x = leftPad + (idx / Math.max(xAxis.length - 1, 1)) * innerWidth;
        return (
          <text key={`x-${idx}`} x={x - 10} y={height - 6} fontSize="10" className="fill-slate-500">
            {label}
          </text>
        );
      })}

      <polyline fill="none" stroke="currentColor" strokeWidth="3" points={points} className="text-slate-700" />
    </svg>
  );
}

export default function Page() {
  const [indicators, setIndicators] = useState<ResidentialIndicator[] | null>(null);
  const [selected, setSelected] = useState("Housing Starts");

  useEffect(() => {
    async function load() {
      const [housingStarts, buildingPermits, newHomeSales] = await Promise.all([
        loadFredCsv("housing-starts.csv"),
        loadFredCsv("building-permits.csv"),
        loadFredCsv("new-home-sales.csv"),
      ]);

      setIndicators([
        buildIndicator("Housing Starts", housingStarts, formatMillions, "Starts (thousands)"),
        buildIndicator("Building Permits", buildingPermits, formatMillions, "Permits (thousands)"),
        buildIndicator("New Home Sales", newHomeSales, formatThousands, "Sales (thousands)"),
      ]);
    }

    load().catch(console.error);
  }, []);

  const residentialScore = useMemo(() => {
    if (!indicators?.length) return 0;
    return (
      indicators.reduce((sum, i) => sum + scoreIndicator(i.yoy, i.sixMonth), 0) /
      indicators.length
    );
  }, [indicators]);

  const weakeningShare = useMemo(() => {
    if (!indicators?.length) return 0;
    return Math.round((indicators.filter((i) => i.weakening).length / indicators.length) * 100);
  }, [indicators]);

  const selectedIndicator = indicators?.find((i) => i.name === selected) ?? indicators?.[0];

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Business Cycle Dashboard
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Residential
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Real-data residential lead sector card. This preserves the EPB emphasis on housing,
                rate of change, breadth, and long lookback context.
              </p>
            </div>

            <div className={`rounded-2xl border px-5 py-4 ${cardTone(residentialScore)}`}>
              <div className="text-sm text-slate-500">Residential sector score</div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">
                {indicators ? residentialScore.toFixed(2) : "--"}
              </div>
              <div className={`mt-1 text-sm font-medium ${scoreTone(residentialScore)}`}>
                {indicators ? scoreLabel(residentialScore) : "Loading"}
              </div>
              <div className="mt-3 text-sm text-slate-600">
                {indicators ? `${weakeningShare}% of residential indicators weakening` : "Loading data..."}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-3xl border p-6 shadow-sm ${cardTone(residentialScore)}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Lead sector</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Residential Investment</h2>
              <p className="mt-2 max-w-2xl text-slate-700">
                Housing is the earliest cyclical transmission channel. Watch permits, starts, and sales
                for deceleration before broader labor deterioration.
              </p>
            </div>

            <div className="min-w-[260px] rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Sector score band</span>
                <span className={scoreTone(residentialScore)}>{scoreLabel(residentialScore)}</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="flex h-full">
                  <div className="w-[37.5%] bg-green-400" />
                  <div className="w-[37.5%] bg-amber-400" />
                  <div className="w-[25%] bg-red-400" />
                </div>
              </div>
              <div className="relative mt-2 h-6">
                <div
                  className={`absolute top-0 h-6 w-1 rounded-full ${
                    residentialScore < 0.75
                      ? "bg-green-600"
                      : residentialScore < 1.5
                      ? "bg-amber-600"
                      : "bg-red-600"
                  }`}
                  style={{ left: `${Math.min((residentialScore / 2) * 100, 100)}%` }}
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>0.0</span>
                  <span>0.75</span>
                  <span>1.5</span>
                  <span>2.0</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {(indicators ?? []).map((indicator) => (
              <button
                key={indicator.name}
                onClick={() => setSelected(indicator.name)}
                className={`rounded-3xl bg-white/85 p-4 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 ${
                  selectedIndicator?.name === indicator.name ? "ring-2 ring-slate-400" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{indicator.name}</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {indicator.latestLabel}
                    </div>
                  </div>
                  <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {formatPercent(indicator.yoy)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    <div className="text-slate-500">YoY</div>
                    <div className="mt-1 font-medium text-slate-800">{formatPercent(indicator.yoy)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                    <div className="text-slate-500">6M momentum</div>
                    <div className="mt-1 font-medium text-slate-800">{formatPercent(indicator.sixMonth)}</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  {indicator.weakening ? "Weakening" : "Still expanding"} · {indicator.unit}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedIndicator ? (
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Selected indicator
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {selectedIndicator.name}
                  </h3>
                  <p className="mt-2 max-w-3xl text-slate-600">
                    Long-lookback level chart plus separate rate-of-change view, which is the EPB-style
                    way to catch turning points early.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  Latest {selectedIndicator.latestLabel}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Level chart</span>
                    <span>Lookback: 2000 to present</span>
                  </div>
                  <Sparkline
                    values={selectedIndicator.longTrend}
                    yAxis={selectedIndicator.yAxis}
                    xAxis={selectedIndicator.longXAxis}
                    title="Indicator scale"
                    tall
                  />
                </div>

                <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Rate of change</span>
                    <span>YoY view</span>
                  </div>
                  <Sparkline
                    values={selectedIndicator.rocTrend}
                    yAxis={selectedIndicator.rocAxis}
                    xAxis={selectedIndicator.xAxis}
                    title="Rate-of-change scale"
                    tall
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Indicator readout</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="text-slate-500">Latest value</div>
                    <div className="mt-1 font-medium text-slate-900">{selectedIndicator.latestLabel}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="text-slate-500">YoY</div>
                    <div className="mt-1 font-medium text-slate-900">{formatPercent(selectedIndicator.yoy)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="text-slate-500">6M momentum</div>
                    <div className="mt-1 font-medium text-slate-900">{formatPercent(selectedIndicator.sixMonth)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="text-slate-500">Status</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedIndicator.weakening ? "Weakening" : "Expanding"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Residential rules</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    Permits and starts both negative YoY increase early warning risk.
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    Negative 6-month momentum confirms the slowdown is ongoing, not just a one-month dip.
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    Residential is the lead sector and should carry the highest weight in the composite.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}