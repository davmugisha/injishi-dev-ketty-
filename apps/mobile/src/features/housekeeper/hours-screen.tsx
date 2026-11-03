import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Icon,
  KeyValue,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  ProgressBar,
  Ring,
  Screen,
  Section,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useAskFix, useHours, useNewClaim, useSavePayslip } from "./data";
import type { ClaimLine, HoursView } from "./types";
import { Bones, backOr, ListBones, useStaffApp } from "./ui";

/**
 * `hk-hours` (S3, also the supervisor's and the technician's): hours against the month's target, a
 * missed clock-out to fix, the payslip broken down, then claims and the loan balance.
 */
export function HoursScreen() {
  const app = useStaffApp();
  const surface = useSurface();
  const query = useHours(app);
  return (
    <Screen
      header={
        <NavBar
          title="Hours and pay"
          subtitle={query.data?.month}
          onBack={() => backOr(href("hk-me", undefined, { app: surface }))}
        />
      }
    >
      <QueryView query={query} data={query.data} loading={<HoursLoading />}>
        {(hours) => <HoursBody hours={hours} />}
      </QueryView>
    </Screen>
  );
}

function HoursBody({ hours }: { hours: HoursView }) {
  const app = useStaffApp();
  const askFix = useAskFix(app);
  const savePayslip = useSavePayslip(app);
  const newClaim = useNewClaim(app);
  const toast = useToast();
  const pct = hours.target > 0 ? (hours.hours / hours.target) * 100 : 0;
  return (
    <View>
      <Card raised className="mx-4">
        <View className="flex-row items-center gap-3.5">
          <Ring value={pct} size={86} stroke={8} label={`${hours.hours} of ${hours.target} hours`}>
            <Text role="title3" strong tabular>
              {String(hours.hours)}
            </Text>
            <Text role="micro" tone="muted">
              {`of ${hours.target} h`}
            </Text>
          </Ring>
          <View className="flex-1">
            <Text role="headline" strong>
              {hours.status}
            </Text>
            <Text role="callout" tone="muted" className="mt-1">
              {hours.detail}
            </Text>
            <Text role="caption" tone="muted" className="mt-1">
              {hours.paid}
            </Text>
          </View>
        </View>
      </Card>
      {hours.missed ? (
        <Card tone="warning" className="mx-4 mt-3">
          <View className="flex-row items-start gap-3">
            <Icon name="TriangleExclamation" size={24} />
            <View className="flex-1">
              <Text role="headline" strong>
                {hours.missed.title}
              </Text>
              <Text role="callout" className="mt-1">
                {hours.missed.body}
              </Text>
            </View>
          </View>
          {hours.missed.asked ? (
            <View className="mt-3 flex-row items-center gap-2">
              <Icon name="Hourglass" size={16} />
              <Text role="callout" strong className="flex-1">
                Asked. The hours count once it is fixed.
              </Text>
            </View>
          ) : (
            <View className="mt-3">
              <Button
                variant="deep"
                isDisabled={askFix.isPending}
                onPress={() =>
                  askFix.mutate(undefined, {
                    onSuccess: () => toast.show({ icon: "PaperPlane", message: "Asked to fix the clock-out" }),
                  })
                }
              >
                {`Ask to fix · ${hours.missed.time}`}
              </Button>
            </View>
          )}
        </Card>
      ) : null}
      <Section
        title={hours.payslip.title}
        action={{
          label: hours.payslip.saved ? "Saved" : "Save PDF",
          onPress: () =>
            savePayslip.mutate(undefined, {
              onSuccess: () => toast.show({ icon: "FileArrowDown", message: `${hours.payslip.title} saved to this phone` }),
            }),
        }}
      />
      <Card className="mx-4" padding="sm">
        <KeyValue rows={hours.payslip.rows} total={{ label: "Net pay", value: hours.payslip.net }} />
      </Card>
      <Section title="Claims and loans" />
      <ListGroup className="mx-4">
        {hours.claims.map((claim) => (
          <ListItem
            key={claim.key}
            icon={claim.icon}
            tone={claim.tone}
            title={claim.title}
            subtitle={claim.subtitle}
            trailing={<ClaimEnd claim={claim} />}
          />
        ))}
      </ListGroup>
      <View className="mt-3 px-4">
        <Button
          variant="secondary"
          icon="Plus"
          isDisabled={newClaim.isPending}
          onPress={() =>
            newClaim.mutate(undefined, {
              onSuccess: () => toast.show({ icon: "FileText", message: "Claim started. Add what it was for." }),
            })
          }
        >
          New claim
        </Button>
      </View>
    </View>
  );
}

function ClaimEnd({ claim }: { claim: ClaimLine }) {
  if (claim.repaid !== null) {
    return <ProgressBar value={claim.repaid} size="thin" label={`${claim.repaid}% repaid`} className="w-16" />;
  }
  if (!claim.amount && !claim.chip) return null;
  return (
    <View className="items-end gap-1">
      {claim.amount ? (
        <Text role="callout" strong tabular>
          {claim.amount}
        </Text>
      ) : null}
      {claim.chip ? <Chip label={claim.chip.label} tone={claim.chip.tone} /> : null}
    </View>
  );
}

function HoursLoading() {
  return (
    <LoadingView label="Loading your hours">
      <Bones>
        <LoadingBone className="h-28 rounded-3xl" />
        <LoadingBone className="h-36 rounded-3xl" />
        <LoadingBone className="mt-2 h-5 w-40" />
        <LoadingBone className="h-48 rounded-3xl" />
        <ListBones rows={2} />
      </Bones>
    </LoadingView>
  );
}
