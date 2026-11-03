import { useEffect, useRef, useState } from "react";
import { type ScrollViewInstance, View } from "react-native";
import {
  Bubble,
  Card,
  Composer,
  IconButton,
  LoadingBone,
  metrics,
  NavBar,
  Photo,
  Screen,
  Text,
  Timeline,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useMarkRepairRead, useRepairThread, useSendRepairMessage } from "./data";
import type { Message, RepairThread } from "./types";
import { backOr, CardBone, Skeleton, useNotify } from "./ui";

/**
 * `res-repair`: the request's status timeline and the conversation with management in one place,
 * including the visitor pass made for the trade. `?id=` picks the request (default the kitchen sink,
 * WO-345). Opening it reads its new messages; the composer sends words, the camera a photo.
 */
export function RepairScreen() {
  const { id } = useScreenParams("res-repair");
  const query = useRepairThread(id);
  const send = useSendRepairMessage();
  const { mutate: markRead } = useMarkRepairRead();
  const notify = useNotify();
  const [text, setText] = useState("");
  const scroll = useRef<ScrollViewInstance>(null);
  const thread = query.data;
  const threadId = thread?.id;
  const unread = thread?.unread ?? 0;

  // Opening the thread is reading it: its count leaves the Requests tab and Home's Message tile.
  useEffect(() => {
    if (threadId && unread > 0) markRead(threadId);
  }, [markRead, threadId, unread]);

  const toEnd = () => requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
  const sendText = () => {
    if (!threadId || !text.trim()) return;
    send.mutate(
      { id: threadId, text },
      {
        onSuccess: () => {
          setText("");
          toEnd();
        },
        onError: notify.failed,
      },
    );
  };
  const sendPhoto = () => {
    if (!threadId) return;
    send.mutate({ id: threadId, photo: true }, { onSuccess: toEnd, onError: notify.failed });
  };

  return (
    <Screen
      scrollRef={scroll}
      header={
        <NavBar
          title={thread?.title ?? "Repair"}
          subtitle={thread?.subtitle}
          onBack={() => backOr(href("res-requests"))}
        />
      }
      footer={
        thread ? (
          <Composer
            value={text}
            onChangeText={setText}
            onSend={sendText}
            isSending={send.isPending}
            placeholder={`Message ${thread.contact}`}
            leading={<IconButton icon="Camera" label="Send a photo" variant="plain" onPress={sendPhoto} />}
          />
        ) : undefined
      }
    >
      <QueryView query={query} data={thread} loading={<ThreadSkeleton />}>
        {(data) => <Thread thread={data} />}
      </QueryView>
    </Screen>
  );
}

function Thread({ thread }: { thread: RepairThread }) {
  return (
    <View className="gap-3 px-4">
      <Card>
        <Timeline steps={thread.steps} />
      </Card>
      <View className="mt-1 gap-2">
        {thread.messages.map((m) =>
          m.photo ? (
            <PhotoMessage key={m.id} message={m} />
          ) : (
            <Bubble key={m.id} from={m.from} text={m.text ?? ""} time={m.time} />
          ),
        )}
      </View>
    </View>
  );
}

/** A photo sent in the thread, on the sender's side, with when under it. */
function PhotoMessage({ message }: { message: Message }) {
  const mine = message.from === "me";
  return (
    <View className={`gap-1 ${mine ? "items-end" : "items-start"}`}>
      {message.photo ? (
        <Photo
          source={message.photo}
          width={metrics.photo.banner}
          height={metrics.photo.tile}
          radius="md"
          label={mine ? "Photo you sent" : "Photo from management"}
        />
      ) : null}
      <Text role="caption" tone="muted">
        {message.time}
      </Text>
    </View>
  );
}

function ThreadSkeleton() {
  return (
    <Skeleton label="Loading the request">
      <CardBone size="lg" />
      <LoadingBone className="h-16 w-3/4 self-end rounded-2xl" />
      <LoadingBone className="h-20 w-3/4 rounded-2xl" />
      <LoadingBone className="h-12 w-2/3 self-end rounded-2xl" />
    </Skeleton>
  );
}
