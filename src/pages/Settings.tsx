import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { PageLayout } from "../layout/PageLayout";

export function Settings() {
  const [autoStart, setAutoStart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const enabled = await isEnabled();
        if (!cancelled) {
          setAutoStart(enabled);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("자동 시작 설정을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(next: boolean) {
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
              onChange={(e) => void handleToggle(e.target.checked)}
            />
          </label>
        </div>
      )}
    </PageLayout>
  );
}
