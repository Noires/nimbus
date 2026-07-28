export type CardDensity = "normal" | "compact" | "high";
export type SemanticLod = "full" | "chip" | "dot";
export type MetadataDisclosure = "full" | "summary" | "essential";

export interface SemanticDensity {
  lod: SemanticLod;
  scale: number;
  disclose: MetadataDisclosure;
  titleVisible: boolean;
}

/**
 * Presentation-only density policy. World coordinates, hit targets, and camera
 * transforms stay unchanged; consumers only choose which card details to show.
 */
export function resolveSemanticDensity(density: CardDensity, zoom: number): SemanticDensity {
  const lod: SemanticLod = zoom < 0.22 ? "dot" : zoom < 0.42 ? "chip" : "full";
  const densitySettings = {
    normal: { scale: 1, disclose: "full" as const },
    compact: { scale: 0.9, disclose: "summary" as const },
    high: { scale: 0.8, disclose: "essential" as const },
  }[density];

  const disclose: MetadataDisclosure = lod === "dot" ? "essential" : lod === "chip" ? "summary" : densitySettings.disclose;

  return {
    lod,
    ...densitySettings,
    disclose,
    titleVisible: true,
  };
}
