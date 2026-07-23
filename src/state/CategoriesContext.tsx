import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { listCategories, type Category } from "../bridge/db";

type CategoriesContextValue = {
  categories: Category[];
  loading: boolean;
  error: string | null;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

/** Loads categories once at app root; reuse via `useCategories()`. */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategories(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "카테고리를 불러오지 못했습니다.";
        console.error("[Categories] load failed", err);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CategoriesContext.Provider value={{ categories, loading, error }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (ctx == null) {
    throw new Error("useCategories must be used within CategoriesProvider");
  }
  return ctx;
}
