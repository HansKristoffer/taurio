import { beforeEach, expect, mock, test } from "bun:test";
import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { CheckboxRow, Field, SecretField } from "../src/react/index.js";

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<StrictMode>{node}</StrictMode>));
  return container;
}
const settle = () => act(() => Bun.sleep(0));
const button = (root: Element, text: string) =>
  [...root.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement | undefined;
/** React tracks input values itself, so set it the way a keystroke would. */
const type = (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const key = (el: Element, key: string) =>
  act(async () => void el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));

beforeEach(() => {
  document.body.innerHTML = "";
});

/* ---------- Field ---------- */

test("Field labels its control and links the hint", async () => {
  const root = await render(
    <Field label="Daemon address" hint="Your Tailscale node">
      <input name="url" />
    </Field>,
  );
  const input = root.querySelector("input")!;
  const label = root.querySelector("label")!;
  expect(input.id).not.toBe("");
  expect(label.htmlFor).toBe(input.id);
  const hint = root.querySelector(`#${CSS.escape(input.getAttribute("aria-describedby")!)}`)!;
  expect(hint.textContent).toBe("Your Tailscale node");
  expect(hint.className).toBe("tau-hint");
  expect(input.hasAttribute("aria-invalid")).toBe(false);
});

test("Field shows an error in place of the hint and marks the control invalid", async () => {
  const root = await render(
    <Field label="Token" hint="From the other machine" error="Token rejected">
      <input id="token" aria-describedby="extra" />
    </Field>,
  );
  const input = root.querySelector("input")!;
  expect(input.id).toBe("token");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe("extra token-message");
  expect(root.querySelector(".tau-error")?.textContent).toBe("Token rejected");
  expect(root.querySelector(".tau-hint")).toBeNull();
});

/* ---------- CheckboxRow ---------- */

test("checkbox rows sharing a name form a checklist", async () => {
  const changed = mock();
  const root = await render(
    <form>
      <CheckboxRow label="github" name="server" value="github" defaultChecked />
      <CheckboxRow label="linear" name="server" value="linear" />
      <CheckboxRow label="sentry" description="Errors" name="server" value="sentry" defaultChecked onChange={changed} />
    </form>,
  );
  expect(new FormData(root.querySelector("form")!).getAll("server")).toEqual(["github", "sentry"]);
  const last = root.querySelectorAll("input")[2]!;
  expect(last.closest("label")?.textContent).toBe("sentryErrors");
  await act(async () => last.click());
  expect(changed).toHaveBeenCalledWith(false);
});

/* ---------- SecretField ---------- */

function secret({ has = false, verify }: { has?: boolean; verify?(v: string): Promise<string | null> } = {}) {
  const store = { save: mock(async (_value: string) => {}), onSaved: mock() };
  const node = (
    <SecretField
      label="API key"
      hint="Paste your key"
      savedLabel="Saved in your Keychain"
      load={async () => has}
      save={store.save}
      verify={verify}
      onSaved={store.onSaved}
    />
  );
  return { store, node };
}

test("an empty secret asks for a value; Enter verifies and saves it", async () => {
  const verify = mock(async (v: string) => (v === "bad" ? "That key was refused" : null));
  const { store, node } = secret({ verify });
  const root = await render(node);
  await settle();
  const input = root.querySelector('input[type="password"]') as HTMLInputElement;
  expect(root.querySelector("small")?.textContent).toBe("Paste your key");
  expect(button(root, "Save")?.disabled).toBe(true);

  await type(input, "bad");
  await key(input, "Enter");
  await settle();
  expect(store.save).not.toHaveBeenCalled();
  expect(root.querySelector(".tau-error")?.textContent).toBe("That key was refused");
  expect(input.getAttribute("aria-invalid")).toBe("true");

  await type(input, "  good  ");
  expect(root.querySelector(".tau-error")).toBeNull();
  await key(input, "Enter");
  await settle();
  expect(store.save).toHaveBeenCalledWith("good");
  expect(store.onSaved).toHaveBeenCalledTimes(1);
  expect(root.querySelector(".tau-ok")?.textContent).toBe("Saved in your Keychain");
  expect(root.querySelector("input")).toBeNull();
});

test("a saved secret can be changed, and Escape cancels the change", async () => {
  const { store, node } = secret({ has: true });
  const root = await render(node);
  await settle();
  expect(root.querySelector("input")).toBeNull();

  await act(async () => button(root, "Change")!.click());
  const input = root.querySelector("input") as HTMLInputElement;
  await type(input, "new");
  await key(input, "Escape");
  expect(root.querySelector("input")).toBeNull();
  expect(root.querySelector(".tau-ok")).not.toBeNull();

  await act(async () => button(root, "Change")!.click());
  await type(root.querySelector("input")!, "new");
  await act(async () => button(root, "Save")!.click());
  await settle();
  expect(store.save).toHaveBeenCalledWith("new");
});

test("a failed load is shown, and the field still takes a value", async () => {
  const root = await render(
    <SecretField
      label="API key"
      load={async () => {
        throw new Error("Keychain locked");
      }}
      save={async () => {}}
    />,
  );
  await settle();
  expect(root.querySelector(".tau-error")?.textContent).toBe("Keychain locked");
  expect(root.querySelector("input")).not.toBeNull();
});
