import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { ADMIN, APPROVER, REQUESTER, mockApi } from "../helpers";

afterEach(() => vi.unstubAllGlobals());

const detail = (over: Record<string, unknown> = {}) => ({
  id: 7,
  requestNumber: "PR-2026-0007",
  itemName: "Laser printer",
  description: "Office printer for floor 2",
  quantity: 2,
  unitPrice: 4500.5,
  total: 9001,
  reason: "The old one broke",
  category: "EQUIPMENT",
  status: "SUBMITTED",
  rejectionReason: null,
  requester: { id: 1, name: "Ploy" },
  createdAt: "2026-11-02T04:00:00.000Z",
  updatedAt: "2026-11-02T04:05:00.000Z",
  submittedAt: "2026-11-02T04:05:00.000Z",
  decidedAt: null,
  history: [
    { id: 1, action: "CREATED", fromStatus: null, toStatus: "DRAFT", comment: null, createdAt: "2026-11-02T04:00:00.000Z", actor: { id: 1, name: "Ploy" } },
    { id: 2, action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "SUBMITTED", comment: null, createdAt: "2026-11-02T04:05:00.000Z", actor: { id: 1, name: "Ploy" } },
  ],
  ...over,
});

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("request screens (component)", () => {
  it("CT-04 / AC-23: the form shows an estimated total and the server's messages beside the fields", async () => {
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: REQUESTER } };
      if (url.endsWith("/requests") && init?.method === "POST") {
        return { status: 422, body: { error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fields: { itemName: "Item name is required (at most 100 characters).", quantity: "Quantity must be a whole number from 1 to 1000." } } };
      }
    });
    renderAt("/requests/new");
    await userEvent.clear(await screen.findByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "2");
    await userEvent.type(screen.getByLabelText("Unit price (THB)"), "10.50");
    expect(screen.getByTestId("estimate")).toHaveTextContent("฿21.00");
    await userEvent.clear(screen.getByLabelText("Unit price (THB)"));
    await userEvent.type(screen.getByLabelText("Unit price (THB)"), "abc");
    expect(screen.getByTestId("estimate")).toHaveTextContent("฿0.00");
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Item name is required (at most 100 characters).")).toBeInTheDocument();
    expect(screen.getByText("Quantity must be a whole number from 1 to 1000.")).toBeInTheDocument();
  });

  it("CT-05 / AC-32: decision buttons appear only to an approver who is not the requester of a SUBMITTED request", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: REQUESTER } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail() } };
    });
    renderAt("/requests/7");
    expect(await screen.findByRole("heading", { name: /PR-2026-0007/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit request" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("history")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("CT-06 / AC-32: an approver sees the decision buttons; the requester's own approver account does not", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: APPROVER } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail({ requester: { id: 2, name: "Somchai" } }) } };
    });
    renderAt("/requests/7");
    await screen.findByRole("heading", { name: /PR-2026-0007/ });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("CT-07 / AC-32: a rejection asks for a reason and shows the server's refusal", async () => {
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: APPROVER } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail() } };
      if (url.endsWith("/requests/7/reject") && init?.method === "POST") {
        return { status: 422, body: { error: "A rejection needs a reason of at least 5 characters.", code: "REASON_REQUIRED" } };
      }
    });
    renderAt("/requests/7");
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(screen.getByText(/Reason \(required, at least 5 characters\)/)).toBeInTheDocument();
    expect(screen.getByText("PR-2026-0007", { selector: "strong" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Reason/), "no");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A rejection needs a reason of at least 5 characters.");
  });

  it("CT-08 / AC-32: a decided request has no decision buttons and shows the rejection reason", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: APPROVER } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail({ status: "REJECTED", rejectionReason: "Over budget", decidedAt: "2026-11-02T05:00:00.000Z" }) } };
    });
    renderAt("/requests/7");
    expect(await screen.findByTestId("rejection-reason")).toHaveTextContent("Over budget");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("CT-09 / AC-23: the owner of a draft edits it, and an incomplete submit shows the server's missing fields", async () => {
    let status = "DRAFT";
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: REQUESTER } };
      if (url.endsWith("/requests/7/submit") && init?.method === "POST") {
        return { status: 422, body: { error: "The request is incomplete.", code: "INCOMPLETE", fields: { reason: "Reason is required to submit.", category: "Category is required to submit." } } };
      }
      if (url.endsWith("/requests/7") && init?.method === "PATCH") {
        status = "DRAFT";
        return { status: 200, body: { request: detail({ status }) } };
      }
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail({ status: "DRAFT", reason: "", category: null, submittedAt: null }) } };
    });
    renderAt("/requests/7");
    expect(await screen.findByRole("region", { name: "Edit draft" })).toBeInTheDocument();
    expect(screen.getByLabelText("Item name")).toHaveValue("Laser printer");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByLabelText("Item name")).toHaveValue("Laser printer"));
    await userEvent.click(screen.getByRole("button", { name: "Submit request" }));
    const alert = await screen.findByText("The request is incomplete.");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Reason is required to submit.")).toBeInTheDocument();
    expect(screen.getByText("Category is required to submit.")).toBeInTheDocument();
  });

  it("CT-10: list screens show an empty state and an error state with Retry", async () => {
    let fail = true;
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: REQUESTER } };
      if (url.includes("/requests?scope=mine")) return fail ? { status: 500, body: { error: "Something went wrong." } } : { status: 200, body: { requests: [] } };
    });
    renderAt("/requests");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("You have no requests yet.")).toBeInTheDocument();
  });

  it("CT-11 / AC-32: a requester who opens /reviews, and an administrator who opens /requests, are sent to their own first screen", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: REQUESTER } };
      if (url.includes("/requests?scope=mine")) return { status: 200, body: { requests: [] } };
    });
    const first = renderAt("/reviews");
    expect(await screen.findByRole("heading", { name: "My requests" })).toBeInTheDocument();
    expect(screen.queryByText("Review queue")).not.toBeInTheDocument();
    first.unmount();
    vi.unstubAllGlobals();
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: ADMIN } };
      if (url.endsWith("/admin/users")) return { status: 200, body: { users: [] } };
    });
    renderAt("/requests");
    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
  });

  it("CT-12 / AC-44: the administrator's own row is locked and another user can be deactivated", async () => {
    let patched: unknown = null;
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: ADMIN } };
      if (url.endsWith("/admin/users/9") && init?.method === "PATCH") {
        patched = JSON.parse(String(init.body));
        return { status: 200, body: { user: { id: 9, name: "Nattapong", email: "n@purchaseflow.test", role: "REQUESTER", isActive: false, createdAt: "2026-11-01T00:00:00.000Z" } } };
      }
      if (url.endsWith("/admin/users")) {
        return { status: 200, body: { users: [
          { id: 3, name: "Admin", email: "admin@purchaseflow.test", role: "ADMIN", isActive: true, createdAt: "2026-11-01T00:00:00.000Z" },
          { id: 9, name: "Nattapong", email: "n@purchaseflow.test", role: "REQUESTER", isActive: true, createdAt: "2026-11-01T00:00:00.000Z" },
        ] } };
      }
    });
    renderAt("/admin/users");
    expect(await screen.findByText("Your own account cannot be changed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate Admin" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Deactivate Nattapong" }));
    expect(await screen.findByTestId("status-9")).toHaveTextContent("Inactive");
    expect(patched).toEqual({ isActive: false });
  });
});
