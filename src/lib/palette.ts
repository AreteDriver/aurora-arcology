const NODE_TYPE_COLOR: Record<string, string> = {
  Event: "#e85d75",
  Person: "#f4a261",
  Organization: "#2a9d8f",
  Faction: "#264653",
  Place: "#a8dadc",
  Phenomenon: "#9d4edd",
  Concept: "#6c757d",
  Artifact: "#e9c46a",
};

const FALLBACK = "#888888";

export function nodeTypeColor(type: string): string {
  return NODE_TYPE_COLOR[type] ?? FALLBACK;
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
