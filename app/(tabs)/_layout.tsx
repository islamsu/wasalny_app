import { Redirect, Tabs, useSegments } from "expo-router";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { canAccessRoleRoute, homeRouteForRole, isAppRole, roleRouteFromSegments } from "@/lib/role-routing";

export default function TabLayout() {
  const colors = useColors();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  if (me.isLoading) {
    return <View accessibilityRole="progressbar" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.muted }}>جارٍ تحميل حسابك…</Text>
    </View>;
  }
  if (!me.data) return <Redirect href="/login" />;
  if (!isAppRole(me.data.appRole)) {
    return <View accessibilityRole="alert" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background }}>
      <Text style={{ color: colors.error, textAlign: "center" }}>لا يمكن فتح التطبيق لأن صلاحية الحساب غير معروفة. تواصل مع الدعم.</Text>
    </View>;
  }

  const role = me.data.appRole;
  const requestedRoute = roleRouteFromSegments(segments);
  if (!canAccessRoleRoute(role, requestedRoute)) return <Redirect href={homeRouteForRole(role)} />;

  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerShown: false, tabBarButton: HapticTab, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.5 }, tabBarLabelStyle: { fontSize: 10, fontWeight: "700" } }}>
    <Tabs.Screen name="index" options={{ href: role === "family" ? "/" : null, title: "الرئيسية", tabBarIcon: ({ color }) => <IconSymbol size={23} name="house.fill" color={color} /> }} />
    <Tabs.Screen name="history" options={{ href: role === "family" ? "/history" : null, title: "المشاوير", tabBarIcon: ({ color }) => <IconSymbol size={23} name="clock.fill" color={color} /> }} />
    <Tabs.Screen name="driver" options={{ href: role === "driver" ? "/driver" : null, title: "السائق", tabBarIcon: ({ color }) => <IconSymbol size={23} name="person.fill" color={color} /> }} />
    <Tabs.Screen name="admin" options={{ href: role === "admin" ? "/admin" : null, title: "الإدارة", tabBarIcon: ({ color }) => <IconSymbol size={23} name="person.fill" color={color} /> }} />
  </Tabs>;
}
