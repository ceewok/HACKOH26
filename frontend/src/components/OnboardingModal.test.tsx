import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { getSession } from "../session";
import { OnboardingModal } from "./OnboardingModal";

it("requires a company for an industry pro and persists the completed identity", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  render(<OnboardingModal onComplete={onComplete} />);

  await user.click(screen.getByRole("radio", { name: /Industry Pro/ }));
  await user.type(screen.getByLabelText("Nickname"), "  Ada  ");
  await user.click(screen.getByRole("button", { name: "Enter the Hub" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Enter your company to join as an Industry Pro.",
  );

  await user.type(screen.getByLabelText("Company"), "  Honda  ");
  await user.click(screen.getByRole("button", { name: "Enter the Hub" }));

  expect(onComplete).toHaveBeenCalledWith({ role: "pro", nickname: "Ada", company: "Honda" });
  expect(getSession()).toEqual({ role: "pro", nickname: "Ada", company: "Honda" });
});
