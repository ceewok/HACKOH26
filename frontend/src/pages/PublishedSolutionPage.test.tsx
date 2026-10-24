import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import mermaid from "mermaid";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api, ApiClientError, type Feedback, type SolutionDetail } from "../api";
import { setSession } from "../session";
import { PublishedSolutionPage } from "./PublishedSolutionPage";

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));
vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, getSolution: vi.fn(), submitFeedback: vi.fn() } };
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

/** Captures the tweak seed carried in navigation state so the test can assert it. */
function TweakSeedProbe() {
  const location = useLocation();
  const seed = (location.state as { tweak?: unknown } | null)?.tweak;
  return <pre data-testid="tweak-seed">{JSON.stringify(seed)}</pre>;
}

function renderDetail(id = detail.id) {
  return render(
    <MemoryRouter initialEntries={[`/solutions/${id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/solutions/:id" element={<PublishedSolutionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const studentDetail: SolutionDetail = {
  ...detail,
  id: "solution-2",
  author: { role: "student", nickname: "Robin" },
  endorsedByPro: false,
  feedback: [],
  tweaks: [],
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getSolution).mockReset();
  vi.mocked(api.submitFeedback).mockReset();
  vi.mocked(mermaid.render).mockReset();
  vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' } as never);
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

it("prompts an anonymous visitor to set up an identity before leaving feedback", async () => {
  vi.mocked(api.getSolution).mockResolvedValue(studentDetail);
  renderDetail(studentDetail.id);

  expect(await screen.findByRole("heading", { name: "Robin's architecture" })).toBeInTheDocument();
  expect(screen.getByText("Set up your demo identity")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /post feedback/i })).not.toBeInTheDocument();
});

it("posts student feedback, appending it without endorsing", async () => {
  setSession({ role: "student", nickname: "Alex" });
  vi.mocked(api.getSolution).mockResolvedValue(studentDetail);
  const newFeedback: Feedback = {
    id: "feedback-new",
    solutionId: studentDetail.id,
    author: { role: "student", nickname: "Alex" },
    text: "Clean separation.",
    createdAt: "2026-10-26T00:00:00.000Z",
  };
  vi.mocked(api.submitFeedback).mockResolvedValue({ feedback: newFeedback, endorsedByPro: false });
  renderDetail(studentDetail.id);

  await screen.findByRole("heading", { name: "Robin's architecture" });
  await userEvent.type(screen.getByLabelText(/feedback as/i), "Clean separation.");
  await userEvent.click(screen.getByRole("button", { name: /post feedback/i }));

  await waitFor(() => expect(screen.getByText("Clean separation.")).toBeInTheDocument());
  expect(api.submitFeedback).toHaveBeenCalledWith(studentDetail.id, {
    author: { role: "student", nickname: "Alex" },
    text: "Clean separation.",
  });
  expect(screen.queryByText("Endorsed by a Pro")).not.toBeInTheDocument();
});

it("shows the Endorsed by a Pro badge after a pro posts feedback", async () => {
  setSession({ role: "pro", nickname: "Morgan", company: "Honda" });
  vi.mocked(api.getSolution).mockResolvedValue(studentDetail);
  const proFeedback: Feedback = {
    id: "feedback-pro",
    solutionId: studentDetail.id,
    author: { role: "pro", nickname: "Morgan", company: "Honda" },
    text: "Ship it.",
    createdAt: "2026-10-26T00:00:00.000Z",
  };
  vi.mocked(api.submitFeedback).mockResolvedValue({ feedback: proFeedback, endorsedByPro: true });
  renderDetail(studentDetail.id);

  await screen.findByRole("heading", { name: "Robin's architecture" });
  expect(screen.queryByText("Endorsed by a Pro")).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText(/feedback as/i), "Ship it.");
  await userEvent.click(screen.getByRole("button", { name: /post feedback/i }));

  await waitFor(() => expect(screen.getByText("Endorsed by a Pro")).toBeInTheDocument());
  expect(screen.getByText("Ship it.")).toBeInTheDocument();
});

it("surfaces a feedback submission error and keeps the draft", async () => {
  setSession({ role: "student", nickname: "Alex" });
  vi.mocked(api.getSolution).mockResolvedValue(studentDetail);
  vi.mocked(api.submitFeedback).mockRejectedValue(new ApiClientError(500, "internal_error", "Unable to save feedback. Try again shortly."));
  renderDetail(studentDetail.id);

  await screen.findByRole("heading", { name: "Robin's architecture" });
  await userEvent.type(screen.getByLabelText(/feedback as/i), "Nice work.");
  await userEvent.click(screen.getByRole("button", { name: /post feedback/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save feedback");
  expect(screen.getByLabelText(/feedback as/i)).toHaveValue("Nice work.");
});

// --- Task 9: tweak / fork flow ---

it("lists public community tweaks linking to each tweak solution", async () => {
  vi.mocked(api.getSolution).mockResolvedValue(detail);
  renderDetail();

  const tweakLink = await screen.findByRole("link", { name: /Sam's tweak/ });
  expect(tweakLink).toHaveAttribute("href", "/solutions/tweak-1");
  expect(screen.getByText("Added a queue.")).toBeInTheDocument();
});

it("Tweak This Design opens the problem Studio pre-filled with this solution's spec + diagram", async () => {
  vi.mocked(api.getSolution).mockResolvedValue(detail);
  render(
    <MemoryRouter
      initialEntries={[`/solutions/${detail.id}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/solutions/:id" element={<PublishedSolutionPage />} />
        <Route path="/problems/:id" element={<TweakSeedProbe />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByRole("heading", { name: "Morgan's architecture" });
  await userEvent.click(screen.getByRole("button", { name: "Tweak This Design" }));

  const seed = await screen.findByTestId("tweak-seed");
  expect(JSON.parse(seed.textContent ?? "{}")).toEqual({
    parentSolutionId: detail.id,
    parentAuthor: "Morgan",
    spec: detail.spec,
    mermaid: detail.mermaid,
  });
});

it("flags a solution that is itself a tweak of another design", async () => {
  vi.mocked(api.getSolution).mockResolvedValue({ ...detail, parentSolutionId: "origin-1" });
  renderDetail();

  const originLink = await screen.findByRole("link", { name: "Tweak of another design" });
  expect(originLink).toHaveAttribute("href", "/solutions/origin-1");
});
