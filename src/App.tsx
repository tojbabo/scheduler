import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [status, setStatus] = useState("준비됨");

  async function pingRust() {
    const message = await invoke<string>("greet", { name: "Scheduler" });
    setStatus(message);
  }

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__brand">Scheduler</p>
        <h1 className="app__title">데스크톱 스케줄러</h1>
        <p className="app__subtitle">
          React + Tauri 기반 Windows 앱 기초 환경이 준비되었습니다.
        </p>
      </header>

      <section className="app__panel">
        <p className="app__status">{status}</p>
        <button type="button" onClick={pingRust}>
          Rust 브리지 확인
        </button>
      </section>
    </main>
  );
}

export default App;
