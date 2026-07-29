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
  type DayWeather,
} from "../bridge/weather";

type WeatherContextValue = {
  days: DayWeather[] | null;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

/** Loads week weather once at app root; reuse via `useWeekWeather()`. */
export function WeatherProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<DayWeather[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!readLocationAllowed()) {
        if (!cancelled) setDays(null);
        return;
      }
      try {
        const week = await fetchLocalWeekWeather();
        if (!cancelled) setDays(week.days);
      } catch {
        if (!cancelled) setDays(null);
      }
    }

    void loadWeather();

    function onLocationAllowedChanged() {
      void loadWeather();
    }

    window.addEventListener(LOCATION_ALLOWED_CHANGED, onLocationAllowedChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        LOCATION_ALLOWED_CHANGED,
        onLocationAllowedChanged,
      );
    };
  }, []);

  return (
    <WeatherContext.Provider value={{ days }}>{children}</WeatherContext.Provider>
  );
}

export function useWeekWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (ctx == null) {
    throw new Error("useWeekWeather must be used within WeatherProvider");
  }
  return ctx;
}
