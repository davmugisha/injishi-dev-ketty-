import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";

/**
 * The dark-mode toggle button, as markup only.
 *
 * `data-theme-toggle` is the whole contract: <ThemeToggle/> listens once on
 * `document` and matches on that attribute, which is why this can stay a Server
 * Component with no handler of its own. Keep the attribute.
 *
 * Rendered identically by activate, verify-otp and claim-org. <AppShell/> keeps
 * its own copy: that one sits inside the shell's topbar and is not
 * interchangeable with this standalone button.
 */
export default function ThemeToggleButton() {
  return (
    <Button variant="ghost" size="icon" data-theme-toggle={""} aria-label={"Toggle dark mode"}>
      <Icon name="moon" className="h-5 w-5 dark:hidden" />
      <Icon name="sun" className="hidden h-5 w-5 dark:block" />
    </Button>
  );
}
