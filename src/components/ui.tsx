/**
 * 共通UI部品・フック (旧来のクラス名・属性を維持し style.css をそのまま使う)。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function Icon({ name }: { name: string }): React.JSX.Element {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}

export function Chip({ label, filled }: { label: string; filled?: boolean }): React.JSX.Element {
  return <span className={filled ? "chip chip--fill" : "chip"}>{label}</span>;
}

/** app-bar の is-elevated 切替 (旧 scroll リスナと等価)。 */
export function useElevatedAppBar(): React.RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onScroll = (): void => {
      ref.current?.classList.toggle("is-elevated", window.scrollY > 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return ref;
}

export interface ToastMessage {
  id: number;
  text: string;
}

export function useToast(durationMs = 2200): {
  toast: ToastMessage | null;
  showToast: (text: string) => void;
} {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | null>(null);
  const idRef = useRef(0);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const showToast = useCallback(
    (text: string) => {
      idRef.current += 1;
      setToast({ id: idRef.current, text });
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );
  return { toast, showToast };
}

export function ToastView({ toast }: { toast: ToastMessage | null }): React.JSX.Element {
  return (
    <div className={toast ? "toast is-shown" : "toast"} role="status">
      {toast && (
        <>
          <Icon name="check_circle" />
          <span>{toast.text}</span>
        </>
      )}
    </div>
  );
}

/** クリップボードコピー (Clipboard API優先・textareaフォールバック)。成否を返す。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* フォールバックへ */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function AppBar({
  title,
  subtitle,
  backHref,
  headline,
  themeToggle,
  headerRef,
}: {
  title?: string;
  subtitle?: string;
  backHref?: string;
  headline?: string;
  themeToggle: ReactNode;
  headerRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  return (
    <header className="app-bar" data-role="app-bar" ref={headerRef}>
      {backHref && (
        <button
          type="button"
          className="icon-btn"
          aria-label="一覧に戻る"
          onClick={() => {
            window.location.href = backHref;
          }}
        >
          <Icon name="arrow_back" />
        </button>
      )}
      <div className="app-bar__title-area">
        {headline !== undefined ? (
          <div className="app-bar__headline">{headline}</div>
        ) : (
          <>
            <div className="app-bar__title">{title}</div>
            {subtitle && <div className="app-bar__subtitle hide-sm">{subtitle}</div>}
          </>
        )}
        {headline !== undefined && subtitle && (
          <div className="app-bar__subtitle hide-sm">{subtitle}</div>
        )}
      </div>
      <div className="app-bar__actions">{themeToggle}</div>
    </header>
  );
}

export function ThemeToggleButton({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}): React.JSX.Element {
  const dark = theme === "dark";
  const label = dark ? "ライトモードに切り替え" : "ダークモードに切り替え";
  return (
    <button
      type="button"
      className="icon-btn"
      data-theme-toggle
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <span className="material-symbols-outlined" data-theme-icon>
        {dark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
