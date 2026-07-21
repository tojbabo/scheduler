import { useEffect, useId, useState, type FormEvent } from "react";

export type TaskCreateDraft = {
  title: string;
  description: string;
  createdAt: string;
  parentId: string;
};

type TaskCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  /** UI-only for now; persistence belongs to agent-data. */
  onSubmit?: (draft: TaskCreateDraft) => void;
};

function nowLocalInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskCreateDialog({
  open,
  onClose,
  onSubmit,
}: TaskCreateDialogProps) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createdAt, setCreatedAt] = useState(nowLocalInputValue);
  const [parentId, setParentId] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setCreatedAt(nowLocalInputValue());
    setParentId("");
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
    const draft: TaskCreateDraft = {
      title: title.trim(),
      description: description.trim(),
      createdAt,
      parentId,
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
            Task 추가
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
            <span className="field__label">작성 날짜</span>
            <input
              className="field__control"
              type="datetime-local"
              value={createdAt}
              disabled
              readOnly
            />
          </label>

          <label className="field">
            <span className="field__label">부모 Task</span>
            <select
              className="field__control"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">선택 안 함</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">제목</span>
            <input
              className="field__control"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="할 일 제목"
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
