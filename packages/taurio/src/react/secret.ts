import { useEffect, useRef, useState } from "react";

import { messageOf } from "../runtime/errors.js";

/**
 * The flow behind an API-key field, without its UI. Once a value is saved the
 * field reads as saved, with a way to change it, rather than a field of dots
 * that looks as if it still wants something. Storage is the app's: `load` says
 * whether a value exists, `save` stores one. Render it with HeroUI:
 * `showInput` decides between the saved state and a TextField whose value,
 * error and Save button come from here.
 */
export function useSecretEntry({
  load,
  save,
  verify,
  onSaved,
}: {
  load(): Promise<boolean>;
  save(value: string): Promise<void>;
  /** Resolves to an error message, or null when the value works. */
  verify?(value: string): Promise<string | null>;
  onSaved?(): void | Promise<void>;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValueState] = useState("");
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

  /** Verifies, then saves the trimmed value. Ignored while empty or already checking. */
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
      setValueState("");
      setError("");
      await onSaved?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setChecking(false);
    }
  }

  return {
    /** Null until `load` answers. */
    saved,
    /** A field to type in: nothing is saved yet, or Change was pressed. */
    showInput: saved === false || editing,
    /** Whether Cancel makes sense: there is a saved value to go back to. */
    canCancel: saved === true && editing,
    value,
    /** Typing clears the last error. */
    setValue(next: string) {
      setValueState(next);
      setError("");
    },
    error,
    checking,
    submit,
    edit: () => setEditing(true),
    cancel() {
      setEditing(false);
      setValueState("");
      setError("");
    },
  };
}
