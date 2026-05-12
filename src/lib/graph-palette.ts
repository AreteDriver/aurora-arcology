export const RELATION_COLOR: Record<string, string> = {
  // Causal / temporal — red family
  "caused-by": "#dc2626",
  "succeeded-by": "#b91c1c",
  "replaced-by": "#b91c1c",
  "descends-from": "#991b1b",
  // Alliance / membership — blue family
  "aligned-with": "#3b82f6",
  "member-of": "#2563eb",
  "participated-in": "#1d4ed8",
  // Opposition — amber
  "opposed-to": "#f59e0b",
  // Spatial — green
  "located-in": "#16a34a",
  // Soft / parallel — violet / gray
  "parallels": "#a78bfa",
  "referenced-in": "#737373",
  // Financial — emerald
  "funds": "#10b981",
  "revenue-from": "#059669",
  "launders-through": "#7c2d12",
  "financially-exposed-to": "#ea580c",
  "supplies": "#0d9488",
};

const RELATION_FALLBACK = "#52525b";

export function relationColor(relationType: string): string {
  return RELATION_COLOR[relationType] ?? RELATION_FALLBACK;
}

export const RELATION_LEGEND: Array<{ label: string; color: string }> = [
  { label: "causal / temporal", color: "#dc2626" },
  { label: "alliance / membership", color: "#3b82f6" },
  { label: "opposition", color: "#f59e0b" },
  { label: "spatial", color: "#16a34a" },
  { label: "parallels", color: "#a78bfa" },
  { label: "financial", color: "#10b981" },
];

export const ARC_LINE_COLOR: Record<string, string> = {
  "warpath-current": "#dc2626",
  "lai-dai-vs-ishukone": "#2563eb",
  "old-wars": "#a16207",
  "drifter-arc": "#7c3aed",
  exordium: "#0891b2",
  "kahah-yc120": "#be123c",
  "deathless-arc": "#171717",
  "empyrean-age": "#ea580c",
  "intaki-religious-arc": "#16a34a",
  "amarr-royal-succession": "#ca8a04",
  "pirate-factions": "#475569",
  "caldari-mega-corp-axis": "#0d9488",
  "sarpati-network": "#9333ea",
};

const ARC_LINE_FALLBACK = "#888888";

export function arcLineColor(lensId: string): string {
  return ARC_LINE_COLOR[lensId] ?? ARC_LINE_FALLBACK;
}
