// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type FredPoint = {
  date: string;
  value: number;
};

type RealIndicator = {
  name: string;
  value: string;
  yoy: string;
  sixMonth: string;
  note: string;
  unit: string;
  scaleLabel: string;
  yAxis: number[];
  rocAxis: number[];
  xAxis: string[];
  longXAxis: string[];
  trend: number[];
  rocTrend: number[];
  longTrend: number[];
  weakening: boolean;
};

async function loadFredCsv(fileName: string): Promise<FredPoint[]> {
  const res = await fetch(`/data/${fileName}`);
  const text = await res.text();

  const lines = text.trim().split("\n").slice(1);

  return lines
    .map((line) => {
      const [date, raw] = line.split(",");
      const value = Number(raw);
      return { date, value };
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

function lastNValues(data: FredPoint[], n: number): number[] {
  return data.slice(-n).map((d) => d.value);
}

function yearlyAxisLabels(data: FredPoint[]): string[] {
  if (data.length === 0) return [];
  const dates = data.map((d) => d.date);
  const first = dates[0].slice(0, 4);
  const mid = dates[Math.floor(dates.length / 2)].slice(0, 4);
  const last = dates[dates.length - 1].slice(0, 4);
  return [first, mid, last];
}

function longAxisLabels(data: FredPoint[]): string[] {
  if (data.length === 0) return [];
  const dates = data.map((d) => d.date);
  const first = dates[0].slice(0, 4);
  const oneThird = dates[Math.floor(dates.length / 3)].slice(0, 4);
  const twoThirds = dates[Math.floor((2 * dates.length) / 3)].slice(0, 4);
  const last = dates[dates.length - 1].slice(0, 4);
  return [first, oneThird, twoThirds, last];
}

function makeAxis(values: number[]): number[] {
  if (!values.length) return [0, 0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  return [Number(min.toFixed(1)), Number(mid.toFixed(1)), Number(max.toFixed(1))];
}

function formatMillions(value: number): string {
  return `${(value / 1000).toFixed(2)}M`;
}

function formatThousands(value: number): string {
  return `${Math.round(value)}k`;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function indicatorNote(yoy: number, momentum: number): string {
  if (yoy < 0 && momentum < 0) return "Broad weakening";
  if (yoy < 0 && momentum >= 0) return "Weak but stabilizing";
  if (yoy >= 0 && momentum < 0) return "Positive but losing momentum";
  return "Still expanding";
}

function buildResidentialIndicator(
  name: string,
  data: FredPoint[],
  formatter: (v: number) => string,
  unit: string
): RealIndicator {
  const latest = latestValue(data);
  const yoy = yoyChange(data);
  const sixMonth = sixMonthMomentum(data);

  const longTrend = lastNValues(data, data.length);
  const trend = lastNValues(data, Math.min(12, data.length));

  const rocTrend = data.slice(-12).map((_, idx, arr) => {
    const sourceIndex = data.length - arr.length + idx;
    if (sourceIndex < 12) return 0;
    return Number(
      pctChange(data[sourceIndex].value, data[sourceIndex - 12].value).toFixed(1)
    );
  });

  return {
    name,
    value: formatter(latest),
    yoy: formatPercent(yoy),
    sixMonth: formatPercent(sixMonth),
    note: indicatorNote(yoy, sixMonth),
    unit,
    scaleLabel: "Indicator scale",
    yAxis: makeAxis(longTrend),
    rocAxis: makeAxis(rocTrend),
    xAxis: yearlyAxisLabels(data),
    longXAxis: longAxisLabels(data),
    trend,
    rocTrend,
    longTrend,
    weakening: yoy < 0 || sixMonth < 0,
  };
}

function scoreFromIndicator(indicator: RealIndicator): number {
  const yoy = Number(indicator.yoy.replace("%", ""));
  const sixMonth = Number(indicator.sixMonth.replace("%", ""));

  if (yoy > 5 && sixMonth > 0) return 0;
  if (yoy < 0 && sixMonth < 0) return 2;
  return 1;
}

function Sparkline({
  values,
  yAxis,
  xAxis,
  tall = false,
  longLookback = false,
  scaleLabel = "Indicator scale",
}: {
  values: number[];
  yAxis: number[];
  xAxis: string[];
  tall?: boolean;
  longLookback?: boolean;
  scaleLabel?: string;
}) {
  const width = 360;
  const height = tall ? 190 : 108;
  const leftPad = 42;
  const rightPad = 12;
  const topPad = 18;
  const bottomPad = 28;

  if (!values.length) {
    return <div className={tall ? "h-48" : "h-28"} />;
  }

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
    <svg viewBox={`0 0 ${width} ${height}`} className={tall ? "h-48 w-full" : "h-28 w-full"}>
      <text x={leftPad} y={10} fontSize="10" className="fill-slate-500">
        {scaleLabel}
      </text>
      <line
        x1={leftPad}
        y1={topPad}
        x2={leftPad}
        y2={height - bottomPad}
        stroke="currentColor"
        className="text-slate-300"
      />
      <line
        x1={leftPad}
        y1={height - bottomPad}
        x2={width - rightPad}
        y2={height - bottomPad}
        stroke="currentColor"
        className="text-slate-300"
      />

      {yAxis.map((label, idx) => {
        const y = topPad + (idx / Math.max(yAxis.length - 1, 1)) * innerHeight;
        return (
          <g key={`y-${label}`}>
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
          <text key={`x-${label}`} x={x - 12} y={height - 6} fontSize="10" className="fill-slate-500">
            {label}
          </text>
        );
      })}

      <polyline fill="none" stroke="currentColor" strokeWidth="3" points={points} className="text-slate-700" />
      {longLookback ? (
        <text x={width - 118} y={10} fontSize="10" className="fill-slate-500">
          Lookback: 2000 to present
        </text>
      ) : null}
    </svg>
  );
}

export default function BusinessCycleDashboard() {
  const [selectedId, setSelectedId] = useState("residential");
  const [residentialIndicators, setResidentialIndicators] = useState<RealIndicator[] | null>(null);

  useEffect(() => {
    async function loadResidential() {
      const [housingStarts, buildingPermits, newHomeSales] = await Promise.all([
        loadFredCsv("housing-starts.csv"),
        loadFredCsv("building-permits.csv"),
        loadFredCsv("new-home-sales.csv"),
      ]);

      const realResidential = [
        buildResidentialIndicator("Housing Starts", housingStarts, formatMillions, "Starts (thousands)"),
        buildResidentialIndicator("Building Permits", buildingPermits, formatMillions, "Permits (thousands)"),
        buildResidentialIndicator("New Home Sales", newHomeSales, formatThousands, "Sales (thousands)"),
      ];

      setResidentialIndicators(realResidential);
    }

    loadResidential();
  }, []);

  const sectors = [
    {
      id: "residential",
      name: "Residential",
      score: residentialIndicators
        ? residentialIndicators.reduce((sum, i) => sum + scoreFromIndicator(i), 0) / residentialIndicators.length
        : 1.2,
      trendDirection: residentialIndicators
        ? residentialIndicators.some((i) => Number(i.sixMonth.replace("%", "")) < 0)
          ? "Down"
          : "Flat"
        : "Down",
      weight: 35,
      weakeningShare: residentialIndicators
        ? Math.round(
            (residentialIndicators.filter((i) => i.weakening).length / residentialIndicators.length) * 100
          )
        : 67,
      weightLabel: "Lead indicator",
      interpretation: "Housing activity is softening before broader labor deterioration.",
      detail:
        "Residential investment is your earliest cyclical lens. When permits and starts weaken together, it often signals that tighter financial conditions are already biting.",
      indicators:
        residentialIndicators ??
        [
          {
            name: "Housing Starts",
            value: "1.36M",
            yoy: "-7.4%",
            sixMonth: "-4.2%",
            note: "Multi-month downtrend",
            unit: "Starts (thousands)",
            scaleLabel: "Indicator scale",
            yAxis: [70, 80, 90],
            rocAxis: [-10, -5, 0],
            xAxis: ["2024", "2025", "2026"],
            longXAxis: ["2000", "2008", "2016", "2024"],
            trend: [92, 95, 94, 91, 88, 85, 83, 80, 78, 76, 74, 72],
            rocTrend: [2, 3, 1, -1, -2, -4, -5, -6, -7, -7, -7, -7],
            longTrend: [76, 79, 82, 86, 90, 93, 88, 84, 72, 66, 58, 52, 55, 60, 63, 67, 71, 75, 78, 80, 82, 84, 86, 83, 80, 77, 74],
            weakening: true,
          },
          {
            name: "Building Permits",
            value: "1.42M",
            yoy: "-5.1%",
            sixMonth: "-3.0%",
            note: "Weak but stabilizing",
            unit: "Permits (thousands)",
            scaleLabel: "Indicator scale",
            yAxis: [72, 82, 92],
            rocAxis: [-8, -4, 0],
            xAxis: ["2024", "2025", "2026"],
            longXAxis: ["2000", "2008", "2016", "2024"],
            trend: [90, 93, 92, 90, 87, 84, 82, 81, 79, 77, 75, 74],
            rocTrend: [1, 2, 1, 0, -1, -2, -3, -4, -5, -5, -5, -5],
            longTrend: [78, 81, 84, 88, 91, 94, 90, 85, 74, 67, 61, 58, 60, 64, 68, 71, 74, 77, 79, 81, 83, 85, 86, 84, 82, 79, 76],
            weakening: true,
          },
          {
            name: "New Home Sales",
            value: "670k",
            yoy: "-6.0%",
            sixMonth: "-2.6%",
            note: "Demand is cooling",
            unit: "Sales (thousands)",
            scaleLabel: "Indicator scale",
            yAxis: [60, 70, 80],
            rocAxis: [-8, -4, 0],
            xAxis: ["2024", "2025", "2026"],
            longXAxis: ["2000", "2008", "2016", "2024"],
            trend: [79, 80, 81, 80, 78, 77, 75, 74, 73, 71, 70, 68],
            rocTrend: [2, 2, 1, 0, -1, -2, -3, -4, -5, -6, -6, -6],
            longTrend: [70, 72, 74, 77, 80, 83, 78, 72, 60, 52, 46, 44, 46, 50, 54, 58, 62, 65, 68, 70, 72, 74, 75, 73, 71, 69, 67],
            weakening: true,
          },
        ],
      rules: [
        "Permits and starts both negative YoY",
        "Residential score above 1.0",
        "If home sales also weaken, early warning strengthens",
      ],
    },
    {
      id: "durable",
      name: "Durable Goods",
      score: 1.0,
      trendDirection: "Down",
      weight: 25,
      weakeningShare: 67,
      weightLabel: "Demand signal",
      interpretation: "Orders are flattening, suggesting softer business and consumer demand.",
      detail:
        "Durable goods give you a broad read on discretionary demand. This section should capture both business hesitation and consumer pullback in big-ticket spending.",
      indicators: [
        {
          name: "Core Durable Orders",
          value: "+1.8% YoY",
          yoy: "+1.8%",
          sixMonth: "-1.2%",
          note: "Losing momentum",
          unit: "Index level",
          scaleLabel: "Indicator scale",
          yAxis: [58, 63, 68],
          rocAxis: [-2, 0, 2],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [60, 61, 63, 65, 66, 64, 63, 62, 61, 60, 59, 58],
          rocTrend: [4, 4, 3, 3, 2, 2, 1, 1, 0, 0, -1, -1],
          longTrend: [44, 45, 46, 47, 49, 51, 53, 55, 50, 47, 46, 48, 50, 52, 54, 56, 58, 60, 61, 62, 63, 64, 65, 63, 61, 60, 58],
        },
        {
          name: "ISM New Orders",
          value: "49.6",
          yoy: "-2.0 pts",
          sixMonth: "-1.4 pts",
          note: "Near contraction line",
          unit: "Diffusion index",
          scaleLabel: "Indicator scale",
          yAxis: [45, 55, 65],
          rocAxis: [-6, -3, 0],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [70, 72, 69, 67, 65, 62, 60, 58, 57, 55, 53, 50],
          rocTrend: [2, 1, 1, 0, -1, -2, -2, -3, -3, -4, -5, -5],
          longTrend: [58, 60, 61, 63, 65, 67, 63, 58, 44, 40, 47, 51, 54, 56, 58, 60, 62, 61, 60, 59, 58, 57, 55, 53, 52, 51, 50],
        },
        {
          name: "Light Vehicle Sales",
          value: "15.4M SAAR",
          yoy: "-3.3%",
          sixMonth: "-1.0%",
          note: "Household demand softening",
          unit: "Millions SAAR",
          scaleLabel: "Indicator scale",
          yAxis: [14, 15, 16],
          rocAxis: [-4, -2, 0],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [16, 16, 15.9, 15.8, 15.8, 15.7, 15.7, 15.6, 15.6, 15.5, 15.5, 15.4],
          rocTrend: [1, 1, 1, 0, 0, 0, -1, -1, -2, -2, -3, -3],
          longTrend: [17.1, 17.0, 16.9, 16.8, 16.7, 16.6, 16.2, 15.6, 13.1, 10.8, 11.6, 12.4, 13.2, 14.0, 14.7, 15.4, 16.0, 16.7, 17.0, 16.9, 16.6, 16.3, 16.0, 15.8, 15.7, 15.6, 15.4],
        },
      ],
      rules: [
        "ISM below 50 raises caution",
        "Two of three demand indicators weakening lifts score",
        "Broad consumer softness confirms durable weakness",
      ],
    },
    {
      id: "transportation",
      name: "Transportation",
      score: 1.4,
      trendDirection: "Down",
      weight: 20,
      weakeningShare: 100,
      weightLabel: "Capex signal",
      interpretation: "Transport equipment is weakening, consistent with delayed capital spending.",
      detail:
        "Transportation should be a fuller sector, not a single line item. It reflects long-cycle orders, freight activity, and capital-spending caution.",
      indicators: [
        {
          name: "Transport Equipment Orders",
          value: "-3.2% YoY",
          yoy: "-3.2%",
          sixMonth: "-2.4%",
          note: "Order softness broadening",
          unit: "Index level",
          scaleLabel: "Indicator scale",
          yAxis: [58, 68, 78],
          rocAxis: [-4, -2, 0],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [78, 80, 79, 77, 75, 73, 70, 69, 67, 65, 63, 61],
          rocTrend: [1, 1, 1, 0, -1, -1, -2, -2, -3, -3, -3, -3],
          longTrend: [49, 51, 53, 56, 60, 64, 68, 71, 58, 48, 52, 57, 60, 63, 66, 68, 70, 73, 75, 77, 78, 79, 77, 74, 70, 66, 61],
        },
        {
          name: "Heavy Truck Sales",
          value: "395k",
          yoy: "-8.1%",
          sixMonth: "-3.8%",
          note: "Fleet demand slowing",
          unit: "Units (thousands)",
          scaleLabel: "Indicator scale",
          yAxis: [36, 40, 44],
          rocAxis: [-8, -4, 0],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [44, 44, 43, 43, 42, 41, 41, 40, 40, 39, 38, 37],
          rocTrend: [0, 0, -1, -1, -2, -2, -3, -4, -5, -6, -7, -8],
          longTrend: [32, 33, 35, 37, 39, 41, 43, 45, 36, 28, 29, 31, 34, 36, 38, 40, 42, 44, 45, 46, 45, 44, 43, 42, 40, 39, 37],
        },
        {
          name: "Freight Volume Proxy",
          value: "-4.4% YoY",
          yoy: "-4.4%",
          sixMonth: "-2.9%",
          note: "Shipping demand easing",
          unit: "Index level",
          scaleLabel: "Indicator scale",
          yAxis: [70, 76, 82],
          rocAxis: [-6, -3, 0],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [82, 81, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72],
          rocTrend: [0, 0, 0, -1, -1, -2, -2, -3, -3, -4, -4, -4],
          longTrend: [61, 62, 63, 65, 67, 69, 71, 73, 64, 58, 60, 63, 66, 68, 70, 72, 74, 76, 78, 80, 81, 82, 80, 78, 76, 74, 72],
        },
      ],
      rules: [
        "Orders plus freight both negative indicates capex stress",
        "Truck weakness adds cyclical confirmation",
        "Three-way deterioration lifts transportation above 1.25",
      ],
    },
    {
      id: "labor",
      name: "Labor",
      score: 0.8,
      trendDirection: "Flat",
      weight: 20,
      weakeningShare: 33,
      weightLabel: "Confirmation layer",
      interpretation: "Labor remains firmer than housing, but stress is worth watching for confirmation.",
      detail:
        "Labor is your confirmation layer. It should not lead the dashboard, but it should tell you when sector weakness is broadening into recessionary conditions.",
      indicators: [
        {
          name: "Initial Claims",
          value: "228k",
          yoy: "+4.6%",
          sixMonth: "+1.2%",
          note: "Still contained",
          unit: "Claims (thousands)",
          scaleLabel: "Indicator scale",
          yAxis: [34, 38, 42],
          rocAxis: [0, 3, 6],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [40, 39, 38, 38, 37, 36, 35, 35, 36, 37, 38, 39],
          rocTrend: [6, 5, 4, 4, 3, 3, 2, 2, 2, 3, 4, 5],
          longTrend: [46, 45, 44, 43, 42, 41, 40, 39, 50, 56, 49, 44, 41, 39, 37, 36, 35, 34, 33, 33, 34, 35, 36, 37, 38, 39, 40],
        },
        {
          name: "Unemployment Rate",
          value: "4.1%",
          yoy: "+0.3 pts",
          sixMonth: "+0.1 pts",
          note: "Slight drift higher",
          unit: "Percent",
          scaleLabel: "Indicator scale",
          yAxis: [30, 32, 34],
          rocAxis: [0, 0.2, 0.4],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [32, 32, 31, 31, 30, 30, 30, 31, 31, 32, 32, 33],
          rocTrend: [0.1, 0.1, 0.1, 0, 0, 0, 0, 0.1, 0.1, 0.2, 0.2, 0.3],
          longTrend: [41, 42, 43, 44, 45, 44, 43, 42, 50, 57, 60, 57, 53, 49, 46, 43, 40, 38, 37, 36, 40, 54, 47, 39, 38, 39, 41],
        },
        {
          name: "Payroll Growth",
          value: "+1.2% YoY",
          yoy: "+1.2%",
          sixMonth: "-0.8%",
          note: "Still positive but slower",
          unit: "Percent YoY",
          scaleLabel: "Indicator scale",
          yAxis: [1, 2, 3],
          rocAxis: [-1, 0, 1],
          xAxis: ["2024", "2025", "2026"],
          longXAxis: ["2000", "2008", "2016", "2024"],
          trend: [3, 3, 2.9, 2.8, 2.7, 2.5, 2.3, 2.1, 1.9, 1.7, 1.5, 1.2],
          rocTrend: [1, 1, 0.8, 0.7, 0.6, 0.4, 0.2, 0.1, 0, -0.2, -0.5, -0.8],
          longTrend: [1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.2, 0.8, -1.5, -0.4, 0.8, 1.2, 1.5, 1.8, 2.0, 2.2, 2.3, 2.4, 2.5, -5.0, 3.4, 2.8, 2.2, 1.9, 1.6, 1.2],
        },
      ],
      rules: [
        "Claims rising alone is caution, not confirmation",
        "Unemployment plus payroll slowing signals broad deterioration",
        "Labor score over 1.0 raises recession probability",
      ],
    },
  ];

  const selected = useMemo(() => sectors.find((s) => s.id === selectedId) || sectors[0], [selectedId]);

  const weightedScore = sectors.reduce((sum, s) => sum + (s.score * s.weight) / 100, 0);
  const diffusion = Math.round(sectors.reduce((sum, s) => sum + s.weakeningShare, 0) / sectors.length);

  const residentialScore = sectors.find((s) => s.id === "residential")?.score ?? 0;
  const durableScore = sectors.find((s) => s.id === "durable")?.score ?? 0;
  const laborScore = sectors.find((s) => s.id === "labor")?.score ?? 0;

  const warningOn = residentialScore >= 1 && durableScore >= 1;
  const confirmationOn = laborScore >= 1;

  function cyclePhase(score: number) {
    if (score < 0.75) return "Expanding";
    if (score < 1.15) return "Slowing";
    if (score < 1.5) return "Late-cycle";
    return "Contracting";
  }

  function cardTone(score: number) {
    if (score < 1) return "bg-green-50 border-green-200";
    if (score < 1.5) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  }

  function badgeTone(score: number) {
    if (score < 1) return "bg-green-100 text-green-800";
    if (score < 1.5) return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  }

  function phaseTone(label: string) {
    if (label === "Expanding") return "text-green-700";
    if (label === "Slowing" || label === "Late-cycle") return "text-amber-700";
    return "text-red-700";
  }

  function scoreBarTone(value: number) {
    if (value < 0.75) return "bg-green-500";
    if (value < 1.5) return "bg-amber-500";
    return "bg-red-500";
  }

  function sectorBandTone(score: number) {
    if (score < 0.75) return "text-green-700";
    if (score < 1.5) return "text-amber-700";
    return "text-red-700";
  }

  function sectorBandLabel(score: number) {
    if (score < 0.75) return "Expanding";
    if (score < 1.5) return "Slowing";
    return "Contracting";
  }

  function trendIcon(direction: string) {
    if (direction === "Down") return "↓";
    if (direction === "Up") return "↑";
    return "→";
  }

  function trendLabel(direction: string) {
    if (direction === "Down") return "Deteriorating";
    if (direction === "Up") return "Improving";
    return "Flat";
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Business Cycle Dashboard
              </div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">EPB-style cycle engine — REAL RESIDENTIAL TEST</h1>
<p className="mt-2 max-w-2xl text-slate-600">
  Main screen emphasizes sequencing, breadth, and rate of change. Click any sector to open the deeper view with long-lookback charts and momentum lines.
</p>
<p className="mt-2 text-sm font-medium text-red-600">
  Residential data loaded: {residentialIndicators ? "YES" : "NO"}
</p>
                Main screen emphasizes sequencing, breadth, and rate of change. Click any sector to open the deeper view with long-lookback charts and momentum lines.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Weighted score</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{weightedScore.toFixed(2)}</div>
                <div className={`mt-1 text-sm font-medium ${phaseTone(cyclePhase(weightedScore))}`}>
                  {cyclePhase(weightedScore)}
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
                  className={`absolute top-0 h-6 w-1 rounded-full ${scoreBarTone(weightedScore)}`}
                  style={{ left: `${Math.min((weightedScore / 2) * 100, 100)}%` }}
                />
                <div className="flex justify-between text-xs text-slate-500">
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
            {sectors.map((sector, idx) => (
              <button
                key={sector.id}
                onClick={() => setSelectedId(sector.id)}
                className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${cardTone(sector.score)} ${selectedId === sector.id ? "ring-2 ring-slate-400" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Step {idx + 1}</div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{sector.name}</h3>
                    <div className="mt-1 text-sm text-slate-500">
                      {sector.weight}% weight · {sector.weightLabel}
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-sm font-medium ${badgeTone(sector.score)}`}>
                    {sector.score.toFixed(1)}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className={`font-medium ${sectorBandTone(sector.score)}`}>{sectorBandLabel(sector.score)}</span>
                  <span className="text-slate-600">
                    {trendIcon(sector.trendDirection)} {trendLabel(sector.trendDirection)}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-white/80 p-3 ring-1 ring-white/60">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Sector score band</span>
                    <span>{sector.weakeningShare}% weakening</span>
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
                        sector.score < 0.75 ? "bg-green-600" : sector.score < 1.5 ? "bg-amber-600" : "bg-red-600"
                      }`}
                      style={{ left: `${Math.min((sector.score / 2) * 100, 100)}%` }}
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
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Selected sector</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selected.name}</h3>
                <p className="mt-2 max-w-3xl text-slate-600">{selected.detail}</p>
              </div>
              <div className={`rounded-full px-4 py-2 text-sm font-medium ${badgeTone(selected.score)}`}>
                Sector score {selected.score.toFixed(1)}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Sector trend</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">
                  {trendIcon(selected.trendDirection)} {trendLabel(selected.trendDirection)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Weight in composite</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{selected.weight}%</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-sm text-slate-500">Signals weakening</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{selected.weakeningShare}%</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {selected.indicators.map((indicator) => (
                <div key={indicator.name} className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{indicator.name}</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{indicator.value}</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      {indicator.yoy}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{indicator.note}</span>
                    <span>{indicator.unit}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                      <div className="text-slate-500">YoY</div>
                      <div className="mt-1 font-medium text-slate-800">{indicator.yoy}</div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                      <div className="text-slate-500">6M momentum</div>
                      <div className="mt-1 font-medium text-slate-800">{indicator.sixMonth}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <Sparkline
                      values={indicator.longTrend}
                      yAxis={indicator.yAxis}
                      xAxis={indicator.longXAxis}
                      tall
                      longLookback
                      scaleLabel={indicator.scaleLabel}
                    />
                  </div>
                  <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Rate of change</span>
                      <span>YoY / momentum view</span>
                    </div>
                    <Sparkline
                      values={indicator.rocTrend}
                      yAxis={indicator.rocAxis}
                      xAxis={indicator.xAxis}
                      scaleLabel="Rate-of-change scale"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Scoring logic for {selected.name}</h3>
              <div className="mt-4 space-y-3">
                {selected.rules.map((rule) => (
                  <div key={rule} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                    {rule}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Recommended app additions</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  Weight housing more heavily than later-cycle sectors in the composite score.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  Track diffusion so you can see how much weakness is broadening across the dashboard.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  Show level charts and separate rate-of-change charts because turning points often appear in momentum first.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  Keep the main screen focused on sequence: Residential → Durable → Transportation → Labor.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}