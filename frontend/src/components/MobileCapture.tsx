import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

export type MobileCaptureResult = "empty" | "success" | "failed";

export async function submitMobileCapture(
  input: string,
  onCapture: (input: string) => Promise<void>,
): Promise<MobileCaptureResult> {
  if (!input.trim()) return "empty";

  try {
    await onCapture(input);
    return "success";
  } catch {
    return "failed";
  }
}

interface MobileCaptureProps {
  onCapture: (input: string) => Promise<void>;
  onBack?: () => void;
  backLabel?: string;
}

export function MobileCapture({ onCapture, onBack, backLabel }: MobileCaptureProps) {
  const t = useT();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const submittedInput = input;
    setError(null);
    setStatus(null);
    if (!submittedInput.trim() || submitting) return;
    setSubmitting(true);
    const result = await submitMobileCapture(submittedInput, onCapture);
    setSubmitting(false);
    if (result === "success") {
      setInput((current) => (current === submittedInput ? "" : current));
      setStatus(t("mobile.capture.success"));
    } else if (result === "failed") {
      setError(t("mobile.capture.failed"));
    }
  };

  return (
    <section className="mobile-capture" aria-label={t("mobile.capture.label")}>
      <form
        className="mobile-capture__form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="mobile-capture-input">{t("mobile.capture.input")}</label>
        <p className="mobile-capture__hint">{t("mobile.capture.hint")}</p>
        <input
          ref={inputRef}
          id="mobile-capture-input"
          className="mobile-capture__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("mobile.capture.placeholder")}
        />
        <button type="submit" className="mobile-capture__submit" disabled={submitting} aria-busy={submitting}>
          {t(submitting ? "mobile.capture.submitting" : "mobile.capture.submit")}
        </button>
      </form>
      {onBack && <button type="button" className="mobile-capture__back" onClick={onBack} aria-label={backLabel ?? t("mobile.command.back")}>{backLabel ?? t("mobile.command.back")}</button>}
      {error && <p role="alert">{error}</p>}
      <p className="mobile-capture__status" aria-live="polite">{status}</p>
    </section>
  );
}
