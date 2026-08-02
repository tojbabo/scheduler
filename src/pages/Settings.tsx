import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { appLog } from "../bridge/log";
import {
  fetchWindowsLocation,
  readLocationAllowed,
  writeLocationAllowed,
} from "../bridge/location";
import {
  readKmaServiceKey,
  writeKmaServiceKey,
} from "../bridge/weather";
import { PageLayout } from "../layout/PageLayout";

export function Settings() {
  const [autoStart, setAutoStart] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [kmaKey, setKmaKey] = useState("");
  const [kmaKeySaved, setKmaKeySaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      setLocationLoading(true);
      appLog.info("Settings", "Windows 위치 조회를 요청했습니다.");
      try {
        const loc = await fetchWindowsLocation();
        if (!cancelled) setError(null);
        appLog.info("Settings", "Windows 위치 조회 완료", {
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      } catch (err: unknown) {
        appLog.error("Settings", "Windows 위치 조회 실패", err);
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
      const key = readKmaServiceKey();
      try {
        const enabled = await isEnabled();
        if (!cancelled) {
          setAutoStart(enabled);
          setLocationAllowed(allowed);
          setKmaKey(key);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setLocationAllowed(allowed);
          setKmaKey(key);
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
      appLog.info(
        "Settings",
        next ? "자동 시작을 켰습니다." : "자동 시작을 껐습니다.",
      );
    } catch (err: unknown) {
      appLog.error(
        "Settings",
        next ? "자동 시작 켜기 실패" : "자동 시작 끄기 실패",
        err,
      );
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
    appLog.info(
      "Settings",
      next ? "Windows 위치 사용을 켰습니다." : "Windows 위치 사용을 껐습니다.",
    );

    if (!next) {
      setLocationLoading(false);
      setSaving(false);
      return;
    }

    setLocationLoading(true);
    appLog.info("Settings", "Windows 위치 조회를 요청했습니다.");
    try {
      const loc = await fetchWindowsLocation();
      appLog.info("Settings", "Windows 위치 조회 완료", {
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    } catch (err: unknown) {
      appLog.error("Settings", "Windows 위치 조회 실패", err);
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

  function handleKmaKeySave() {
    writeKmaServiceKey(kmaKey);
    setError(null);
    setKmaKeySaved(true);
    appLog.info(
      "Settings",
      kmaKey.trim()
        ? "기상청 API 키를 저장했습니다."
        : "기상청 API 키를 비웠습니다.",
    );
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

          <div className="settings-block">
            <div className="settings-row settings-row--stack">
              <span className="settings-row__text">
                <span className="settings-row__title">기상청 API 키</span>
                <span className="settings-row__desc">
                  <span>
                    공공데이터포털에서 단기예보·중기예보 활용신청 후 인증키를 입력하세요.
                    Decoding/Encoding 키 모두 가능합니다.
                  </span>
                  <span>data.go.kr → 기상청_단기예보 / 중기예보 조회서비스</span>
                </span>
              </span>
              <div className="settings-key">
                <input
                  type="password"
                  className="field__control"
                  value={kmaKey}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="공공데이터포털 Decoding 키"
                  aria-label="기상청 API 키"
                  onChange={(e) => {
                    setKmaKey(e.target.value);
                    setKmaKeySaved(false);
                  }}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleKmaKeySave}
                >
                  저장
                </button>
              </div>
              {kmaKeySaved ? (
                <p className="settings-save-status" role="status">
                  저장되었습니다.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
