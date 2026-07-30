import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  LOCATION_ALLOWED_CHANGED,
  readLocationAllowed,
} from "../bridge/location";
import {
  fetchLocalWeekWeather,
  KMA_KEY_CHANGED,
  type DayWeather,
} from "../bridge/weather";

type WeatherContextValue = {
  days: DayWeather[] | null;
  placeLabel: string | null;
  warning: string | null;
  error: string | null;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

/** Loads week weather once at app root; reuse via `useWeekWeather()`. */
export function WeatherProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<DayWeather[] | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!readLocationAllowed()) {
        if (!cancelled) {
          setDays(null);
          setPlaceLabel(null);
          setWarning(null);
          setError(null);
        }
        return;
      }
      try {
        const week = await fetchLocalWeekWeather();
        if (!cancelled) {
          setDays(week.days);
          setPlaceLabel(week.placeLabel);
          setWarning(week.weatherWarning);
          setError(null);
        }
      } catch (err: unknown) {
        console.error("[Weather] load failed", err);
        if (!cancelled) {
          setDays(null);
          setWarning(null);
          setError(
            err instanceof Error
              ? err.message
              : "날씨를 불러오지 못했습니다.",
          );
        }
      }
    }

    void loadWeather();

    function onReload() {
      void loadWeather();
    }

    window.addEventListener(LOCATION_ALLOWED_CHANGED, onReload);
    window.addEventListener(KMA_KEY_CHANGED, onReload);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCATION_ALLOWED_CHANGED, onReload);
      window.removeEventListener(KMA_KEY_CHANGED, onReload);
    };
  }, []);

  return (
    <WeatherContext.Provider value={{ days, placeLabel, warning, error }}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeekWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (ctx == null) {
    throw new Error("useWeekWeather must be used within WeatherProvider");
  }
  return ctx;
}
