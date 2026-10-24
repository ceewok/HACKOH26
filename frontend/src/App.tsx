import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { HealthBadge } from "./components/HealthBadge";
import { OnboardingModal } from "./components/OnboardingModal";
import { HubPage } from "./pages/HubPage";
import { ProblemPage } from "./pages/ProblemPage";
import { clearSession, getSession, type Session } from "./session";
import "./App.css";

export default function App() {
  const [session, setSession] = useState<Session | null>(() => getSession());

  function restartOnboarding() {
    clearSession();
    setSession(null);
  }

  const hasSession = session !== null;

  return (
    <div className="app">
      <header className="app__header">
        {hasSession ? (
          <Link to="/" className="app__brand">
            Bridge Builder <span className="app__brand-sub">System Design Studio</span>
          </Link>
        ) : (
          <span className="app__brand">
            Bridge Builder <span className="app__brand-sub">System Design Studio</span>
          </span>
        )}
        <div className="app__header-actions">
          {session && (
            <div className="app__identity">
              <span>
                {session.nickname}
                {session.company ? ` · ${session.company}` : ""}
              </span>
              <button className="button button--quiet" onClick={restartOnboarding} type="button">
                Change profile
              </button>
            </div>
          )}
          <HealthBadge />
        </div>
      </header>

      <main className="app__main" aria-hidden={!hasSession}>
        <Routes>
          <Route path="/" element={session ? <HubPage session={session} /> : <LandingPage />} />
          <Route path="/problems/:id" element={session ? <ProblemPage /> : <LandingPage />} />
        </Routes>
      </main>

      {session === null && <OnboardingModal onComplete={setSession} />}

      <footer className="app__footer">
        HackOHI/O 2026 — Bridge Builder Challenge demo. Everything here is public and seeded.
      </footer>
    </div>
  );
}

/** Static background behind required onboarding; it performs no data request. */
function LandingPage() {
  return (
    <section className="hub hub--status" aria-labelledby="landing-title">
      <p className="hub__eyebrow">Bridge Builder</p>
      <h1 id="landing-title">Learn by building with your community.</h1>
      <p>Choose a demo identity to browse challenges and share your system-design thinking.</p>
    </section>
  );
}
