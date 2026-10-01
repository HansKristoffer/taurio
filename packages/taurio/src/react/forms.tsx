import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

import { messageOf } from "../runtime/errors.js";
import { cx } from "./settings.js";

type Control = ReactElement<{
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}>;

/**
 * A stacked form field: label, the one control passed as children, then a hint
 * or, when there is one, the error in its place. The control gets an id (unless
 * it has one), is described by the hint or error, and is marked invalid while
 * `error` is set, so a screen reader announces both.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: Control;
}) {
  const generated = useId();
  if (!isValidElement(children)) throw new Error("Field takes exactly one control element");
  const id = children.props.id ?? generated;
  const message = error || hint;
  const messageId = message ? `${id}-message` : undefined;
  return (
    <div className={cx("tau-field", className)}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby": cx(children.props["aria-describedby"], messageId) || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })}
      {message && (
        <small id={messageId} className={error ? "tau-error" : "tau-hint"}>
          {message}
        </small>
      )}
    </div>
  );
}

/**
 * A checkbox row for a SettingsGroup: the box first, then the label. A group of
 * them sharing a `name` is a checklist that FormData reads with getAll().
 * `children` go at the end of the row.
 */
export function CheckboxRow({
  label,
  description,
  className,
  onChange,
  children,
  ...input
}: {
  label: ReactNode;
  description?: ReactNode;
  className?: string;
  onChange?(checked: boolean): void;
  children?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "className" | "children">) {
  return (
    <label className={cx("tau-row", "tau-check", className)}>
      <input {...input} type="checkbox" onChange={onChange && ((e) => onChange(e.target.checked))} />
      <span className="tau-row-label">
        {label}
        {description && <small>{description}</small>}
      </span>
      {children}
    </label>
  );
}

/**
 * A secret such as an API key, as a settings row. Once one is saved it reads as
 * saved, with a Change button, rather than a field of dots that looks as if it
 * still wants something. Storage is the app's: `load` says whether a value
 * exists, `save` stores one. Remount it (React `key`) to load again.
 */
export function SecretField({
  label,
  hint,
  placeholder,
  savedLabel = "Saved",
  load,
  save,
  verify,
  onSaved,
  autoFocus,
}: {
  label: ReactNode;
  /** Shown while nothing is saved. */
  hint?: ReactNode;
  placeholder?: string;
  savedLabel?: ReactNode;
  load(): Promise<boolean>;
  save(value: string): Promise<void>;
  /** Resolves to an error message, or null when the value works. */
  verify?(value: string): Promise<string | null>;
  onSaved?(): void | Promise<void>;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    let live = true;
    loader.current().then(
      (has) => live && setSaved(has),
      (e: unknown) => {
        if (!live) return;
        setSaved(false);
        setError(messageOf(e));
      },
    );
    return () => {
      live = false;
    };
  }, []);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    try {
      const problem = await verify?.(trimmed);
      if (problem) throw new Error(problem);
      await save(trimmed);
      setSaved(true);
      setEditing(false);
      setValue("");
      setError("");
      await onSaved?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setChecking(false);
    }
  }

  function cancel() {
    setEditing(false);
    setValue("");
    setError("");
  }

  const showSaved = saved === true && !editing;
  const status = error || (showSaved ? savedLabel : hint);
  const statusId = `${id}-status`;

  return (
    <div className="tau-row stack">
      <div className="tau-inline">
        <label className="tau-row-label" htmlFor={id}>
          {label}
          <small id={statusId} className={error ? "tau-error" : showSaved ? "tau-ok" : undefined} aria-live="polite">
            {status}
          </small>
        </label>
        {showSaved && (
          <button type="button" className="tau-button" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </div>
      {(saved === false || editing) && (
        <div className="tau-inline">
          <input
            id={id}
            type="password"
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            autoFocus={autoFocus || editing}
            aria-describedby={status ? statusId : undefined}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Inside a form, Enter would submit it too.
                e.preventDefault();
                void submit();
              }
              if (e.key === "Escape" && saved) cancel();
            }}
          />
          <button
            type="button"
            className="tau-button primary"
            disabled={!value.trim() || checking}
            onClick={() => void submit()}
          >
            {checking ? "Checking…" : "Save"}
          </button>
          {saved && (
            <button type="button" className="tau-button" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
