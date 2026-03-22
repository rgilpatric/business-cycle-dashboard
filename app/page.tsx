// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type FredPoint = {
  date: string;
  value: number;
};

type Indicator = {
  name: string;
  latest: number;
  latestLabel: string;
  yoy: number;
  sixMonth: number;
  weakening: boolean;
  unit: string;
  data: FredPoint[];
};

type Sector = {
  id: string;
  name: string;
  weight: number;
  weightLabel: string;
  interpretation: string;
  detail: string;
  indicators: Indicator[];
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

function formatIndex(value: number): string {
  return value.toFixed(1);
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function makeAxis(values: number[]): number[] {
  if (!values.length) return [0, 0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  return [Number(max.toFixed(1)), Number(mid.toFixed(1)), Number(min.toFixed(1))];
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
): Indicator {
  const latest = latestValue(data);
  const yoy = yoyChange(data);
  const sixMonth = sixMonthMomentum(data);

  return {
    name,
    latest,
    latestLabel: formatter(latest),
    yoy,
    sixMonth,
    weakening: yoy < 0 || sixMonth < 0,
    unit,
    data,
  };
}

function makePlaceholderData(startYear: number, values: number[]): FredPoint[] {
  return values.map((value, idx) => ({
    date: `${startYear + idx}-01-01`,
    value,
  }));
}

function filterByLookback(data: FredPoint[], lookback: string): FredPoint[] {
  if (lookback === "full") return data;

  const startYear =
    lookback === "2000" ? 2000 :
    lookback === "2008" ? 2008 :
    lookback === "2020" ? 2020 :
    2000;

  return data.filter((d) => Number(d.date.slice(0, 4)) >= startYear);
}

function makeXAxisLabels(data: FredPoint[], count = 4): string[] {
  if (!data.length) return [];
  if (data.length < count) return data.map((d) => d.date.slice(0, 4));

  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i * (data.length - 1)) / (count - 1));
    labels.push(data[idx].date.slice(0, 4));
  }
  return labels;
}

function buildRocTrend(data: FredPoint[]): FredPoint[] {
  const out: FredPoint[] = [];
  for (let i = 12; i < data.length; i++) {
    out.push({
      date: data[i].date,
      value: Number(pctChange(data[i].value, data[i - 12].value).toFixed(1)),
    });
  }
  return out;
}

function sectorScore(sector: Sector): number {
  if (!sector.indicators.length) return 0;
  return (
    sector.indicators.reduce((sum, i) => sum + scoreIndicator(i.yoy, i.sixMonth), 0) /
    sector.indicators.length
  );
}

