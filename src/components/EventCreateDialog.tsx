import { useEffect, useId, useState, type FormEvent } from "react";

export type EventCreateDraft = {
  createdAt: string;
  updatedAt: string;
  startsAt: string;
  endsAt: string;
  title: string;
  description: string;
  categoryId: string; // UI string; empty = none
};

type EventCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Dialog heading; defaults to "일정 추가". */
  title?: string;
  /** UI-only for now; persistence belongs to agent-data. */
  onSubmit?: (draft: EventCreateDraft) => void;
};

function nowLocalInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventCreateDialog({
  open,
  onClose,
  title: dialogTitle = "일정 추가",
  onSubmit,
}: EventCreateDialogProps) {
  const titleId = useId();
  const [createdAt, setCreatedAt] = useState(nowLocalInputValue);
  const [updatedAt, setUpdatedAt] = useState(nowLocalInputValue);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!open) return;
    const now = nowLocalInputValue();
    setCreatedAt(now);
    setUpdatedAt(now);
    setStartsAt("");
    setEndsAt("");
    setTitle("");
    setDescription("");
    setCategoryId("");
  }, [open]);

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
      createdAt,
      updatedAt,
      startsAt,
      endsAt,
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
            {dialogTitle}
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
          <label className="field">
            <span className="field__label">작성</span>
            <input
              className="field__control"
              type="datetime-local"
              value={createdAt}
              disabled
              readOnly
            />
          </label>

          <label className="field">
            <span className="field__label">수정</span>
            <input
              className="field__control"
              type="datetime-local"
              value={updatedAt}
              disabled
              readOnly
            />
          </label>

          <label className="field">
            <span className="field__label">시작</span>
            <input
              className="field__control"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">종료</span>
            <input
              className="field__control"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>

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
            <span className="field__label">설명</span>
            <textarea
              className="field__control field__control--area"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="선택 사항"
              rows={4}
            />
          </label>

          <label className="field">
            <span className="field__label">카테고리</span>
            <select
              className="field__control"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">선택 안 함</option>
            </select>
          </label>

          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn--primary">
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
