import { useCallback } from "react";
import { Alert } from "react-native";
import { sendOutbox } from "@/data/outbox";
import { unsentCount } from "@/data/outbox/store";
import { useSession } from "@/lib/session";

/**
 * Sign out, asking first when writes are still on the phone (mobile spec 0003, AC-9, D-k): "Send now"
 * sends and asks again; "Sign out anyway" deletes them with everything else the account left here.
 */
export function useSignOut(): () => void {
  const { account, signOut } = useSession();
  const userId = account?.userId;
  return useCallback(() => {
    const ask = () => {
      const unsent = userId ? unsentCount(userId) : 0;
      if (unsent === 0) {
        void signOut();
        return;
      }
      Alert.alert(
        "Sign out?",
        `${unsent === 1 ? "1 thing hasn't" : `${unsent} things haven't`} been sent. Signing out deletes ${unsent === 1 ? "it" : "them"}.`,
        [
          { text: "Send now", onPress: () => void sendOutbox("try_now").then(ask) },
          { text: "Sign out anyway", style: "destructive", onPress: () => void signOut() },
          { text: "Cancel", style: "cancel" },
        ],
      );
    };
    ask();
  }, [userId, signOut]);
}
