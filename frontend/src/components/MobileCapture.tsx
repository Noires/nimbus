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
}

export function MobileCapture({ onCapture }: MobileCaptureProps) {
  const t = useT();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const submittedInput = input;
    setError(null);
    void submitMobileCapture(submittedInput, onCapture).then((result) => {
      if (result === "success") {
        setInput((current) => (current === submittedInput ? "" : current));
      } else if (result === "failed") {
        setError(t("mobile.capture.failed"));
      }
    });
  };

  return (
    <section className="mobile-capture" aria-label={t("mobile.capture.label")}>
      <form
        className="mobile-capture__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="mobile-capture-input">{t("mobile.capture.input")}</label>
        <input
          ref={inputRef}
          id="mobile-capture-input"
          className="mobile-capture__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("mobile.capture.placeholder")}
        />
        <button type="submit" className="mobile-capture__submit">{t("mobile.capture.submit")}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
