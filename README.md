# taurio

Shared Tauri 2 helpers for Agentgate and Wallflower: the updater lifecycle,
toasts, the sidebar-and-card shell, settings controls, the theme, and native
window setup. Phase 1 of the extraction plan: only what both apps use today.

```text
packages/taurio/   @hanskristoffer/taurio   TypeScript, React and CSS
crates/taurio/     taurio                   Rust: window appearance, plugin registration
examples/minimal/  every export on one screen, used as the consumer compile check
```

Product names, updater endpoints, public keys, CSP, capabilities and
entitlements stay in each app.

## TypeScript

```ts
import "@hanskristoffer/taurio/base.css";   // element defaults, opt-in
import "@hanskristoffer/taurio/styles.css";  // tokens + components (or tokens.css / components.css)
import { checkForUpdate, watchForUpdates } from "@hanskristoffer/taurio/runtime"; // no React
import { useAppUpdate, UpdateToast, useToasts, Toasts, AppShell /* … */ } from "@hanskristoffer/taurio/react";
```

Peers: `react@^19` (only for `/react`), `@tauri-apps/api@^2`,
`@tauri-apps/plugin-updater@^2`, `@tauri-apps/plugin-process@^2`. The package
ships built JavaScript and declarations; checked against TypeScript 5.9, 6.0 and
7.0.

| Export | What it does |
| --- | --- |
| `checkForUpdate()` | `Update \| null`. Concurrent calls share one request. `update.install()` downloads, installs and relaunches; repeat calls share one attempt, a failed one can be retried. |
| `watchForUpdates(found, { interval, onError })` | Checks now and every 4 h; returns the stop function. Nothing is reported after stop. |
| `useAppUpdate({ enabled, onError })` | `{ update, installing, check, install, dismiss }`. One offer per version, the pending update kept until installed, one install at a time. `check()` offers a found update immediately. |
| `UpdateToast`, `UpdateCheckButton`, `useAppVersion` | The offer as a toast (render it inside `Toasts`), the "Check for updates" link, the running version. |
| `useToasts({ timeout })`, `Toasts`, `ToastCard` | Confirmations fade after `timeout` (default 4000); errors and toasts with an action stay. Errors are `role="alert"`. |
| `AppShell`, `useAppShortcuts` | Sidebar + titlebar row + inset card with drag regions; Cmd (Apple) / Ctrl (elsewhere) shortcuts. |
| `SettingsGroup`, `SettingsRow`, `SwitchRow`, `NumberSelect`, `Segmented`, `Badge`, `EmptyState` | System Settings–style rows. Rows work controlled or as uncontrolled form fields (`as="label"`, `name`). `Segmented` is a radio group with arrow/Home/End keys. |
| `Field`, `CheckboxRow`, `SecretField` | `Field` stacks label, control, then hint or error, and wires the id, `aria-describedby` and `aria-invalid`. `CheckboxRow`s sharing a `name` are a checklist (`FormData.getAll`). `SecretField` is an API-key row: saved / Change / verify, with the app's own `load` and `save`. |
| `messageOf(e)` (`/runtime`) | A thrown value as text. |

Fields are native elements. `base.css` styles them, including focus (accent
border and ring), read-only, disabled, `aria-invalid`, checkboxes, and 16 px
text on touch screens so iOS does not zoom on focus. Modifiers: `tau-small`
(dense rows, on buttons, inputs and selects), `tau-mono`, and `tau-inline` for a
field and its button on one line. No custom select or date picker: the native
ones already match macOS.

Component classes are `tau-` prefixed (`tau-button primary|quiet|danger`,
`tau-link-btn`, `tau-switch`, `tau-row`, …). Colour tokens keep their existing
unprefixed names (`--card`, `--fg`, `--side-row`, …) so app CSS keeps working.
`html.tau-no-vibrancy` paints `--window-bg` where nothing paints behind the
window.

### Per-app settings

Agentgate's values are the defaults. Wallflower overrides:

```css
:root {
  --tau-sidebar-width: 300px; --tau-sidebar-shrink: 1; --tau-sidebar-min-width: 200px;
  --tau-card-min-width: 200px;
  --tau-control-height: 32px; --tau-control-font-size: 14px;
  --tau-field-height: 36px; --tau-field-font-size: 14px;
  --tau-row-min-height: 48px;
  --tau-group-title-size: 12px; --tau-group-title-color: var(--fg-2);
  --tau-toast-right: 16px; --tau-toast-bottom: 76px; /* clear of the record bar */
}
html.ios { --tau-titlebar-left: 12px; }
@media (pointer: coarse) { :root { --tau-titlebar-btn: 44px; } }
```

```ts
const toasts = useToasts({ timeout: 3000 });
// KeyField → SecretField; select.compact → className="tau-small"
<SecretField label="Anthropic API key" savedLabel="✓ Saved in your Keychain"
  load={async () => Boolean((await secretGet(ANTHROPIC))?.trim())}
  save={(v) => secretSet(ANTHROPIC, v)} verify={verifyAnthropic} />
const updater = useAppUpdate({ enabled: !IS_IOS, onError: (e) => void warn(`Update check failed: ${e}`) });
// main.tsx: classList.add("tau-no-vibrancy") instead of "no-vibrancy"
```

Agentgate: `useAppUpdate({ enabled: native })`, and `push(String(e), "err")`
replaces the `Error:` prefix convention.

## Rust

```toml
taurio = { git = "https://github.com/HansKristoffer/taurio", tag = "v0.1.0", features = ["window", "plugins"] }
```

```rust
use taurio::BuilderExt;

tauri::Builder::default()
    .shared_plugins() // dialog, opener; desktop: window-state, updater, process
    .setup(|app| {
        if let Some(window) = app.get_webview_window("main") {
            if let Err(e) = taurio::apply_window_appearance(&window) {
                log::warn!("{e}");
            }
        }
        Ok(())
    })
```

No default features. `window` is a no-op off macOS; `plugins` gates the
desktop-only plugins on the target OS, so iOS builds without them. The app
keeps tauri's `macos-private-api` feature, and keeps the plugin crates as
direct dependencies: tauri-build reads plugin permissions for capabilities from
direct dependencies only.

## Development

```sh
bun install
bun run check   # build, typecheck (package + example), tests, example build, clippy (macOS + iOS sim), doc test
```

During migration, consume with local paths (`file:../taurio/packages/taurio`,
`path = "../taurio/crates/taurio"`); after that, an exact npm version and a
git `tag`, never a branch.

## Releasing

release-please keeps a release PR open from Conventional Commits on `main`
(`feat:` bumps the minor version while below 1.0, `fix:` the patch). Merging it
bumps the npm package and the crate to the same version, tags `vX.Y.Z` and
creates the GitHub release; the release workflow then publishes
`@hanskristoffer/taurio` to npm. The tag is the Rust release.

Needs an `NPM_TOKEN` repository secret (an npm automation or granular token
that can publish `@hanskristoffer/*`). Release PRs opened with the default
`GITHUB_TOKEN` do not trigger the check workflow; the checks run again on the
merge to `main`.
