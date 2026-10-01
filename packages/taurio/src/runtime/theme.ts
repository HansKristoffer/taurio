/**
 * Keeps the `dark` class on <html> in step with the system appearance. HeroUI
 * switches themes on that class (or data-theme), never on the media query,
 * while a desktop app should look the way macOS or Windows is set. Call it
 * before the first render so the app does not flash light. Returns the stop
 * function.
 */
export function followSystemTheme(root: HTMLElement = document.documentElement): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => root.classList.toggle("dark", query.matches);
  apply();
  query.addEventListener("change", apply);
  return () => query.removeEventListener("change", apply);
}
