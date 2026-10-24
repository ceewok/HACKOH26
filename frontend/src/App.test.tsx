import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { api, type ProblemSummary } from "./api";

vi.mock("./api", () => ({
  api: { health: vi.fn(), listProblems: vi.fn() },
}));

const weeklyProblem: ProblemSummary = {
  id: "weekly-live-office-hours",
  title: "Weekly Challenge: Live Industry Office Hours",
  hook: "Design live office hours.",
  isWeekly: true,
};

beforeEach(() => {
  vi.mocked(api.health).mockResolvedValue({ status: "ok", time: "2026-10-24T00:00:00.000Z" });
  vi.mocked(api.listProblems).mockResolvedValue([weeklyProblem]);
});

it("takes a visitor from onboarding to the Hub and then a selected problem route", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText("Nickname"), "Sam");
  await user.click(screen.getByRole("button", { name: "Enter the Hub" }));

  expect(await screen.findByRole("heading", { name: "Welcome back, Sam." })).toBeInTheDocument();
  await user.click(
    screen.getByRole("link", { name: "Open Weekly Challenge: Live Industry Office Hours" }),
  );

  expect(await screen.findByRole("heading", { name: "Your Blueprint Studio is next." })).toBeInTheDocument();
});
