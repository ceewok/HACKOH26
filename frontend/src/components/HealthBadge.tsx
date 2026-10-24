import { useEffect, useState } from "react";
import { api } from "../api";

type State = "checking" | "connected" | "offline";

/** Small indicator proving the SPA can reach the backend end to end. */
export function HealthBadge() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    api
      .health()
      .then(() => active && setState("connected"))
      .catch(() => active && setState("offline"));
    return () => {
      active = false;
    };
  }, []);

  const label =
    state === "checking" ? "Checking…" : state === "connected" ? "Connected" : "Offline";

  return (
    <span className={`health health--${state}`} role="status" aria-live="polite">
      <span className="health__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
