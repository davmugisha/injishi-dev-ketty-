import { Toast as HeroToast, useToast as useHeroToast } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";
import { haptic } from "@/lib/haptics";
import { Inverse } from "./ground";
import { Icon, type IconName } from "./icon";
import { PressArea } from "./press-area";
import { Text } from "./text";

export type ToastProps = {
  /** What happened, in a few words ("Returned · not sellable"). */
  message: string;
  icon?: IconName;
  /** `.toast .link`: one way to take it back ("Undo"). */
  action?: { label: string; onPress: () => void };
};

/**
 * `.toast`: a short confirmation on the inverted ground (the other theme's surface and ink), an
 * icon, the words and an optional accent link. This draws it in place (a screen showing a toast as
 * its state); `useToast().show(...)` floats one above the screen for a few seconds.
 */
export function Toast({ message, icon, action }: ToastProps) {
  return (
    <Inverse>
      <ToastBody message={message} icon={icon} action={action} />
    </Inverse>
  );
}

function ToastBody({ message, icon, action }: ToastProps) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-2xl bg-surface py-0.5 pl-3.5 pr-1 shadow-overlay">
      {icon ? <Icon name={icon} size={16} /> : null}
      <View className="flex-1 py-3" accessible accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text role="callout" strong>
          {message}
        </Text>
      </View>
      {action ? (
        <PressArea onPress={action.onPress} accessibilityRole="button" className="items-center justify-center px-2.5">
          <Text role="callout" strong tone="accent">
            {action.label}
          </Text>
        </PressArea>
      ) : (
        <View className="w-2.5" />
      )}
    </View>
  );
}

export type ShowToastOptions = ToastProps & {
  /** How long it stays, in ms. Default 4000; an action keeps it 6000 so there is time to reach it. */
  duration?: number;
  /** `success` and `error` buzz (D-r); a plain confirmation stays silent. */
  haptic?: "success" | "error";
};

/** How long a toast stays: a dwell, not a movement, so it is named here rather than on the motion scale. */
const DWELL = { plain: 4000, withAction: 6000 } as const;

/**
 * Floats a `Toast` above the screen, near the bottom and clear of a dock or a tab bar, through
 * HeroUI's toast layer (swipe to dismiss, stacking, Reduce Motion). The action hides the toast
 * after it runs.
 *
 * ```tsx
 * const toast = useToast();
 * toast.show({ icon: "ArrowUturnCcwLeft", message: "Returned · not sellable", action: { label: "Undo", onPress: undo } });
 * ```
 */
export function useToast() {
  const { toast } = useHeroToast();
  return useMemo(
    () => ({
      show({ duration, haptic: buzz, action, ...content }: ShowToastOptions): string {
        if (buzz) haptic[buzz]();
        return toast.show({
          duration: duration ?? (action ? DWELL.withAction : DWELL.plain),
          component: (props) => (
            <Inverse>
              <HeroToast {...props} placement="bottom" className="mb-16 bg-transparent p-0 shadow-none">
                <ToastBody
                  {...content}
                  action={
                    action
                      ? {
                          label: action.label,
                          onPress: () => {
                            action.onPress();
                            props.hide(props.id);
                          },
                        }
                      : undefined
                  }
                />
              </HeroToast>
            </Inverse>
          ),
        });
      },
      hide(id?: string) {
        toast.hide(id);
      },
    }),
    [toast],
  );
}
