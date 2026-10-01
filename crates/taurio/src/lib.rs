//! Native setup shared by Agentgate and Wallflower. Ordinary functions, so the
//! app keeps its own `.setup`, state, `.invoke_handler` and capabilities.
//!
//! ```no_run
//! use tauri::Manager;
//! use taurio::BuilderExt;
//!
//! fn builder<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
//!     builder.shared_plugins().setup(|app| {
//!         if let Some(window) = app.get_webview_window("main") {
//!             if let Err(e) = taurio::apply_window_appearance(&window) {
//!                 eprintln!("{e}");
//!             }
//!         }
//!         Ok(())
//!     })
//! }
//! ```

/// Why the window kept an opaque background.
#[cfg(feature = "window")]
#[derive(Debug)]
pub enum WindowError {
    Background(tauri::Error),
    #[cfg(target_os = "macos")]
    Vibrancy(window_vibrancy::Error),
}

#[cfg(feature = "window")]
impl std::fmt::Display for WindowError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Background(e) => write!(f, "could not clear the webview background: {e}"),
            #[cfg(target_os = "macos")]
            Self::Vibrancy(e) => write!(f, "vibrancy unavailable, window stays opaque: {e}"),
        }
    }
}

#[cfg(feature = "window")]
impl std::error::Error for WindowError {}

/// Clears the webview's own background and puts macOS vibrancy behind it, for
/// the frosted sidebar. Without the first step the webview paints opaque white
/// over the blur however transparent the window is, so a failure there stops.
///
/// The Active state keeps the blur when the window loses focus. Does nothing
/// off macOS; there the app paints `--window-bg` (html.tau-no-vibrancy).
#[cfg(feature = "window")]
pub fn apply_window_appearance<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), WindowError> {
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
        window
            .set_background_color(Some(tauri::webview::Color(0, 0, 0, 0)))
            .map_err(WindowError::Background)?;
        apply_vibrancy(
            window,
            NSVisualEffectMaterial::UnderWindowBackground,
            Some(NSVisualEffectState::Active),
            None,
        )
        .map_err(WindowError::Vibrancy)?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = window;
    Ok(())
}

/// Registers the plugins both apps use. Keep the plugin crates as direct
/// dependencies of the app as well: its capabilities name their permissions,
/// and tauri-build only collects permissions from direct dependencies.
#[cfg(feature = "plugins")]
pub trait BuilderExt {
    /// dialog and opener; on desktop also window-state, updater and process.
    /// iOS and Android get updates through their stores.
    fn shared_plugins(self) -> Self;
}

#[cfg(feature = "plugins")]
impl<R: tauri::Runtime> BuilderExt for tauri::Builder<R> {
    fn shared_plugins(self) -> Self {
        let builder = self
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_opener::init());
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        let builder = builder
            .plugin(tauri_plugin_window_state::Builder::default().build())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
        builder
    }
}
