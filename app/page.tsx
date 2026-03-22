// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

type FredPoint = {
  date: string;
  value: number;
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

function formatMillions(value: number) {
  return (value / 1000).toFixed(3) + "M";
}

export default function Page() {
  const [permits, setPermits] = useState<FredPoint[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await loadFredCsv("building-permits.csv");
        console.log("Permits loaded:", data[data.length - 1]);
        setPermits(data);
      } catch (err) {
        console.error("Load failed:", err);
      }
    }
    load();
  }, []);

  const latest = permits?.[permits.length - 1]?.value;

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Residential Data Test</h1>

      <p>
        Data loaded: <strong>{permits ? "YES" : "NO"}</strong>
      </p>

      <p>
        Latest permits raw value:{" "}
        <strong>{latest ?? "loading..."}</strong>
      </p>

      <p>
        Latest permits formatted:{" "}
        <strong>{latest ? formatMillions(latest) : "loading..."}</strong>
      </p>

      <p style={{ marginTop: 20, color: "#666" }}>
        Expected example: 1376 → 1.376M
      </p>
    </div>
  );
}