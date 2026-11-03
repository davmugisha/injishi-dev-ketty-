import { type Href, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Dialog,
  Field,
  Icon,
  IconTile,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  SearchBar,
  Text,
  TextArea,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { type AppKey, href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useAskSupport, useHelp } from "./data";
import type { Faq, SupportQuestion } from "./types";
import { Eyebrow, ListBones, useBackTo } from "./ui";

/** The guest screens that answer a question better than words. Guest app only. */
function guestTarget(opens: NonNullable<Faq["opens"]>): Href {
  switch (opens) {
    case "refund":
      return href("guest-refund");
    case "key":
      return href("guest-key");
    case "bill":
      return href("guest-bill");
  }
}

/** Where support's answers land: the app's inbox, where it has one. */
function inboxOf(app: AppKey): Href | null {
  if (app === "guest") return href("guest-inbox");
  if (app === "manager") return href("mgr-inbox");
  return null;
}

function matches(faq: Faq, words: string): boolean {
  const q = words.trim().toLowerCase();
  return !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
}

/**
 * Help and support (prototype `shared-help`, X6): search first, the common questions (a guest's open
 * the screen that solves them; the rest answer in place), then a message to Injishi support whose
 * answers land in the inbox, and the person's earlier questions.
 */
export function HelpScreen() {
  const surface = useSurface();
  const query = useHelp(surface);
  const ask = useAskSupport();
  const toast = useToast();
  const back = useBackTo(href("shared-account", undefined, { app: surface }));
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState("");
  const inbox = inboxOf(surface);

  const pressFaq = (faq: Faq) => {
    if (faq.opens && surface === "guest") {
      router.push(guestTarget(faq.opens));
      return;
    }
    setOpenFaq((id) => (id === faq.id ? null : faq.id));
  };

  const send = () => {
    ask.mutate(message, {
      onSuccess: () => {
        setWriting(false);
        setMessage("");
        toast.show({ icon: "PaperPlane", message: "Sent to Injishi support. The answer lands in your inbox." });
      },
    });
  };

  return (
    <Screen header={<NavBar title="Help" onBack={back} />}>
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading help" className="px-4 pt-2">
            <LoadingBone className="h-12 rounded-2xl" />
            <ListBones rows={4} />
            <LoadingBone className="h-24 rounded-3xl" />
            <LoadingBone className="h-12 rounded-full" />
          </LoadingView>
        }
      >
        {(view) => {
          const shown = view.faqs.filter((faq) => matches(faq, search));
          return (
            <View className="gap-4 px-4 pt-2">
              <SearchBar value={search} onChangeText={setSearch} placeholder="Search help" />
              {shown.length > 0 ? (
                <ListGroup>
                  {shown.map((faq) => {
                    const leads = faq.opens !== undefined && surface === "guest";
                    const expanded = openFaq === faq.id;
                    return (
                      <ListItem
                        key={faq.id}
                        title={faq.question}
                        subtitle={expanded ? faq.answer : undefined}
                        chevron={leads}
                        trailing={
                          leads ? undefined : (
                            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} tone="muted" />
                          )
                        }
                        onPress={() => pressFaq(faq)}
                        accessibilityLabel={
                          leads ? faq.question : `${faq.question}. ${expanded ? faq.answer : "Show the answer"}`
                        }
                      />
                    );
                  })}
                </ListGroup>
              ) : (
                <Card tone="flat">
                  <Text role="callout" tone="muted" className="text-center">
                    {`No answers match “${search.trim()}”. Ask support below; a person reads every message.`}
                  </Text>
                </Card>
              )}

              <Card>
                <View className="flex-row items-center gap-3.5">
                  <IconTile icon="LifeRing" size="lg" />
                  <View className="flex-1 gap-0.5">
                    <Text role="headline">Talk to Injishi support</Text>
                    <Text role="callout" tone="muted">
                      For the app and payments. Usually answered within a few hours.
                    </Text>
                  </View>
                </View>
              </Card>
              <Button icon="Comments" onPress={() => setWriting(true)}>
                Message support
              </Button>

              {view.questions.length > 0 ? (
                <View className="gap-2">
                  <Eyebrow className="mt-2">Your questions</Eyebrow>
                  <ListGroup>
                    {view.questions.map((q) => (
                      <QuestionRow key={q.id} question={q} inbox={inbox} />
                    ))}
                  </ListGroup>
                </View>
              ) : null}

              <Dialog
                isOpen={writing}
                onClose={() => setWriting(false)}
                icon="Comments"
                title="Message support"
                body="Tell us what happened. The answer lands in your inbox."
                actions={
                  <>
                    <Button isDisabled={message.trim().length < 3 || ask.isPending} onPress={send}>
                      Send
                    </Button>
                    <Button variant="ghost" onPress={() => setWriting(false)}>
                      Cancel
                    </Button>
                  </>
                }
              >
                <View className="self-stretch">
                  <Field label="Your message">
                    <TextArea
                      value={message}
                      onChangeText={setMessage}
                      placeholder="My MoMo payment shows twice"
                      autoFocus
                    />
                  </Field>
                </View>
              </Dialog>
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function QuestionRow({ question, inbox }: { question: SupportQuestion; inbox: Href | null }) {
  const answered = question.state === "answered";
  return (
    <ListItem
      icon="Comments"
      tone={answered ? "success" : "accent"}
      title={question.title}
      subtitle={question.detail}
      trailing={<Chip label={answered ? "Answered" : "Sent"} tone={answered ? "success" : "default"} />}
      onPress={inbox ? () => router.navigate(inbox) : undefined}
    />
  );
}
