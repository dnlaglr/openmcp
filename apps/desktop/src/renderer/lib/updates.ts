export const RELEASES_URL = "https://github.com/dnlaglr/openmcp/releases";
export const REPOSITORY_URL = "https://github.com/dnlaglr/openmcp";

// The overlay is CSS-driven so any button can trigger it without shared state.
export function restartToUpdate() {
  document.documentElement.dataset.restarting = "";
  void window.api.invoke("updater:install");
}
