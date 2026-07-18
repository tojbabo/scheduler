type StatusBarProps = {
  title: string;
  statusText?: string;
};

export function StatusBar({ title, statusText = "준비됨" }: StatusBarProps) {
  return (
    <header className="status-bar">
      <div className="status-bar__left">
        <h1 className="status-bar__title">{title}</h1>
      </div>
      <div className="status-bar__right">
        <span className="status-bar__dot" aria-hidden="true" />
        <span className="status-bar__status">{statusText}</span>
      </div>
    </header>
  );
}
