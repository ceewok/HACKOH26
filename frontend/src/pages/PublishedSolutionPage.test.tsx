import { render, screen } from "@testing-library/react";
import mermaid from "mermaid";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api, ApiClientError, type SolutionDetail } from "../api";
import { PublishedSolutionPage } from "./PublishedSolutionPage";

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));
vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, getSolution: vi.fn() } };
});

const detail: SolutionDetail = {
  id: "solution-1",
  problemId: "problem-1",
  author: { role: "pro", nickname: "Morgan", company: "Honda" },
  spec: { api: "API Gateway", processing: "Lambda", storage: "DynamoDB", bottlenecks: "SQS" },
  mermaid: "flowchart TD\nClient --> Api",
  endorsedByPro: true,
  createdAt: "2026-10-24T00:00:00.000Z",
  feedback: [
    { id: "feedback-1", solutionId: "solution-1", author: { role: "student", nickname: "Alex" }, text: "Great queue design.", createdAt: "2026-10-24T01:00:00.000Z" },
  ],
  tweaks: [
    { id: "tweak-1", problemId: "problem-1", author: { role: "student", nickname: "Sam" }, spec: { api: "API", processing: "Lambda", storage: "DynamoDB", bottlenecks: "Queue" }, mermaid: "flowchart TD\nA --> B", parentSolutionId: "solution-1", tweakNote: "Added a queue.", endorsedByPro: false, createdAt: "2026-10-25T00:00:00.000Z" },
  ],
};

function renderDetail(id = detail.id) {
  return render(
    <MemoryRouter initialEntries={[`/solutions/${id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/solutions/:id" element={<PublishedSolutionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.getSolution).mockReset();
  vi.mocked(mermaid.render).mockReset();
});

it("reloads and renders the public detail, diagram, feedback, and direct tweaks", async () => {
  vi.mocked(api.getSolution).mockResolvedValue(detail);
  vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>detail</text></svg>' } as never);
  renderDetail();

  expect(screen.getByRole("status")).toHaveTextContent("Getting the design");
  expect(await screen.findByRole("heading", { name: "Morgan's architecture" })).toBeInTheDocument();
  expect(screen.getByText(/Honda/)).toBeInTheDocument();
  expect(screen.getByText("Endorsed by a Pro")).toBeInTheDocument();
  expect(screen.getByText("Great queue design.")).toBeInTheDocument();
  expect(screen.getByText("Sam's tweak")).toBeInTheDocument();
  expect(await screen.findByText("detail")).toBeInTheDocument();
  expect(api.getSolution).toHaveBeenCalledWith(detail.id);
});

it("renders a 404-specific state for a missing public solution", async () => {
  const error = new ApiClientError(404, "not_found", "No solution with id missing");
  vi.mocked(api.getSolution).mockRejectedValue(error);
  renderDetail("missing");

  expect(await screen.findByRole("heading", { name: "This solution is not available." })).toBeInTheDocument();
});
