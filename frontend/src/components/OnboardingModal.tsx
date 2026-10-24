import { useState, type FormEvent } from "react";
import type { Role } from "../api";
import { setSession, type Session } from "../session";

interface OnboardingModalProps {
  onComplete(session: Session): void;
}

/** Collects the demo-only local identity; no account or authentication required. */
export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [role, setRole] = useState<Role>("student");
  const [nickname, setNickname] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    const cleanCompany = company.trim();

    if (!cleanNickname) {
      setError("Enter a nickname so your work can be credited.");
      return;
    }
    if (role === "pro" && !cleanCompany) {
      setError("Enter your company to join as an Industry Pro.");
      return;
    }

    const session: Session =
      role === "pro"
        ? { role, nickname: cleanNickname, company: cleanCompany }
        : { role, nickname: cleanNickname };

    setSession(session);
    onComplete(session);
  }

  return (
    <div className="modal-backdrop">
      <section
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <p className="onboarding-modal__eyebrow">Bridge Builder</p>
        <h1 id="onboarding-title">Build something useful together.</h1>
        <p id="onboarding-description" className="onboarding-modal__description">
          Pick a demo identity. Your nickname, solutions, and feedback are public in this
          prototype.
        </p>

        <form className="onboarding-form" noValidate onSubmit={submit}>
          <fieldset className="onboarding-form__roles">
            <legend>How are you joining?</legend>
            <label className={`role-choice ${role === "student" ? "role-choice--selected" : ""}`}>
              <input
                checked={role === "student"}
                name="role"
                onChange={() => setRole("student")}
                type="radio"
                value="student"
              />
              <span>
                <strong>Student</strong>
                <small>Practice system design, share what you learn.</small>
              </span>
            </label>
            <label className={`role-choice ${role === "pro" ? "role-choice--selected" : ""}`}>
              <input
                checked={role === "pro"}
                name="role"
                onChange={() => setRole("pro")}
                type="radio"
                value="pro"
              />
              <span>
                <strong>Industry Pro</strong>
                <small>Give focused feedback and practical tweaks.</small>
              </span>
            </label>
          </fieldset>

          <label className="form-field" htmlFor="nickname">
            Nickname
            <input
              autoComplete="username"
              autoFocus
              id="nickname"
              onChange={(event) => setNickname(event.target.value)}
              placeholder="e.g. AlexBuilds"
              value={nickname}
            />
          </label>

          {role === "pro" && (
            <label className="form-field" htmlFor="company">
              Company
              <input
                autoComplete="organization"
                id="company"
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. Honda"
                value={company}
              />
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button className="button button--primary" type="submit">
            Enter the Hub
          </button>
        </form>
      </section>
    </div>
  );
}
