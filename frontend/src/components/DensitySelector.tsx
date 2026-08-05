import type { CardDensity } from "../engine/semanticDensity";
import { useT } from "../i18n";

interface DensitySelectorProps {
  density: CardDensity;
  onChange: (density: CardDensity) => void;
}

const MODES: CardDensity[] = ["normal", "compact", "high"];

export function DensitySelector({ density, onChange }: DensitySelectorProps) {
  const t = useT();

  return (
    <section aria-labelledby="density-heading">
      <h3 id="density-heading" className="rail-section__label">{t("density.label")}</h3>
      <div role="group" aria-label={t("density.label")} className="nc-segmented">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            value={mode}
            aria-pressed={density === mode}
            onClick={() => onChange(mode)}
          >
            {t(`density.${mode}`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-nc-muted" role="status">
        {t(`density.status.${density}`)}
      </p>
    </section>
  );
}
