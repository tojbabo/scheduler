import { useState } from "react";
import { SideNav } from "./layout/SideNav";
import { Home } from "./pages/Home";
import { Schedule } from "./pages/Schedule";
import { Calendar } from "./pages/Calendar";
import { Settings } from "./pages/Settings";
import "./App.css";

function App() {
  const [activeMenu, setActiveMenu] = useState("home");

  return (
    <div className="shell">
      <SideNav activeId={activeMenu} onSelect={setActiveMenu} />

      <div className="shell__main">
        <div className="shell__drag" data-tauri-drag-region aria-hidden="true" />
        <main className="shell__content">
          {activeMenu === "home" && <Home />}
          {activeMenu === "schedule" && <Schedule />}
          {activeMenu === "calendar" && <Calendar />}
          {activeMenu === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;
