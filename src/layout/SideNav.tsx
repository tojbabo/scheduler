import { getCurrentWindow } from "@tauri-apps/api/window";

const MENU_ITEMS = [
  { id: "home", label: "홈", icon: HomeIcon },
  { id: "plan", label: "계획", icon: ScheduleIcon },
  { id: "calendar", label: "캘린더", icon: CalendarIcon },
  { id: "settings", label: "설정", icon: SettingsIcon },
] as const;

type SideNavProps = {
  activeId: string;
  onSelect: (id: string) => void;
};

export function SideNav({ activeId, onSelect }: SideNavProps) {
  async function handleQuit() {
    await getCurrentWindow().close();
  }

  return (
    <nav className="side-nav" aria-label="주 메뉴">
      <div className="side-nav__brand" title="Scheduler" data-tauri-drag-region>
        <span className="side-nav__brand-mark" aria-hidden="true">
          S
        </span>
        <span className="side-nav__label">Scheduler</span>
      </div>

      <ul className="side-nav__list">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;

          return (
            <li key={item.id}>
              <button
                type="button"
                className={`side-nav__item${active ? " is-active" : ""}`}
                onClick={() => onSelect(item.id)}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <span className="side-nav__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="side-nav__label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="side-nav__footer">
        <button
          type="button"
          className="side-nav__item side-nav__quit"
          onClick={handleQuit}
          title="종료"
        >
          <span className="side-nav__icon" aria-hidden="true">
            <QuitIcon />
          </span>
          <span className="side-nav__label">종료</span>
        </button>
      </div>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M8 14h4M8 17h8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6" />
    </svg>
  );
}

function QuitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2" />
      <path d="M15 8l4 4-4 4" />
      <path d="M10 12h9" />
    </svg>
  );
}
