# taurio

The Tauri 2 app kit for Agentgate and Wallflower, to use alongside
[HeroUI](https://heroui.com). HeroUI provides every control: buttons, fields,
switches, modals, menus, popovers, toasts. taurio covers what HeroUI cannot:
the Tauri runtime (updates, native dialogs, the system appearance), the
vibrancy app shell, a macOS theme for HeroUI, and the native setup in Rust.

```text
packages/taurio/   @hanskristoffer/taurio   TypeScript, React hooks and CSS
crates/taurio/     taurio                   Rust: window appearance, plugin registration
examples/minimal/  a HeroUI app on taurio, used as the consumer compile check
```

Product names, updater endpoints, public keys, CSP, capabilities and
entitlements stay in each app.

## Setup with HeroUI

HeroUI v3 needs Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`) and
`@heroui/react` + `@heroui/styles`. Then, in the app's CSS entry:

```css
@import "tailwindcss";
@import "@heroui/styles";
@import "@hanskristoffer/taurio/styles.css"; /* after HeroUI: theme.css + shell.css */
```

and before the first render:

```ts
import { followSystemTheme } from "@hanskristoffer/taurio/runtime";
followSystemTheme(); // HeroUI switches on the `dark` class; this follows macOS
```

Peers: `@tauri-apps/api@^2`, `@tauri-apps/plugin-dialog@^2`,
`@tauri-apps/plugin-updater@^2`, `@tauri-apps/plugin-process@^2`, `react@^19`
(only for `/react`) and `@heroui/styles@^3.2` (only for the theme). The package
ships built JavaScript and declarations, checked against TypeScript 5.9, 6.0 and
7.0. Pin HeroUI to an exact version in the apps: it ships monthly minors, and
3.2.5 renamed `Text` to `Typography` in a patch release.

## What is here

| Export | What it does |
| --- | --- |
| `checkForUpdate()` (`/runtime`) | `Update \| null`. Concurrent calls share one request. `update.install()` downloads, installs and relaunches; repeat calls share one attempt, a failed one can be retried. |
| `watchForUpdates(found, { interval, onError })` (`/runtime`) | Checks now and every 4 h; returns the stop function. Nothing is reported after stop. |
| `useAppUpdate({ enabled, onError })` | `{ update, installing, status, check, install, dismiss }`. One offer per version, the pending update kept until installed, one install at a time. `check()` offers a found update immediately; `status` is `idle`, `checking`, `latest` or `failed` for a "Check for updates" button. |
| `useAppVersion()` | The running app's version. |
| `confirmDialog(message, { destructive, okLabel })` (`/runtime`) | The native macOS sheet through the dialog plugin (needs `dialog:allow-ask`); `window.confirm` outside Tauri. |
| `followSystemTheme()` (`/runtime`) | Keeps HeroUI's `dark` class in step with the system appearance. |
| `messageOf(e)` (`/runtime`) | A thrown value as text. |
| `AppShell`, `useAppShortcuts` | Frosted sidebar, titlebar row and inset card with Tauri drag regions; Cmd (Apple) / Ctrl (elsewhere) shortcuts. |
| `useSecretEntry({ load, save, verify })` | The API-key flow without UI: saved / Change / verify / cancel. Render it with HeroUI's `TextField` and `Button`. |
| `theme.css` | HeroUI's variables set to the macOS palette both apps share, light and dark: hairline field borders, 7 px radius, system blue accent. |
| `shell.css` | Transparent window for vibrancy, the shell layout, and the `--tau-*` tokens. Inside the sidebar, HeroUI's field and default colours are re-scoped, so a HeroUI `SearchField` or `Button` placed there turns frosted. `html.tau-no-vibrancy` paints the window where nothing paints behind it. |

### The update offer

HeroUI's toast is imperative, so the offer is a few lines in the app:

```tsx
const updater = useAppUpdate({ enabled: !IS_IOS });
useEffect(() => {
  if (!updater.update) return;
  const id = toast(`Wallflower ${updater.update.version} is ready.`, {
    timeout: 0,
    onClose: updater.dismiss,
    actionProps: {
      children: "Restart to install",
      onPress: () => void updater.install().catch((e) => toast.danger(messageOf(e))),
    },
  });
  return () => toast.close(id);
}, [updater.update, updater.install, updater.dismiss]);
```

### Per-app settings

Shell dimensions are `--tau-*` variables on `:root`. Agentgate's values are the
defaults; Wallflower overrides:

```css
:root {
  --tau-sidebar-width: 300px; --tau-sidebar-shrink: 1; --tau-sidebar-min-width: 200px;
  --tau-card-min-width: 200px;
}
html.ios { --tau-titlebar-left: 12px; }
```

## Rust

```toml
taurio = { version = "0.1", features = ["window", "plugins"] }
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
bun run check   # build, typecheck (package + HeroUI example), tests, example build, clippy (macOS + iOS sim), doc test
```

During migration, consume with local paths (`file:../taurio/packages/taurio`,
`path = "../taurio/crates/taurio"`); after that, the published versions from
npm and crates.io.

## Releasing

release-please keeps a release PR open from Conventional Commits on `main`
(`feat:` bumps the minor version while below 1.0, `fix:` the patch). Merging it
bumps the npm package and the crate to the same version, tags `vX.Y.Z` and
creates the GitHub release. The release workflow then publishes
`@hanskristoffer/taurio` to npm and `taurio` to crates.io; both steps skip a
version that is already published, so a failed run can be rerun.

Repository secrets:

- `NPM_TOKEN`: an npm granular token that can publish `@hanskristoffer/*`.
- `CARGO_REGISTRY_TOKEN`: a crates.io API token with the `publish-new` and
  `publish-update` scopes.

Release PRs opened with the default `GITHUB_TOKEN` do not trigger the check
workflow; the checks run again on the merge to `main`.

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or
[MIT license](LICENSE-MIT), at your option.
