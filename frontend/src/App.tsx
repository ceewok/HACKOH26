import { Link, Route, Routes } from "react-router-dom";
import { HealthBadge } from "./components/HealthBadge";
import { HubPage } from "./pages/HubPage";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <Link to="/" className="app__brand">
          Bridge Builder <span className="app__brand-sub">System Design Studio</span>
        </Link>
        <HealthBadge />
      </header>

      <main className="app__main">
        <Routes>
          <Route path="/" element={<HubPage />} />
        </Routes>
      </main>

      <footer className="app__footer">
        HackOHI/O 2026 — Bridge Builder Challenge demo. Everything here is public and seeded.
      </footer>
    </div>
  );
}
