import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, test } from "vitest";

import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME } from "@/lib/theme";

/** The provider exactly as `src/app/providers.tsx` mounts it. */
function renderToggle(saved?: string) {
  if (saved) localStorage.setItem("theme", saved);
  return render(
    <ThemeProvider
      attribute="data-theme"
      themes={[THEME.light, THEME.dark]}
      defaultTheme={THEME.light}
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeToggle />
    </ThemeProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  test("in the light theme it offers dark, and pressing it paints the dark theme", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(await screen.findByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", THEME.dark);
    expect(localStorage.getItem("theme")).toBe(THEME.dark);
  });

  test("a saved dark theme is offered back to light once the toggle has mounted", async () => {
    renderToggle(THEME.dark);
    expect(await screen.findByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });
});
