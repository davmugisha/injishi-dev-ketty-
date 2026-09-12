import { ConversationScreen } from "@/components/app/conversation-screen";

export const metadata = { title: "Conversation" };

/**
 * One conversation, at its own address (ADR-018, move 4).
 *
 * A thread is a record, so it gets a URL like every other record: you can send
 * somebody a link to the conversation rather than describing where it is.
 *
 * **It opens the real thread now** (ADR-032). What stood here told a guest the
 * thread "will open here once the messaging endpoints are live", with the id
 * printed for them — after they had pressed "track it in the kitchen chat" on an
 * order they had just placed. The ownership check is the API's: a thread that is
 * not this person's answers 404, never 403, so this screen cannot be used to
 * learn that an id exists.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return (
    <div className="min-h-0 grow scrollbar overflow-y-auto">
      <ConversationScreen threadId={threadId} />
    </div>
  );
}
