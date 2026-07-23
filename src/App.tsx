import { useState } from "react";
import { SideNav } from "./layout/SideNav";
import { WindowControls } from "./layout/WindowControls";
import { Home } from "./pages/Home";
import { Schedule } from "./pages/Schedule";
import { Calendar } from "./pages/Calendar";
import { Settings } from "./pages/Settings";
import { CategoriesProvider } from "./state/CategoriesContext";
import "./App.css";

function App() {
  const [activeMenu, setActiveMenu] = useState("home");

  return (
    <CategoriesProvider>
      <div className="shell">
        <SideNav activeId={activeMenu} onSelect={setActiveMenu} />

        <div className="shell__main">
          <div className="shell__drag" data-tauri-drag-region aria-hidden="true" />
          <WindowControls />
          <main className="shell__content">
            {activeMenu === "home" && <Home />}
            {activeMenu === "plan" && <Schedule />}
            {activeMenu === "calendar" && <Calendar />}
            {activeMenu === "settings" && <Settings />}
          </main>
        </div>
      </div>
    </CategoriesProvider>
  );
}

export default App;
