import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowCloseButton() {
  async function handleClose() {
    await getCurrentWindow().close();
  }

  return (
    <button
      type="button"
      className="window-close"
      onClick={handleClose}
      aria-label="종료"
      title="종료"
    />
  );
}
