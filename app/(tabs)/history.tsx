import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useWasalnyState } from "@/lib/wasalny-state";
import { trpc } from "@/lib/trpc";

const rides: { id: string; date: string; route: string; vehicle: string; fare: string; status: string; time: string }[] = [];

export default function HistoryScreen() {
  const colors = useColors();
  const { fontScale } = useWasalnyState();
  const [selected, setSelected] = useState<(typeof rides)[number] | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const me = trpc.auth.me.useQuery();
  useEffect(() => { setSelected(null); }, [me.data?.id]);
  const historyQuery = trpc.rides.mine.useQuery(undefined, { retry: false, refetchInterval: 10_000 });
  const displayedRides = historyQuery.data?.map((ride) => ({ id: String(ride.id), date: new Date(ride.requestedAt).toLocaleDateString("ar-EG"), route: `${ride.pickupLabel} ← ${ride.destinationLabel}`, vehicle: ride.vehicleType === "toktok" ? "توك توك" : "سيارة", fare: ride.estimatedFare == null ? "لم يحدد السعر" : `${ride.estimatedFare} ج.م`, status: ride.status === "completed" ? "مكتمل" : ride.status === "cancelled" ? "ملغى" : "قيد التنفيذ", time: new Date(ride.requestedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) })) ?? rides;

  return <ScreenContainer className="p-5" safeAreaClassName="bg-background"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} style={{ transform: [{ scale: fontScale }] }}>
    <Text style={[styles.eyebrow, { color: colors.primary }]}>رحلاتك</Text>
    <Text style={[styles.title, { color: colors.foreground }]}>سجل المشاوير</Text>
    <Text style={[styles.subtitle, { color: colors.muted }]}>كل مشاويرك وتفاصيلها في مكان واحد</Text>
    {historyQuery.error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{historyQuery.error.message}</Text>}
    <Text style={{ color: colors.muted }}>{historyQuery.isLoading ? "جاري التحميل…" : `${displayedRides.length} مشوار`}</Text>
    <View style={styles.filterRow}><Text style={[styles.filterActive, { color: colors.primary, borderColor: colors.primary }]}>كل المشاوير</Text><Text style={[styles.filter, { color: colors.muted }]}>هذا الشهر</Text></View>
    {displayedRides.map((ride) => <Pressable key={ride.id} onPress={() => { setSelected(ride); setDownloaded(false); }} style={({ pressed }) => [styles.rideCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.75 }]}><View style={[styles.vehicleIcon, { backgroundColor: "#E8F5EE" }]}><Text style={styles.vehicleEmoji}>{ride.vehicle === "سيارة" ? "🚗" : "🛺"}</Text></View><View style={styles.rideCopy}><Text style={[styles.route, { color: colors.foreground }]}>{ride.route}</Text><Text style={[styles.rideMeta, { color: colors.muted }]}>{ride.date} · {ride.time}</Text><View style={styles.rideBottom}><Text style={[styles.status, { color: colors.success }]}>● {ride.status}</Text><Text style={[styles.vehicle, { color: colors.muted }]}>{ride.vehicle} · نقدي</Text></View></View><View style={styles.fareBlock}><Text style={[styles.fare, { color: colors.foreground }]}>{ride.fare}</Text><Text style={[styles.arrow, { color: colors.primary }]}>‹</Text></View></Pressable>)}
  </ScrollView>
  <Modal transparent animationType="slide" visible={Boolean(selected)} onRequestClose={() => setSelected(null)}>
    <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <View style={styles.handle} /><Text style={[styles.eyebrow, { color: colors.primary }]}>تفاصيل المشوار</Text>
      <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{selected?.route}</Text>
      <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>{selected?.date} · {selected?.time}</Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>{selected?.status} · {selected?.fare}</Text>
      <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>تنزيل الإيصال غير متاح حالياً</Text>
      <Pressable onPress={() => setSelected(null)} style={styles.closeButton}><Text style={[styles.closeText, { color: colors.muted }]}>إغلاق</Text></Pressable>
    </View></View>
  </Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 30 }, eyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right" }, title: { fontFamily: "Cairo_800ExtraBold", fontSize: 26, fontWeight: "800", textAlign: "right" }, subtitle: { fontSize: 13, textAlign: "right", marginTop: -6, marginBottom: 8 }, statsCard: { borderRadius: 20, padding: 17, flexDirection: "row-reverse", justifyContent: "space-around", alignItems: "center" }, statsLabel: { color: "#DDF7E9", fontSize: 11, textAlign: "center" }, statsValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 5 }, statsDivider: { width: 1, height: 38, backgroundColor: "rgba(255,255,255,0.35)" }, filterRow: { flexDirection: "row-reverse", gap: 22, alignItems: "center" }, filterActive: { fontSize: 12, fontWeight: "800", paddingBottom: 7, borderBottomWidth: 2 }, filter: { fontSize: 12, fontWeight: "700" }, rideCard: { borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row-reverse", gap: 10, alignItems: "center" }, vehicleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, vehicleEmoji: { fontSize: 23 }, rideCopy: { flex: 1, alignItems: "flex-end" }, route: { fontFamily: "Cairo_600SemiBold", fontSize: 13, fontWeight: "800", textAlign: "right" }, rideMeta: { fontSize: 10, marginTop: 4 }, rideBottom: { flexDirection: "row-reverse", gap: 10, marginTop: 7 }, status: { fontSize: 10, fontWeight: "700" }, vehicle: { fontSize: 10 }, fareBlock: { alignItems: "center", gap: 4 }, fare: { fontSize: 13, fontWeight: "800" }, arrow: { fontSize: 24, transform: [{ rotate: "180deg" }] }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,26,18,0.35)" }, sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, minHeight: 430 }, handle: { width: 42, height: 5, borderRadius: 4, backgroundColor: "#B7C7BE", alignSelf: "center", marginBottom: 20 }, sheetTitle: { fontSize: 22, fontWeight: "800", textAlign: "right", marginTop: 5 }, sheetSubtitle: { fontSize: 12, textAlign: "right", marginTop: 4 }, routeBox: { borderWidth: 1, borderRadius: 18, padding: 15, marginTop: 20 }, detailRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 }, dot: { width: 11, height: 11, borderRadius: 6 }, detailCopy: { flex: 1, alignItems: "flex-end" }, detailLabel: { fontSize: 10 }, detailValue: { fontSize: 14, fontWeight: "800", marginTop: 3 }, routeLine: { height: 23, width: 2, marginRight: 4, marginVertical: 3 }, totalRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 18, borderBottomWidth: 1 }, totalLabel: { fontSize: 12 }, totalValue: { fontSize: 18, fontWeight: "800" }, primaryButton: { height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 20 }, primaryText: { fontFamily: "Cairo_700Bold", color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, closeButton: { alignItems: "center", paddingVertical: 13 }, closeText: { fontSize: 13, fontWeight: "700" } });
