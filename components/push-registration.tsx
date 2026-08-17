import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

export function PushRegistration() {
  const { isAuthenticated } = useAuth();
  const register = trpc.push.register.useMutation();
  useEffect(() => {
    if (Platform.OS === "web" || !Device.isDevice || !isAuthenticated) return;
    let active = true;
    const registerToken = async () => {
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "طلبات وصلني", importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: "#137A5A" });
      const permissions = await Notifications.getPermissionsAsync();
      const finalStatus = permissions.status === "granted" ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
      if (finalStatus !== "granted") return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (active) await register.mutateAsync({ token, platform: Platform.OS === "ios" ? "ios" : "android" });
    };
    void registerToken().catch((error) => console.warn("[Push] registration failed", error));
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => { const url = response.notification.request.content.data?.url; if (typeof url === "string") router.push(url as any); });
    return () => { active = false; responseListener.remove(); };
  }, [isAuthenticated, register]);
  return null;
}
