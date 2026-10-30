import { screenHref } from "@injishi/data";
import { ActionLink, EmptyBlock, PageContent } from "@injishi/ui";
import { currentAccount } from "@/lib/session";

/**
 * A screen or record that is not there, inside the workspace (2026-10-30): the workspace's own empty
 * state, in its own frame and theme, instead of Next's bare 404, whose dark-mode page turned the whole
 * window black around the sidebar.
 */
export default async function WorkspaceNotFound() {
  const account = await currentAccount();
  const home = account ? screenHref(account.persona.home) : "/sign-in";
  return (
    <PageContent>
      <EmptyBlock
        icon="Magnifier"
        title="This page is not here"
        description="The link may be old, or the record it points to was moved or removed. Your sidebar has every screen you can open."
        action={
          <ActionLink href={home} icon="ArrowLeft">
            Go to your home
          </ActionLink>
        }
      />
    </PageContent>
  );
}
