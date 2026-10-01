import { useRef, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";

export const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

/** A titled group of rows, in the manner of System Settings. */
export function SettingsGroup({
  title,
  detail,
  action,
  foot,
  className,
  children,
}: {
  title?: ReactNode;
  detail?: ReactNode;
  /** Beside the title, e.g. an Add button. */
  action?: ReactNode;
  foot?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("tau-section", className)}>
      {(title || action) && (
        <div className="tau-section-head">
          <div>
            {title && <h2>{title}</h2>}
            {detail && <p>{detail}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="tau-group">{children}</div>
      {foot && <p className="tau-group-foot">{foot}</p>}
    </section>
  );
}

/**
 * A label with at most a line of help on the left, the control (children) on
 * the right. `as="label"` makes the whole row the label of a control inside it,
 * for uncontrolled form inputs; `htmlFor` labels a control by id instead.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  as: Tag = "div",
  stack = false,
  className,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  as?: "div" | "label";
  /** The control on its own line below the label. */
  stack?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const text = (
    <>
      {label}
      {description && <small>{description}</small>}
    </>
  );
  return (
    <Tag className={cx("tau-row", stack && "stack", className)}>
      {htmlFor ? (
        <label className="tau-row-label" htmlFor={htmlFor}>
          {text}
        </label>
      ) : (
        <span className="tau-row-label">{text}</span>
      )}
      {children}
    </Tag>
  );
}

/** A switch row. Controlled with `checked`, or a form field with `name` and `defaultChecked`. */
export function SwitchRow({
  label,
  description,
  className,
  onChange,
  ...input
}: {
  label: ReactNode;
  description?: ReactNode;
  className?: string;
  onChange?(checked: boolean): void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "role" | "className">) {
  return (
    <SettingsRow as="label" label={label} description={description} className={className}>
      <input
        {...input}
        type="checkbox"
        role="switch"
        className="tau-switch"
        onChange={onChange && ((e) => onChange(e.target.checked))}
      />
    </SettingsRow>
  );
}

/** A choice of a few sensible numbers, instead of a free number field. */
export function NumberSelect({
  value,
  options,
  onChange,
  ...select
}: {
  value: number;
  options: [number, string][];
  onChange(value: number): void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  return (
    <select {...select} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function Badge({ tone, children }: { tone?: "good"; children: ReactNode }) {
  return <span className={cx("tau-badge", tone)}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="tau-empty">{children}</div>;
}

/**
 * A pill switch whose thumb slides to the chosen option. The thumb is one
 * pseudo-element placed from --tau-index and --tau-count, so changing option is
 * a single CSS transition. A radio group: arrow keys, Home and End move the
 * selection, and only the selected option is in the tab order.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  // The option type comes from `value` alone, so a literal options array does
  // not widen it to string and a typed state setter still fits `onChange`.
  options: { id: NoInfer<T>; label: ReactNode }[];
  value: T;
  onChange(id: NoInfer<T>): void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const last = options.length - 1;
  const onKeyDown = (e: KeyboardEvent) => {
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[e.key];
    const option = next === undefined ? undefined : options[next];
    if (!option) return;
    e.preventDefault();
    onChange(option.id);
    buttons.current[next!]?.focus();
  };
  return (
    <div
      className={cx("tau-segmented", className)}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ "--tau-count": options.length, "--tau-index": index } as CSSProperties}
    >
      {options.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === index}
          tabIndex={i === index ? 0 : -1}
          className={i === index ? "active" : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
