import { useState } from "react";
import { SideNav } from "./layout/SideNav";
import { StatusBar } from "./layout/StatusBar";
import { Home } from "./pages/Home";
import "./App.css";

const PAGE_TITLES: Record<string, string> = {
  home: "홈",
  schedule: "일정",
  calendar: "캘린더",
  settings: "설정",
};

function App() {
  const [activeMenu, setActiveMenu] = useState("home");

  return (
    <div className="shell">
      <SideNav activeId={activeMenu} onSelect={setActiveMenu} />

      <div className="shell__main">
        <StatusBar title={PAGE_TITLES[activeMenu] ?? "홈"} statusText="준비됨" />
        <main className="shell__content">
          {activeMenu === "home" ? (
            <Home />
          ) : (
            <section className="home">
              <p className="home__eyebrow">{PAGE_TITLES[activeMenu]}</p>
              <h2 className="home__heading">{PAGE_TITLES[activeMenu]} 화면</h2>
              <p className="home__copy">플레이스홀더 화면입니다.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
