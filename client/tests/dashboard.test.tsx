import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { ADMIN, APPROVER, REQUESTER, mockApi } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

function renderDashboard(user: typeof REQUESTER) {
  mockApi((url) => {
    if (url.endsWith("/auth/me")) return { status: 200, body: { user } };
    if (url.endsWith("/dashboard")) return { status: 200, body: { counts: { DRAFT: 1, SUBMITTED: 2, APPROVED: 3, REJECTED: 4, CANCELLED: 5 }, ...(user.role === "APPROVER" ? { reviewWaiting: 6 } : {}) } };
    return { status: 404, body: { error: "not found" } };
  });
  return render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>);
}

describe("F-08 dashboard", () => {
  it("CT-08 / AC-107: requester sees five labelled cards and exact filtered links", async () => {
    renderDashboard(REQUESTER);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    for (const status of ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]) {
      const link = screen.getByRole("link", { name: new RegExp(status) });
      expect(link).toHaveAttribute("href", `/requests?status=${status}`);
    }
    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
  });

  it("CT-09 / AC-102, AC-107: approver sees own cards and waiting-for-review card", async () => {
    renderDashboard(APPROVER);
    expect(await screen.findByRole("heading", { name: "My requests" })).toBeInTheDocument();
    const waiting = (await screen.findByRole("heading", { name: "Waiting for review" })).parentElement!;
    expect(within(waiting).getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /SUBMITTED from other users/ })).toHaveAttribute("href", "/reviews");
  });

  it("CT-10 / AC-103: administrator cards link to all requests", async () => {
    renderDashboard(ADMIN);
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(screen.getByRole("link", { name: /APPROVED/ })).toHaveAttribute("href", "/all-requests?status=APPROVED");
  });
});
