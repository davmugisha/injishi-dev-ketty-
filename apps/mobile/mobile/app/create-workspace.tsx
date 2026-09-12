/**
 * `/create-workspace` — the dashed row at the foot of frame X4.
 *
 * A `FORM_SHEET` over the switcher: creating a business workspace is a flow
 * that lives on the web, and this is where the app says so.
 *
 * Registered by Session 11, which owns Account and the route table's Account
 * half. The screen lives in `src/screens/account/`; this is one line so `app/`
 * stays a route table.
 */
import { CreateWorkspaceSheet } from '@/screens/account';

export default function CreateWorkspaceRoute() {
  return <CreateWorkspaceSheet />;
}
