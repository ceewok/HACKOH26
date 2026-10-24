import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api, type Problem } from "../api";
import { ProblemPage } from "./ProblemPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { ...actual.api, getProblem: vi.fn() },
  };
});

const problem: Problem = {
  id: "weekly-live-office-hours",
  title: "Weekly Challenge: Live Industry Office Hours",
  hook: "Design live office hours.",
  description: "Students join a short mentor-led session with a real-time question queue.",
  constraints: ["Updates arrive under two seconds.", "A late joiner sees the current state."],
  hintPills: ["DynamoDB", "SQS Queue"],
  isWeekly: true,
};

function renderProblemPage(id = problem.id) {
  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[`/problems/${id}`]}
    >
      <Routes>
        <Route path="/problems/:id" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.getProblem).mockReset();
});

it("renders the full brief, constraints, and interactive hint pills from the detail contract", async () => {
  const user = userEvent.setup();
  vi.mocked(api.getProblem).mockResolvedValue(problem);
  renderProblemPage();

  expect(screen.getByRole("status")).toHaveTextContent("Getting the constraints");
  expect(await screen.findByRole("heading", { name: problem.title })).toBeInTheDocument();
  expect(screen.getByText(problem.description)).toBeInTheDocument();
  for (const constraint of problem.constraints) {
    expect(screen.getByText(constraint)).toBeInTheDocument();
  }

  const processingField = screen.getByRole("textbox", { name: /Core Processing/ });
  await user.click(processingField);
  await user.click(screen.getByRole("button", { name: "SQS Queue" }));

  expect(processingField).toHaveValue("SQS Queue");
  expect(screen.getByRole("button", { name: "SQS Queue" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Diagram generation connects next.")).toBeInTheDocument();
  expect(api.getProblem).toHaveBeenCalledWith(problem.id);
});

it("keeps loading state visible until the detail response resolves", async () => {
  let resolveProblem: (value: Problem) => void;
  vi.mocked(api.getProblem).mockImplementation(
    () => new Promise<Problem>((resolve) => {
      resolveProblem = resolve;
    }),
  );
  renderProblemPage();

  expect(screen.getByRole("status")).toHaveTextContent("Getting the constraints");
  resolveProblem!(problem);

  expect(await screen.findByRole("heading", { name: problem.title })).toBeInTheDocument();
});

it("shows a retryable API error and retries through api.getProblem", async () => {
  const user = userEvent.setup();
  vi.mocked(api.getProblem)
    .mockRejectedValueOnce(new Error("Unable to load this problem."))
    .mockResolvedValueOnce(problem);
  renderProblemPage();

  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this problem.");
  await user.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByRole("heading", { name: problem.title })).toBeInTheDocument();
  expect(api.getProblem).toHaveBeenCalledTimes(2);
});

it("renders safe fallbacks for a detail response without constraints or hint pills", async () => {
  vi.mocked(api.getProblem).mockResolvedValue({ ...problem, constraints: [], hintPills: [] });
  renderProblemPage();

  expect(await screen.findByText("No constraints were provided. Define the trade-offs you want to explore.")).toBeInTheDocument();
  expect(screen.getByText("No suggested building blocks were provided for this problem.")).toBeInTheDocument();
});
