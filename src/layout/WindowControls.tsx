import { useEffect, useRef, useState } from "react";
import {
  currentMonitor,
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

const TOLERANCE_PX = 6;

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

async function isFilledToWorkArea(): Promise<boolean> {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();
  if (monitor == null) return win.isMaximized();

  const [pos, size] = await Promise.all([win.outerPosition(), win.outerSize()]);
  const work = monitor.workArea;
  return (
    Math.abs(pos.x - work.position.x) <= TOLERANCE_PX &&
    Math.abs(pos.y - work.position.y) <= TOLERANCE_PX &&
    Math.abs(size.width - work.size.width) <= TOLERANCE_PX &&
    Math.abs(size.height - work.size.height) <= TOLERANCE_PX
  );
}

/** Fill the monitor work area (excludes taskbar/docks). */
async function fillWorkArea(): Promise<void> {
  const win = getCurrentWindow();
  const monitor = await currentMonitor();
  if (monitor == null) {
    await win.maximize();
    return;
  }

  const scale = monitor.scaleFactor;
  const { position, size } = monitor.workArea;
  await win.setPosition(
    new LogicalPosition(position.x / scale, position.y / scale),
  );
  await win.setSize(
    new LogicalSize(size.width / scale, size.height / scale),
  );
}

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const restoreBoundsRef = useRef<WindowBounds | null>(null);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function syncMaximized() {
      const next = await isFilledToWorkArea();
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
        unlisten = fn;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  async function handleToggleMaximize() {
    const win = getCurrentWindow();
    if (await isFilledToWorkArea()) {
      const restore = restoreBoundsRef.current;
      if (restore) {
        await win.setPosition(new LogicalPosition(restore.x, restore.y));
        await win.setSize(new LogicalSize(restore.width, restore.height));
      } else if (await win.isMaximized()) {
        await win.unmaximize();
      } else {
        await win.setSize(new LogicalSize(1200, 800));
        await win.center();
      }
      setMaximized(false);
    } else {
      restoreBoundsRef.current = await readBounds();
      await fillWorkArea();
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