function weakeningShare(sector: Sector): number {
  if (!sector.indicators.length) return 0;
  return Math.round(
    (sector.indicators.filter((i) => i.weakening).length / sector.indicators.length) * 100
  );
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
  const [selectedSectorId, setSelectedSectorId] = useState("residential");
  const [selectedIndicatorName, setSelectedIndicatorName] = useState("Housing Starts");
  const [lookback, setLookback] = useState("2000");
  const [residentialIndicators, setResidentialIndicators] = useState<Indicator[] | null>(null);

  useEffect(() => {
    async function loadResidential() {
      const [housingStarts, buildingPermits, newHomeSales] = await Promise.all([
        loadFredCsv("housing-starts.csv"),
        loadFredCsv("building-permits.csv"),
        loadFredCsv("new-home-sales.csv"),
      ]);

      setResidentialIndicators([
        buildIndicator("Housing Starts", housingStarts, formatMillions, "Starts (thousands)"),
        buildIndicator("Building Permits", buildingPermits, formatMillions, "Permits (thousands)"),
        buildIndicator("New Home Sales", newHomeSales, formatThousands, "Sales (thousands)"),
      ]);
    }

    loadResidential().catch(console.error);
  }, []);

  const sectors: Sector[] = useMemo(() => {
    const transportationIndicators: Indicator[] = [
      buildIndicator(
        "Transport Equipment Orders",
        makePlaceholderData(2000, [58, 60, 63, 66, 70, 74, 78, 81, 69, 57, 60, 64, 68, 71, 74, 77, 79, 82, 84, 86, 88, 90, 86, 80, 74]),
        formatIndex,
        "Index level"
      ),
      buildIndicator(
        "Heavy Truck Sales",
        makePlaceholderData(2000, [320, 330, 345, 360, 380, 395, 410, 430, 350, 280, 295, 320, 340, 365, 385, 400, 415, 430, 445, 455, 460, 450, 435, 415, 395]),
        formatThousands,
        "Units (thousands)"
      ),
      buildIndicator(
        "Freight Volume Proxy",
        makePlaceholderData(2000, [61, 62, 64, 66, 68, 70, 72, 75, 66, 58, 61, 64, 67, 70, 73, 75, 77, 79, 81, 83, 84, 85, 82, 78, 74]),
        formatIndex,
        "Index level"
      ),
    ];

    const durableIndicators: Indicator[] = [
      buildIndicator(
        "Core Durable Orders",
        makePlaceholderData(2000, [44, 45, 46, 48, 50, 52, 54, 56, 52, 48, 47, 49, 51, 54, 57, 59, 61, 63, 64, 65, 66, 67, 65, 62, 59]),
        formatIndex,
        "Index level"
      ),
      buildIndicator(
        "ISM New Orders",
        makePlaceholderData(2000, [58, 60, 61, 63, 65, 67, 69, 66, 55, 42, 48, 52, 55, 57, 59, 61, 63, 62, 61, 60, 58, 57, 54, 52, 50]),
        formatIndex,
        "Diffusion index"
      ),
      buildIndicator(
        "Light Vehicle Sales",
        makePlaceholderData(2000, [17100, 17000, 16900, 16800, 16700, 16600, 16400, 16000, 13500, 10800, 11600, 12400, 13200, 14000, 14700, 15400, 16000, 16700, 17000, 16900, 16600, 16300, 16000, 15700, 15400]),
        formatThousands,
        "Units (thousands)"
      ),
    ];

    const laborIndicators: Indicator[] = [
      buildIndicator(
        "Initial Claims",
        makePlaceholderData(2000, [460, 450, 440, 430, 420, 410, 400, 390, 500, 560, 490, 440, 410, 390, 370, 360, 350, 340, 335, 334, 338, 350, 360, 372, 390]),
        formatThousands,
        "Claims (thousands)"
      ),
      buildIndicator(
        "Unemployment Rate",
        makePlaceholderData(2000, [4.1, 4.2, 4.3, 4.4, 4.5, 4.4, 4.3, 4.2, 5.0, 5.8, 6.0, 5.7, 5.3, 4.9, 4.6, 4.3, 4.0, 3.8, 3.7, 3.6, 4.0, 5.4, 4.7, 3.9, 4.1]),
        formatIndex,
        "Percent"
      ),
      buildIndicator(
        "Payroll Growth",
        makePlaceholderData(2000, [1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.2, 0.8, -1.5, -0.4, 0.8, 1.2, 1.5, 1.8, 2.0, 2.2, 2.3, 2.4, 2.5, -5.0, 3.4, 2.8, 2.0, 1.2]),
        formatIndex,
        "Percent YoY"
      ),
    ];

    return [
      {
        id: "residential",
        name: "Residential",
        weight: 35,
        weightLabel: "Lead indicator",
        interpretation: "Housing activity is the earliest cyclical warning signal and should lead the dashboard.",
        detail:
          "Residential investment is your earliest cyclical lens. Permits, starts, and home sales often weaken before broader labor deterioration.",
        indicators: residentialIndicators ?? [],
      },
      {
        id: "transportation",
        name: "Transportation",
        weight: 20,
        weightLabel: "Capex signal",
        interpretation: "Transportation reflects long-cycle orders, freight activity, and capex sensitivity.",
        detail:
          "Transportation should capture equipment orders, truck demand, and freight activity. This helps confirm cyclical stress beyond housing.",
        indicators: transportationIndicators,
      },
      {
        id: "durable",
        name: "Durable Goods",
        weight: 25,
        weightLabel: "Demand signal",
        interpretation: "Durable goods track discretionary and business demand across the cycle.",
        detail:
          "Durable goods give you a broader read on business hesitation and consumer pullback in big-ticket spending.",
        indicators: durableIndicators,
      },
      {
        id: "labor",
        name: "Labor",
        weight: 20,
        weightLabel: "Confirmation layer",
        interpretation: "Labor should confirm, not lead, the cycle deterioration.",
        detail:
          "Labor is the confirmation layer. It tells you when sector weakness is broadening into recessionary conditions.",
        indicators: laborIndicators,
      },
    ];
  }, [residentialIndicators]);

  const selectedSector = sectors.find((s) => s.id === selectedSectorId) ?? sectors[0];

  useEffect(() => {
    if (selectedSector?.indicators?.length) {
      setSelectedIndicatorName(selectedSector.indicators[0].name);
    }
  }, [selectedSectorId]);

  const selectedIndicator =
    selectedSector?.indicators.find((i) => i.name === selectedIndicatorName) ??
    selectedSector?.indicators[0];

  const weightedScore = useMemo(() => {
    if (!sectors.length) return 0;
    return sectors.reduce((sum, sector) => sum + (sectorScore(sector) * sector.weight) / 100, 0);
  }, [sectors]);

  const diffusion = useMemo(() => {
    if (!sectors.length) return 0;
    return Math.round(
      sectors.reduce((sum, sector) => sum + weakeningShare(sector), 0) / sectors.length
    );
  }, [sectors]);

  const filteredLevelData = selectedIndicator ? filterByLookback(selectedIndicator.data, lookback) : [];
  const filteredRocData = selectedIndicator ? filterByLookback(buildRocTrend(selectedIndicator.data), lookback) : [];

  const levelValues = filteredLevelData.map((d) => d.value);
  const rocValues = filteredRocData.map((d) => d.value);

  const levelAxis = makeAxis(levelValues);
  const rocAxis = makeAxis(rocValues);
  const levelXAxis = makeXAxisLabels(filteredLevelData, 4);
  const rocXAxis = makeXAxisLabels(filteredRocData, 4);

  const lookbackLabel =
    lookback === "2000" ? "Since 2000" :
    lookback === "2008" ? "Since 2008" :
    lookback === "2020" ? "Since 2020" :
    "Full history";

  const warningOn =
    (sectors.find((s) => s.id === "residential") ? sectorScore(sectors.find((s) => s.id === "residential")!) : 0) >= 1 &&
    (sectors.find((s) => s.id === "durable") ? sectorScore(sectors.find((s) => s.id === "durable")!) : 0) >= 1;

  const confirmationOn =
    (sectors.find((s) => s.id === "labor") ? sectorScore(sectors.find((s) => s.id === "labor")!) : 0) >= 1;

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Business Cycle Dashboard
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                EPB-style cycle engine
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Residential is now using real data. The rest of the sectors are back in the app shell so we can convert them one by one without losing the framework.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Weighted score</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{weightedScore.toFixed(2)}</div>
                <div className={`mt-1 text-sm font-medium ${scoreTone(weightedScore)}`}>
                  {scoreLabel(weightedScore)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Diffusion</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{diffusion}%</div>
                <div className="mt-1 text-sm text-slate-600">of tracked signals weakening</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:col-span-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Composite score scale</span>
                <span>0 = expanding · 0.75 = slowing · 1.5+ = contracting</span>
              </div>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-200">
                <div className="flex h-full">
                  <div className="w-[37.5%] bg-green-400" />
                  <div className="w-[37.5%] bg-amber-400" />
                  <div className="w-[25%] bg-red-400" />
                </div>
              </div>
              <div className="relative mt-2 h-6">
                <div
                  className={`absolute top-0 h-6 w-1 rounded-full ${
                    weightedScore < 0.75
                      ? "bg-green-600"
                      : weightedScore < 1.5
                      ? "bg-amber-600"
                      : "bg-red-600"
                  }`}
                  style={{ left: `${Math.min((weightedScore / 2) * 100, 100)}%` }}
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>0.0</span>
                  <span>0.75</span>
                  <span>1.5</span>
                  <span>2.0</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-sm text-slate-500">Cycle signals</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className={`rounded-xl px-3 py-2 ${warningOn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                  Early warning: {warningOn ? "On" : "Off"}
                </div>
                <div className={`rounded-xl px-3 py-2 ${confirmationOn ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                  Labor confirmation: {confirmationOn ? "On" : "Off"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Cycle sequence</h2>
            <div className="text-sm text-slate-500">Ordered from earliest to latest confirmation</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sectors.map((sector, idx) => {
              const score = sectorScore(sector);
              const share = weakeningShare(sector);

              return (
                <button
                  key={sector.id}
                  onClick={() => setSelectedSectorId(sector.id)}
                  className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${cardTone(score)} ${
                    selectedSectorId === sector.id ? "ring-2 ring-slate-400" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Step {idx + 1}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">{sector.name}</h3>
                      <div className="mt-1 text-sm text-slate-500">
                        {sector.weight}% weight · {sector.weightLabel}
                      </div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                      score < 0.75
                        ? "bg-green-100 text-green-800"
                        : score < 1.5
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                      {score.toFixed(1)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className={`font-medium ${scoreTone(score)}`}>{scoreLabel(score)}</span>
                    <span className="text-slate-600">{share}% weakening</span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white/80 p-3 ring-1 ring-white/60">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Sector score band</span>
                      <span>{sector.interpretation.split(".")[0]}</span>
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
                          score < 0.75
                            ? "bg-green-600"
                            : score < 1.5
                            ? "bg-amber-600"
                            : "bg-red-600"
                        }`}
                        style={{ left: `${Math.min((score / 2) * 100, 100)}%` }}
                      />
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>0.0</span>
                        <span>0.75</span>
                        <span>1.5</span>
                        <span>2.0</span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-700">{sector.interpretation}</p>
                </button>
              );
            })}
          </div>
        </div>

        {selectedSector && (
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-slate-500">
                    Selected sector
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {selectedSector.name}
                  </h3>
                  <p className="mt-2 max-w-3xl text-slate-600">{selectedSector.detail}</p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-500">Lookback</label>
                  <select
                    value={lookback}
                    onChange={(e) => setLookback(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="2000">Since 2000</option>
                    <option value="2008">Since 2008</option>
                    <option value="2020">Since 2020</option>
                    <option value="full">Full history</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Sector score</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {sectorScore(selectedSector).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Weight in composite</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{selectedSector.weight}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="text-sm text-slate-500">Signals weakening</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {weakeningShare(selectedSector)}%
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {selectedSector.indicators.map((indicator) => (
                  <button
                    key={indicator.name}
                    onClick={() => setSelectedIndicatorName(indicator.name)}
                    className={`rounded-3xl bg-slate-50 p-4 text-left ring-1 ring-slate-200 ${
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
                      <div className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        {formatPercent(indicator.yoy)}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                        <div className="text-slate-500">YoY</div>
                        <div className="mt-1 font-medium text-slate-800">{formatPercent(indicator.yoy)}</div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
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

              {selectedIndicator && (
                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Level chart</span>
                      <span>{lookbackLabel}</span>
                    </div>
                    <Sparkline
                      values={levelValues}
                      yAxis={levelAxis}
                      xAxis={levelXAxis}
                      title="Indicator scale"
                      tall
                    />
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Rate of change</span>
                      <span>{lookbackLabel}</span>
                    </div>
                    <Sparkline
                      values={rocValues}
                      yAxis={rocAxis}
                      xAxis={rocXAxis}
                      title="Rate-of-change scale"
                      tall
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {selectedIndicator && (
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
              )}

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedSector.name} rules
                </h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  {selectedSector.id === "residential" && (
                    <>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Permits and starts both negative YoY increase early warning risk.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Negative 6-month momentum confirms the slowdown is ongoing.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Residential should carry the highest weight in the composite.
                      </div>
                    </>
                  )}

                  {selectedSector.id === "transportation" && (
                    <>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Orders plus freight weakness indicate capex stress.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Truck sales help confirm cyclical slowdown in transport demand.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Transportation should confirm weakness beyond housing.
                      </div>
                    </>
                  )}

                  {selectedSector.id === "durable" && (
                    <>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Durable goods reflect both business hesitation and household pullback.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        ISM and vehicle sales help confirm broad demand deceleration.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Durable weakness should reinforce residential slowdown.
                      </div>
                    </>
                  )}

                  {selectedSector.id === "labor" && (
                    <>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Labor should confirm the cycle, not lead it.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Claims rising alone is caution; unemployment and payroll deterioration matter more.
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        Labor weakness raises recession confidence after leading sectors turn.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}