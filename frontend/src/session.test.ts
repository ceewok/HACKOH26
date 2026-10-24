import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, getSession, setSession } from "./session";

describe("demo session", () => {
  beforeEach(() => {
    clearSession();
  });

  it("persists a pro identity with company across a reload-style read", () => {
    setSession({ role: "pro", nickname: "Ada", company: "Honda" });

    expect(getSession()).toEqual({ role: "pro", nickname: "Ada", company: "Honda" });
  });

  it("treats malformed or incomplete storage as no session", () => {
    localStorage.setItem("bridge-builder.session", "not json");
    expect(getSession()).toBeNull();

    localStorage.setItem("bridge-builder.session", JSON.stringify({ role: "student" }));
    expect(getSession()).toBeNull();

    localStorage.setItem("bridge-builder.session", JSON.stringify({ role: "pro", nickname: "Ada" }));
    expect(getSession()).toBeNull();

    for (const company of ["", "   "]) {
      localStorage.setItem(
        "bridge-builder.session",
        JSON.stringify({ role: "pro", nickname: "Ada", company }),
      );
      expect(getSession()).toBeNull();
    }
  });
});
