/**
 * Setup for the `dom` project: Testing Library's matchers on `expect` (`toBeInTheDocument`,
 * `toHaveAttribute` and the rest), and an empty document again after every test.
 *
 * Testing Library unmounts by itself only where `afterEach` is a global, and Vitest's are not, so the
 * cleanup is registered here.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
