import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  fetchWindowsLocation,
  readLocationAllowed,
  writeLocationAllowed,
} from "../bridge/location";
import { PageLayout } from "../layout/PageLayout";

export function Settings() {
  const [autoStart, setAutoStart] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      setLocationLoading(true);
      try {
        await fetchWindowsLocation();
        if (!cancelled) setError(null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Windows 위치를 가져오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    }

    async function load() {
      const allowed = readLocationAllowed();
      try {
        const enabled = await isEnabled();
        if (!cancelled) {
          setAutoStart(enabled);
          setLocationAllowed(allowed);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setLocationAllowed(allowed);
          setError("자동 시작 설정을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled && allowed) {
        await loadLocation();
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAutoStartToggle(next: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setAutoStart(await isEnabled());
    } catch {
      setError(
        next
          ? "자동 시작을 켜지 못했습니다."
          : "자동 시작을 끄지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLocationToggle(next: boolean) {
    setSaving(true);
    setError(null);
    writeLocationAllowed(next);
    setLocationAllowed(next);

    if (!next) {
      setLocationLoading(false);
      setSaving(false);
      return;
    }

    setLocationLoading(true);
    try {
      await fetchWindowsLocation();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Windows 위치를 가져오지 못했습니다.",
      );
    } finally {
      setLocationLoading(false);
      setSaving(false);
    }
  }

  return (
    <PageLayout eyebrow="Settings" title="설정">
      {loading ? (
        <p className="page__status">불러오는 중…</p>
      ) : (
        <div className="settings">
          {error ? <p className="page__status page__status--error">{error}</p> : null}

          <label className="settings-row">
            <span className="settings-row__text">
              <span className="settings-row__title">Windows 시작 시 자동 실행</span>
              <span className="settings-row__desc">
                PC에 로그인하면 Scheduler를 자동으로 실행합니다.
              </span>
            </span>
            <input
              type="checkbox"
              className="settings-toggle"
              role="switch"
              checked={autoStart}
              disabled={saving}
              aria-checked={autoStart}
              aria-label="Windows 시작 시 자동 실행"
              onChange={(e) => void handleAutoStartToggle(e.target.checked)}
            />
          </label>

          <label className="settings-row">
            <span className="settings-row__text">
              <span className="settings-row__title">Windows 위치 사용</span>
              <span className="settings-row__desc">
                <span>날씨 등에 쓰기 위해 PC의 Windows 위치 정보를 가져옵니다.</span>
                <span>
                  Windows 설정 &gt; 개인 정보 보호 &gt; 위치가 켜져 있어야 합니다.
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              className="settings-toggle"
              role="switch"
              checked={locationAllowed}
              disabled={saving || locationLoading}
              aria-checked={locationAllowed}
              aria-label="Windows 위치 사용"
              onChange={(e) => void handleLocationToggle(e.target.checked)}
            />
          </label>
        </div>
      )}
    </PageLayout>
  );
}
