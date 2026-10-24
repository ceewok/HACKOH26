import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api, type ProblemSummary } from "../api";
import { HubPage } from "./HubPage";

vi.mock("../api", () => ({
  api: { listProblems: vi.fn() },
}));

const problems: ProblemSummary[] = [
  {
    id: "weekly-live-office-hours",
    title: "Weekly Challenge: Live Industry Office Hours",
    hook: "Design live office hours.",
    isWeekly: true,
  },
  {
    id: "peer-demo-feedback",
    title: "Peer Demo Feedback in Under a Minute",
    hook: "Design a feedback pipeline.",
    isWeekly: false,
  },
];

function renderHub() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <HubPage session={{ role: "student", nickname: "Alex" }} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.listProblems).mockReset();
});

it("renders the weekly hero and persistent problem cards from the published list shape", async () => {
  vi.mocked(api.listProblems).mockResolvedValue(problems);
  renderHub();

  expect(screen.getByRole("status")).toHaveTextContent("Loading the weekly challenge");
  expect(await screen.findByRole("heading", { name: "Weekly Challenge" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Weekly Challenge: Live Industry Office Hours" })).toHaveAttribute(
    "href",
    "/problems/weekly-live-office-hours",
  );
  expect(screen.getByRole("link", { name: "Open Peer Demo Feedback in Under a Minute" })).toHaveAttribute(
    "href",
    "/problems/peer-demo-feedback",
  );
});

it("shows a useful empty state when the API returns no problems", async () => {
  vi.mocked(api.listProblems).mockResolvedValue([]);
  renderHub();

  expect(await screen.findByText("A new weekly challenge is being prepared.")).toBeInTheDocument();
  expect(screen.getByText("No persistent problems are available yet.")).toBeInTheDocument();
});

it("shows the API error and retries through the same api seam", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listProblems)
    .mockRejectedValueOnce(new Error("Unable to load problems. Try again shortly."))
    .mockResolvedValueOnce(problems);
  renderHub();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load problems. Try again shortly.",
  );

  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Weekly Challenge" })).toBeInTheDocument();
  expect(api.listProblems).toHaveBeenCalledTimes(2);
});
