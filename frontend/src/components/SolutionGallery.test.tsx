import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api, type SolutionWithTweakCount } from "../api";
import { SolutionGallery } from "./SolutionGallery";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, listSolutions: vi.fn() } };
});

const student: SolutionWithTweakCount = {
  id: "student-1",
  problemId: "problem-1",
  author: { role: "student", nickname: "Alex" },
  spec: { api: "API", processing: "Lambda", storage: "DynamoDB", bottlenecks: "Queue" },
  mermaid: "flowchart TD\nA --> B",
  endorsedByPro: false,
  createdAt: "2026-10-24T00:00:00.000Z",
  tweakCount: 0,
};

const pro: SolutionWithTweakCount = {
  ...student,
  id: "pro-1",
  author: { role: "pro", nickname: "Morgan", company: "Honda" },
  endorsedByPro: true,
  tweakCount: 2,
};

function renderGallery() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SolutionGallery problemId="problem-1" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.listSolutions).mockReset();
});

it("loads all solutions first, then refetches with the selected public role filter", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listSolutions).mockResolvedValueOnce([student]).mockResolvedValueOnce([pro]);
  renderGallery();

  expect(screen.getByRole("status")).toHaveTextContent("Loading published blueprints");
  expect(await screen.findByText("Alex's blueprint")).toBeInTheDocument();
  expect(api.listSolutions).toHaveBeenCalledWith("problem-1", "all");

  await user.click(screen.getByRole("tab", { name: "Industry Pros" }));

  expect(await screen.findByText("Honda")).toBeInTheDocument();
  expect(api.listSolutions).toHaveBeenLastCalledWith("problem-1", "pro");
  expect(screen.getByRole("tab", { name: "Industry Pros" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("2 community tweaks")).toBeInTheDocument();
  expect(screen.getByText("Endorsed by a Pro")).toBeInTheDocument();
});

it("renders useful empty and retryable error states", async () => {
  const user = userEvent.setup();
  vi.mocked(api.listSolutions).mockRejectedValueOnce(new Error("Unable to load solutions.")).mockResolvedValueOnce([]);
  renderGallery();

  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load solutions.");
  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("No blueprints match this filter yet.")).toBeInTheDocument();
  expect(api.listSolutions).toHaveBeenCalledTimes(2);
});
