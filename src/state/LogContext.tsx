import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { appLog, type AppLogEntry } from "../bridge/log";

type LogContextValue = {
  entries: AppLogEntry[];
  clear: () => void;
};

const LogContext = createContext<LogContextValue | null>(null);

export function LogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AppLogEntry[]>(() => appLog.list());

  useEffect(() => {
    appLog.info("App", "애플리케이션이 시작되었습니다.");
    return appLog.subscribe(() => {
      setEntries(appLog.list());
    });
  }, []);

  return (
    <LogContext.Provider value={{ entries, clear: () => appLog.clear() }}>
      {children}
    </LogContext.Provider>
  );
}

export function useAppLogs(): LogContextValue {
  const ctx = useContext(LogContext);
  if (ctx == null) {
    throw new Error("useAppLogs must be used within LogProvider");
  }
  return ctx;
}
