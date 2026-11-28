// Component regression tests for the defects found by the partner team's independent Sprint 1 UAT (Lab 6).
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { ADMIN, REQUESTER, mockApi } from "../helpers";

afterEach(() => vi.unstubAllGlobals());

const draft = (over: Record<string, unknown> = {}) => ({
  id: 8,
  requestNumber: "PR-2026-0008",
  itemName: "Laser printer",
  description: "Office printer for floor 2",
  quantity: 2,
  unitPrice: 100.5,
  total: 201,
  reason: "The old one broke",
  category: "EQUIPMENT",
  status: "DRAFT",
  rejectionReason: null,
  requester: { id: ADMIN.id, name: ADMIN.name },
  createdAt: "2026-11-28T04:00:00.000Z",
  updatedAt: "2026-11-28T04:00:00.000Z",
  submittedAt: null,
  decidedAt: null,
  history: [{ id: 1, action: "CREATED", fromStatus: null, toStatus: "DRAFT", comment: null, createdAt: "2026-11-28T04:00:00.000Z", actor: { id: ADMIN.id, name: ADMIN.name } }],
  ...over,
});

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe("Lab 6 UAT defects (component)", () => {
  it("CT-L6-01 / DEF-03 (#69): an administrator who owns a draft sees it read-only, with no edit form and no Submit button", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: ADMIN } };
      if (url.endsWith("/requests/8")) return { status: 200, body: { request: draft() } };
    });
    renderAt("/requests/8");
    expect(await screen.findByTestId("total")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Edit draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit request" })).not.toBeInTheDocument();
  });

  it("CT-L6-02 / DEF-01 (#67): the request heading may break a long unbroken item name, so it cannot widen the page", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: REQUESTER } };
      if (url.endsWith("/requests/8")) return { status: 200, body: { request: draft({ itemName: "W".repeat(100), requester: { id: REQUESTER.id, name: REQUESTER.name }, status: "SUBMITTED" }) } };
    });
    renderAt("/requests/8");
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("W".repeat(100));
    // jsdom has no layout, so the real width is checked by e2e/quality/long-item-name.spec.ts; here the class that allows breaking is checked.
    expect(heading).toHaveClass("text-break");
  });
});
