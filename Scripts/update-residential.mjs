import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// ensure fetch exists (Node 18+ has it; this is just a safety net)
const fetchFn = globalThis.fetch ?? (await import("node-fetch")).default;

const series = [
  { id: "HOUST", file: "housing-starts.csv" },
  { id: "PERMIT", file: "building-permits.csv" },
  { id: "HSN1F", file: "new-home-sales.csv" },
];

const outDir = path.join(process.cwd(), "public", "data");

async function downloadSeries(id, file) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
  const res = await fetchFn(url);

  if (!res.ok) {
    throw new Error(`Failed to download ${id}: ${res.status}`);
  }

  const csv = await res.text();
  await writeFile(path.join(outDir, file), csv, "utf8");
  console.log(`Saved ${file}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const s of series) {
    await downloadSeries(s.id, s.file);
  }

  console.log("Residential data updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});