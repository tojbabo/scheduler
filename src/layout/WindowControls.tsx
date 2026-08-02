import { useEffect, useRef, useState } from "react";
import {
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";

type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function readBounds(): Promise<WindowBounds> {
  const win = getCurrentWindow();
  const [pos, size, scale] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    win.scaleFactor(),
  ]);
  return {
    x: pos.x / scale,
    y: pos.y / scale,
    width: size.width / scale,
    height: size.height / scale,
  };
}

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const restoreBoundsRef = useRef<WindowBounds | null>(null);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlistenResize: (() => void) | undefined;
    let cancelled = false;

    async function syncMaximized() {
      const next = await win.isFullscreen();
      if (!cancelled) setMaximized(next);
    }

    void syncMaximized();
    void win
      .onResized(() => {
        void syncMaximized();
      })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlistenResize = fn;
      });

    return () => {
      cancelled = true;
      unlistenResize?.();
    };
  }, []);

  async function handleToggleMaximize() {
    const win = getCurrentWindow();
    if (await win.isFullscreen()) {
      await win.setFullscreen(false);
      const restore = restoreBoundsRef.current;
      if (restore) {
        await win.setPosition(new LogicalPosition(restore.x, restore.y));
        await win.setSize(new LogicalSize(restore.width, restore.height));
      } else {
        await win.setSize(new LogicalSize(1200, 800));
        await win.center();
      }
      setMaximized(false);
    } else {
      restoreBoundsRef.current = await readBounds();
      // Borderless size-to-monitor still leaves the Windows taskbar on top;
      // fullscreen is what actually hides it.
      await win.setFullscreen(true);
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
        onClick={() => void handleToggleMaximize()}
        aria-label={maxLabel}
        title={maxLabel}
      />
      <button
        type="button"
        className="window-close"
        onClick={() => void handleClose()}
        aria-label="종료"
        title="종료"
      />
    </div>
  );
}
