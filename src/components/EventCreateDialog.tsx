import { useEffect, useId, useState, type FormEvent } from "react";
import { useCategories } from "../state/CategoriesContext";

export type EventCreateDraft = {
  /** ISO-like local datetime; date-only UI is expanded to `YYYY-MM-DDT00:00`. */
  startsAt: string;
  /** ISO-like local datetime; date-only UI is expanded to `YYYY-MM-DDT00:00`. */
  endsAt: string;
  title: string;
  description: string;
  categoryId: string; // UI string; empty = none
};

/** Prefill shape for edit mode (`startsAt` / `endsAt` are date-only `YYYY-MM-DD`). */
export type EventCreateInitial = {
  startsAt: string;
  endsAt: string;
  title: string;
  description: string;
  categoryId: string;
};

type EventCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  /** `create` (default) or `edit` — affects defaults for heading / submit label. */
  mode?: "create" | "edit";
  /** Dialog heading; defaults to "일정 추가" / "일정 수정" by mode. */
  title?: string;
  /** Prefill start date (`YYYY-MM-DD`) when the dialog opens in create mode. */
  initialStartsAt?: string;
  /** Prefill end date (`YYYY-MM-DD`) when the dialog opens in create mode. */
  initialEndsAt?: string;
  /** Prefill all fields when the dialog opens in edit mode. */
  initialEvent?: EventCreateInitial;
  /** Parent branches create vs update; draft shape is the same. */
  onSubmit?: (draft: EventCreateDraft) => void;
};

/** Date input (`YYYY-MM-DD`) → API local midnight (`YYYY-MM-DDT00:00`). */
function dateToMidnightLocal(date: string): string {
  const trimmed = date.trim();
  if (!trimmed) return "";
  return `${trimmed}T00:00`;
}

export function EventCreateDialog({
  open,
  onClose,
  mode = "create",
  title: dialogTitle,
  initialStartsAt,
  initialEndsAt,
  initialEvent,
  onSubmit,
}: EventCreateDialogProps) {
  const titleId = useId();
  const { categories, loading: categoriesLoading } = useCategories();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const heading =
    dialogTitle ?? (mode === "edit" ? "일정 수정" : "일정 추가");
  const submitLabel = mode === "edit" ? "수정" : "추가";

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialEvent != null) {
      setStartsAt(initialEvent.startsAt);
      setEndsAt(initialEvent.endsAt);
      setTitle(initialEvent.title);
      setDescription(initialEvent.description);
      setCategoryId(initialEvent.categoryId);
      return;
    }
    setStartsAt(initialStartsAt ?? "");
    setEndsAt(initialEndsAt ?? "");
    setTitle("");
    setDescription("");
    setCategoryId("");
  }, [open, mode, initialEvent, initialStartsAt, initialEndsAt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const draft: EventCreateDraft = {
      startsAt: dateToMidnightLocal(startsAt),
      endsAt: dateToMidnightLocal(endsAt),
      title: title.trim(),
      description: description.trim(),
      categoryId,
    };
    onSubmit?.(draft);
    onClose();
  }

  return (
    <div className="dialog-root" role="presentation">
      <button
        type="button"
        className="dialog-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="dialog__header">
          <h3 id={titleId} className="dialog__title">
            {heading}
          </h3>
          <button
            type="button"
            className="dialog__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <form className="dialog__form" onSubmit={handleSubmit}>
          <div className="field-row">
            <label className="field">
              <span className="field__label">시작</span>
              <input
                className="field__control"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">종료</span>
              <input
                className="field__control"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>

          <div className="field-row field-row--7-3">
            <label className="field">
              <span className="field__label">제목</span>
              <input
                className="field__control"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="일정 제목"
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span className="field__label">카테고리</span>
              <select
                className="field__control"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categoriesLoading}
              >
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field__label">설명</span>
            <textarea
              className="field__control field__control--area"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="선택 사항"
              rows={4}
            />
          </label>

          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn--primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
