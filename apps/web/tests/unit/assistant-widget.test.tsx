import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AssistantWidget } from "@/components/assistant/assistant-widget";

/**
 * The support assistant's launcher, on the page that must not have one: the downloads Coming soon
 * screen shows its two words and nothing else (mobile spec 0004, AC-7). The API is stood in for at
 * its one read, answering that the assistant is on, so the launcher's absence there is the guard
 * and not the assistant being off.
 */
const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const api = vi.hoisted(() => ({ getAssistantConversation: vi.fn() }));
vi.mock("@/data/assistant", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data/assistant")>()),
  getAssistantConversation: api.getAssistantConversation,
}));

const LAUNCHER = "Ask the Injishi assistant";

beforeEach(() => {
  api.getAssistantConversation.mockReset();
  api.getAssistantConversation.mockResolvedValue({
    status: "ok",
    data: { enabled: true, conversation: null, claimable: false, greeting: "Hello", suggestions: [] },
  });
});

describe("AssistantWidget on the downloads pages", () => {
  test("with the assistant on, /downloads shows the launcher", async () => {
    route.pathname = "/downloads";
    render(<AssistantWidget />);

    expect(await screen.findByRole("button", { name: LAUNCHER })).toBeInTheDocument();
  });

  test("the Coming soon screen shows no launcher, even with the assistant on (AC-7)", async () => {
    route.pathname = "/downloads/coming-soon";
    render(<AssistantWidget />);

    await waitFor(() => expect(api.getAssistantConversation).toHaveBeenCalled());
    // Let the API's answer land before looking: the launcher appears only after it does.
    await act(async () => {});
    expect(screen.queryByRole("button", { name: LAUNCHER })).not.toBeInTheDocument();
  });
});
