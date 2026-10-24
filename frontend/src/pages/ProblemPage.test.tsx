import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import mermaid from "mermaid";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api, ApiClientError, type Problem } from "../api";
import { ProblemPage } from "./ProblemPage";

vi.mock("mermaid", () => ({
  default: { initialize: vi.fn(), render: vi.fn() },
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: { ...actual.api, getProblem: vi.fn(), generateDiagram: vi.fn() },
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

function svg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${label}</text></svg>`;
}

beforeEach(() => {
  vi.mocked(api.getProblem).mockReset();
  vi.mocked(api.generateDiagram).mockReset();
  vi.mocked(mermaid.render).mockReset();
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
  expect(screen.getByRole("button", { name: "Update Blueprint" })).toBeEnabled();
  expect(screen.getByText("Ready to map your architecture.")).toBeInTheDocument();
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

it("generates a Mermaid preview only after the on-demand API request succeeds", async () => {
  const user = userEvent.setup();
  vi.mocked(api.getProblem).mockResolvedValue(problem);
  vi.mocked(api.generateDiagram).mockResolvedValue({ mermaid: "flowchart TD\nClient --> API" });
  vi.mocked(mermaid.render).mockResolvedValue({ svg: svg("first") } as never);
  renderProblemPage();

  await screen.findByRole("heading", { name: problem.title });
  await user.type(screen.getByRole("textbox", { name: /API & Ingestion/ }), "REST API");
  await user.click(screen.getByRole("button", { name: "Update Blueprint" }));

  await waitFor(() => {
    expect(api.generateDiagram).toHaveBeenCalledWith(problem.id, {
      api: "REST API",
      processing: "",
      storage: "",
      bottlenecks: "",
    });
  });
  expect(await screen.findByText("first")).toBeInTheDocument();
  expect(screen.getByTestId("mermaid-diagram").querySelector("svg")).not.toBeNull();
});

it("preserves the last rendered diagram when a later AI or Mermaid step fails", async () => {
  const user = userEvent.setup();
  vi.mocked(api.getProblem).mockResolvedValue(problem);
  vi.mocked(api.generateDiagram)
    .mockResolvedValueOnce({ mermaid: "flowchart TD\nA --> B" })
    .mockResolvedValueOnce({ mermaid: "flowchart TD\nBroken --> Diagram" })
    .mockRejectedValueOnce(new ApiClientError(502, "upstream_error", "Diagram service is unavailable."));
  vi.mocked(mermaid.render)
    .mockResolvedValueOnce({ svg: svg("first") } as never)
    .mockRejectedValueOnce(new Error("Mermaid rejected source"));
  renderProblemPage();

  await screen.findByRole("heading", { name: problem.title });
  const button = screen.getByRole("button", { name: "Update Blueprint" });
  await user.click(button);
  expect(await screen.findByText("first")).toBeInTheDocument();

  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be rendered");
  expect(screen.getByText("first")).toBeInTheDocument();

  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Diagram service is unavailable.");
  expect(screen.getByText("first")).toBeInTheDocument();
});
