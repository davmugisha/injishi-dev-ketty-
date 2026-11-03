import { useEffect, useRef, useState } from "react";
import { type ScrollViewInstance, View } from "react-native";
import {
  Bubble,
  Card,
  Composer,
  Icon,
  IconButton,
  IconTile,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useChatThread, useMarkThreadRead, useSendMessage } from "./data";
import type { ChatItem, ChatThread } from "./types";
import { backOr, callPhone, openScreen, REQUEST_LOOK, RequestChip } from "./ui";

/**
 * A thread with a desk (the front desk by default). Messages that became requests show their live status
 * inside the conversation, so nothing is lost between chat and service. Sending appends to the thread.
 */
export function ChatScreen() {
  const { thread } = useScreenParams("guest-chat");
  const chat = useChatThread(thread);
  const send = useSendMessage();
  const { mutate: markRead } = useMarkThreadRead();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollViewInstance>(null);
  const count = chat.data?.items.length ?? 0;

  // Opening the thread reads it, so the inbox's unread count clears.
  useEffect(() => {
    markRead(thread);
  }, [markRead, thread]);

  // The newest message stays in view: on opening and after each one sent.
  useEffect(() => {
    if (count === 0) return;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [count]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    send.mutate(
      { thread, text },
      {
        onSuccess: () => setDraft(""),
        onError: () => toast.show({ icon: "CloudSlash", message: "Not sent. Try again in a moment.", haptic: "error" }),
      },
    );
  };

  const data = chat.data;
  return (
    <Screen
      scrollRef={scrollRef}
      header={
        <NavBar
          title={data?.name ?? "Messages"}
          subtitle={data?.subtitle}
          onBack={() => backOr(href("guest-inbox"))}
          right={
            data?.phone ? (
              <IconButton
                icon="Handset"
                label={`Call ${data.name}`}
                variant="plain"
                onPress={() => callPhone(data.phone ?? "")}
              />
            ) : undefined
          }
        />
      }
      footer={
        data ? (
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSend={submit}
            isSending={send.isPending}
            placeholder={data.composerHint}
            leading={
              <IconButton
                icon="Camera"
                label="Add a photo"
                variant="plain"
                onPress={() => toast.show({ icon: "Camera", message: "Your camera opens here on the phone." })}
              />
            }
          />
        ) : undefined
      }
    >
      <QueryView offlineNote={null} query={chat} data={data} loading={<ChatBones />}>
        {(thread) => <Thread thread={thread} />}
      </QueryView>
    </Screen>
  );
}

function Thread({ thread }: { thread: ChatThread }) {
  if (thread.items.length === 0) {
    return (
      <View className="grow items-center justify-center gap-3 px-8 py-10">
        <Icon name="Comments" size={32} tone="muted" />
        <Text role="callout" tone="muted" className="text-center">
          Ask {thread.name.toLowerCase()} anything. Staff reply here themselves, usually within 15 minutes.
        </Text>
      </View>
    );
  }
  return (
    <View className="gap-2 px-4 pt-1.5">
      <Text role="caption" tone="muted" strong caps className="py-1 text-center">
        {thread.day}
      </Text>
      {thread.items.map((item) => (
        <ThreadItem key={item.id} item={item} />
      ))}
    </View>
  );
}

function ThreadItem({ item }: { item: ChatItem }) {
  if (item.kind === "message") return <Bubble from={item.from} text={item.text} time={item.meta} />;
  const look = REQUEST_LOOK[item.status];
  return (
    // As wide as a bubble at most, on the desk's side: the request is the desk's answer.
    <View className="self-start" style={{ maxWidth: "82%" }}>
      <Card
        padding="sm"
        onPress={() => openScreen(href("guest-requests"))}
        accessibilityLabel={`Request ${item.title}, ${item.detail}, ${look.label}. Opens your requests`}
      >
        <View className="flex-row items-center gap-3">
          <IconTile icon={item.icon} tone={look.tone} />
          <View className="shrink gap-0.5">
            <Text role="callout" strong>
              {item.title}
            </Text>
            <Text role="caption" tone="muted">
              {item.detail}
            </Text>
          </View>
          <RequestChip status={item.status} />
        </View>
      </Card>
    </View>
  );
}

function ChatBones() {
  return (
    <LoadingView label="Loading the conversation" className="px-4 pt-2">
      <LoadingBone className="h-3 w-1/5 self-center" />
      <LoadingBone className="h-14 w-3/5 self-end rounded-2xl" />
      <LoadingBone className="h-20 w-2/3 rounded-2xl" />
      <LoadingBone className="h-16 w-3/5 rounded-3xl" />
      <LoadingBone className="h-14 w-1/2 self-end rounded-2xl" />
    </LoadingView>
  );
}
