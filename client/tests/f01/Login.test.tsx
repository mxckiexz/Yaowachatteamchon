import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const { status, body } = handler(url, init);
      return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("F-01 login screen (component)", () => {
  it("CT-01 / AC-10: shows the server error and keeps the e-mail when login fails", async () => {
    mockFetch((url) => {
      if (url.endsWith("/auth/me")) return { status: 401, body: { error: "Authentication required." } };
      return { status: 401, body: { error: "Invalid email or password." } };
    });
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    await userEvent.type(await screen.findByLabelText("E-mail"), "ploy@buyflow.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ploy@buyflow.test");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("CT-02 / AC-10: a successful login opens the app shell with the user's name and role", async () => {
    let loggedIn = false;
    mockFetch((url) => {
      if (url.endsWith("/auth/login")) {
        loggedIn = true;
        return { status: 200, body: { user: { id: 1, name: "Ploy", email: "ploy@buyflow.test", role: "EMPLOYEE" } } };
      }
      if (url.endsWith("/auth/me")) {
        return loggedIn
          ? { status: 200, body: { user: { id: 1, name: "Ploy", email: "ploy@buyflow.test", role: "EMPLOYEE" } } }
          : { status: 401, body: { error: "Authentication required." } };
      }
      return { status: 200, body: {} };
    });
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    await userEvent.type(await screen.findByLabelText("E-mail"), "ploy@buyflow.test");
    await userEvent.type(screen.getByLabelText("Password"), "ChangeMe123!");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.getByTestId("current-user")).toHaveTextContent("Ploy (Employee)"));
    expect(screen.queryByText("Review queue")).not.toBeInTheDocument();
  });

  it("CT-03 / AC-10: an anonymous visitor to a protected route is sent to the login screen", async () => {
    mockFetch(() => ({ status: 401, body: { error: "Authentication required." } }));
    render(<MemoryRouter initialEntries={["/requests"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});
