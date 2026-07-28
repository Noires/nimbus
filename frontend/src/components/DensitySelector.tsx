import type { CardDensity } from "../engine/semanticDensity";
import { useT } from "../i18n";

interface DensitySelectorProps {
  density: CardDensity;
  onChange: (density: CardDensity) => void;
}

export function DensitySelector({ density, onChange }: DensitySelectorProps) {
  const t = useT();

  return (
    <section className="border-b border-white/10 px-4 py-3" aria-labelledby="density-heading">
      <label id="density-heading" className="block text-xs font-semibold uppercase tracking-wider text-cyan-200" htmlFor="card-density">
        {t("density.label")}
      </label>
      <select
        id="card-density"
        value={density}
        onChange={(event) => onChange(event.target.value as CardDensity)}
        aria-label={t("density.label")}
        className="mt-2 w-full rounded border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-white focus:border-cyan-300 focus:outline-none"
      >
        <option value="normal">{t("density.normal")}</option>
        <option value="compact">{t("density.compact")}</option>
        <option value="high">{t("density.high")}</option>
      </select>
      <p className="mt-2 text-xs leading-5 text-gray-400" role="status">
        {t(`density.status.${density}`)}
      </p>
    </section>
  );
}
