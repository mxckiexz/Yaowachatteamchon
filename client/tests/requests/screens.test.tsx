import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import App from "../../src/App";
import { APPROVER, EMPLOYEE, mockApi } from "../helpers";

afterEach(() => vi.unstubAllGlobals());

const detail = (over: Record<string, unknown> = {}) => ({
  id: 7,
  title: "Printer paper",
  justification: "Stock is empty",
  status: "PENDING",
  total: 261,
  items: [{ id: 1, name: "A4 paper box", quantity: 2, unitPrice: 100.5 }],
  requester: { id: 1, name: "Ploy" },
  approver: { id: 2, name: "Somchai" },
  createdAt: "2026-11-02T04:00:00.000Z",
  submittedAt: "2026-11-02T04:05:00.000Z",
  decidedAt: null,
  decisionComment: null,
  history: [
    { id: 1, action: "CREATED", fromStatus: null, toStatus: "DRAFT", comment: null, createdAt: "2026-11-02T04:00:00.000Z", actor: { id: 1, name: "Ploy" } },
    { id: 2, action: "SUBMITTED", fromStatus: "DRAFT", toStatus: "PENDING", comment: null, createdAt: "2026-11-02T04:05:00.000Z", actor: { id: 1, name: "Ploy" } },
  ],
  ...over,
});

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("request screens (component)", () => {
  it("CT-04 / AC-18: the new request form adds and removes rows, shows an estimate and server field errors", async () => {
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: EMPLOYEE } };
      if (url.endsWith("/requests") && init?.method === "POST") {
        return { status: 422, body: { error: "Please correct the highlighted fields.", code: "VALIDATION_ERROR", fields: { title: "Title must be 3 to 120 characters.", "items.0.quantity": "Quantity must be a whole number from 1 to 1000." } } };
      }
    });
    renderAt("/requests/new");
    await userEvent.type(await screen.findByLabelText("Item name 1"), "Pen");
    await userEvent.clear(screen.getByLabelText("Quantity 1"));
    await userEvent.type(screen.getByLabelText("Quantity 1"), "2");
    await userEvent.type(screen.getByLabelText("Unit price 1"), "10.50");
    expect(screen.getByTestId("estimate")).toHaveTextContent("฿21.00");

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    await userEvent.type(screen.getByLabelText("Unit price 2"), "5");
    expect(screen.getByTestId("estimate")).toHaveTextContent("฿26.00");
    await userEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
    expect(screen.getByTestId("estimate")).toHaveTextContent("฿21.00");
    expect(screen.getByRole("button", { name: "Remove item 1" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Title must be 3 to 120 characters.")).toBeInTheDocument();
    expect(screen.getByText("Quantity must be a whole number from 1 to 1000.")).toBeInTheDocument();
  });

  it("CT-05 / AC-32: decision buttons appear only to the assigned approver of a PENDING request", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: EMPLOYEE } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail() } };
    });
    renderAt("/requests/7");
    expect(await screen.findByRole("heading", { name: "Printer paper" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("history")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("CT-06 / AC-32: a rejection asks for a reason and shows the server's refusal", async () => {
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: APPROVER } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail() } };
      if (url.endsWith("/requests/7/decision") && init?.method === "POST") {
        return { status: 422, body: { error: "A rejection needs a reason of at least 5 characters.", code: "REASON_REQUIRED" } };
      }
    });
    renderAt("/requests/7");
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(screen.getByText(/Reason \(required, at least 5 characters\)/)).toBeInTheDocument();
    expect(screen.getByText("Printer paper", { selector: "strong" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Reason/), "no");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A rejection needs a reason of at least 5 characters.");
  });

  it("CT-07 / AC-32: a decided request has no decision buttons and shows the decision comment", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: APPROVER } };
      if (url.endsWith("/requests/7")) return { status: 200, body: { request: detail({ status: "REJECTED", decisionComment: "Over budget", decidedAt: "2026-11-02T05:00:00.000Z" }) } };
    });
    renderAt("/requests/7");
    expect(await screen.findByTestId("decision-comment")).toHaveTextContent("Over budget");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("CT-08 / AC-18: the owner of a DRAFT chooses an approver and submits", async () => {
    let submitted = false;
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: EMPLOYEE } };
      if (url.endsWith("/approvers")) return { status: 200, body: { approvers: [{ id: 2, name: "Somchai" }] } };
      if (url.endsWith("/requests/7/submit") && init?.method === "POST") {
        submitted = true;
        return { status: 200, body: { request: detail() } };
      }
      if (url.endsWith("/requests/7")) {
        return { status: 200, body: { request: submitted ? detail() : detail({ status: "DRAFT", approver: null, submittedAt: null }) } };
      }
    });
    renderAt("/requests/7");
    const submit = await screen.findByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Approver"), "Somchai");
    await userEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument());
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
  });

  it("CT-09: list screens show an empty state and an error state with Retry", async () => {
    let fail = true;
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: EMPLOYEE } };
      if (url.endsWith("/requests")) return fail ? { status: 500, body: { error: "Something went wrong." } } : { status: 200, body: { requests: [] } };
    });
    renderAt("/requests");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("You have no requests yet.")).toBeInTheDocument();
  });

  it("CT-10 / AC-32: an employee who opens /reviews is sent back to the list", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { status: 200, body: { user: EMPLOYEE } };
      if (url.endsWith("/requests")) return { status: 200, body: { requests: [] } };
    });
    renderAt("/reviews");
    expect(await screen.findByRole("heading", { name: "My requests" })).toBeInTheDocument();
    expect(screen.queryByText("Review queue")).not.toBeInTheDocument();
  });
});
