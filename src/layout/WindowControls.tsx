import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function syncMaximized() {
      const next = await win.isMaximized();
      if (!cancelled) setMaximized(next);
    }

    void syncMaximized();
    void win.onResized(() => {
      void syncMaximized();
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  async function handleToggleMaximize() {
    const win = getCurrentWindow();
    if (await win.isMaximized()) {
      await win.unmaximize();
      setMaximized(false);
    } else {
      await win.maximize();
      setMaximized(true);
    }
  }

  async function handleClose() {
    await getCurrentWindow().close();
  }

  const maxLabel = maximized ? "창 크기 복원" : "최대화";

  return (
    <div className="window-controls">
      <button
        type="button"
        className={`window-max${maximized ? " window-max--maximized" : ""}`}
        onClick={handleToggleMaximize}
        aria-label={maxLabel}
        title={maxLabel}
      />
      <button
        type="button"
        className="window-close"
        onClick={handleClose}
        aria-label="종료"
        title="종료"
      />
    </div>
  );
}
