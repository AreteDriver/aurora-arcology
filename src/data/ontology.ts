// Default ontology vocabulary — pre-loaded for the EVE domain.
// Editable post-load via the curator UI (spec §5: "data, not code").

export const DEFAULT_NODE_TYPES = [
  { id: "Event",        name: "Event",        color: "#e85d75", description: "Something that happened at a point in time" },
  { id: "Person",       name: "Person",       color: "#f4a261", description: "Named individual" },
  { id: "Organization", name: "Organization", color: "#2a9d8f", description: "Corporation, agency, or formal group" },
  { id: "Faction",      name: "Faction",      color: "#264653", description: "Empire, tribe, or large alignment" },
  { id: "Place",        name: "Place",        color: "#a8dadc", description: "System, region, station, or location" },
  { id: "Phenomenon",   name: "Phenomenon",   color: "#9d4edd", description: "Physical/cosmological/technological phenomenon" },
  { id: "Concept",      name: "Concept",      color: "#6c757d", description: "Abstract construct, framework, or label" },
  { id: "Artifact",     name: "Artifact",     color: "#e9c46a", description: "Object, ship, item, or document" },
] as const;

export const DEFAULT_RELATION_TYPES = [
  { id: "caused-by",       name: "caused-by",       description: "Event → Event | Phenomenon" },
  { id: "descends-from",   name: "descends-from",   description: "Person | Faction → Faction | Phenomenon" },
  { id: "member-of",       name: "member-of",       description: "Person → Organization" },
  { id: "aligned-with",    name: "aligned-with",    description: "Faction → Faction" },
  { id: "opposed-to",      name: "opposed-to",      description: "Faction → Faction" },
  { id: "located-in",      name: "located-in",      description: "Place → Place | Region" },
  { id: "participated-in", name: "participated-in", description: "Person | Organization → Event" },
  { id: "succeeded-by",    name: "succeeded-by",    description: "Person | Concept → Person | Concept" },
  { id: "replaced-by",     name: "replaced-by",     description: "Person | Concept → Person | Concept" },
  { id: "parallels",       name: "parallels",       description: "any → any (soft connection: thematic or structural)" },
  { id: "referenced-in",   name: "referenced-in",   description: "any → Source" },
] as const;
