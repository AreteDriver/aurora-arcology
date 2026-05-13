export const NODE_TYPE_COLOR: Record<string, string> = {
  Event: "#e85d75",
  Person: "#f4a261",
  Organization: "#2a9d8f",
  Faction: "#264653",
  Place: "#a8dadc",
  Phenomenon: "#9d4edd",
  Concept: "#6c757d",
  Artifact: "#e9c46a",
};

const NODE_TYPE_FALLBACK = "#888888";

export function nodeTypeColor(type: string): string {
  return NODE_TYPE_COLOR[type] ?? NODE_TYPE_FALLBACK;
}

function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  if (normalized.length !== 6) return [136, 136, 136];

  const value = parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function readableTextOnColor(hex: string): "#000000" | "#ffffff" {
  const luminance = relativeLuminance(parseHexColor(hex));
  // 0.45 gives better readability on mid-saturation chips in this palette.
  return luminance > 0.45 ? "#000000" : "#ffffff";
}

export function nodeTypeTextColor(type: string): "#000000" | "#ffffff" {
  return readableTextOnColor(nodeTypeColor(type));
}

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
  parallels: "#a78bfa",
  "referenced-in": "#737373",
  // Financial — emerald
  funds: "#10b981",
  "revenue-from": "#059669",
  "launders-through": "#7c2d12",
  "financially-exposed-to": "#ea580c",
  supplies: "#0d9488",
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

export const MATRIX_CONFIDENCE_LEGEND = [
  { label: "<0.5 (tinfoil)", color: "#a1a1aa", upperExclusive: 0.5 },
  { label: "0.5-0.7", color: "#3b82f6", upperExclusive: 0.7 },
  { label: "0.7-0.9", color: "#22c55e", upperExclusive: 0.9 },
  { label: ">= 0.9", color: "#f59e0b", upperExclusive: Number.POSITIVE_INFINITY },
] as const;

export function matrixConfidenceColor(confidence: number): string {
  const band = MATRIX_CONFIDENCE_LEGEND.find((entry) => confidence < entry.upperExclusive);
  return band?.color ?? MATRIX_CONFIDENCE_LEGEND[MATRIX_CONFIDENCE_LEGEND.length - 1].color;
}
