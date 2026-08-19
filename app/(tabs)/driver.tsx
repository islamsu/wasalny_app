import { useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { trpc } from "@/lib/trpc";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useWasalnyState } from "@/lib/wasalny-state";

type VehicleChoice = "toktok" | "car";

const documents = [
  ["id", "بطاقة الرقم القومي", "صورة واضحة من الوجهين"],
  ["license", "رخصة القيادة", "سارية المفعول"],
  ["vehicle", "رخصة المركبة", "بيانات مطابقة للمركبة"],
  ["photos", "صور المركبة", "صورة أمامية وجانبية"],
  ["personal", "الصورة الشخصية", "صورة واضحة لوجهك"],
  ["payment", "إثبات دفع الاشتراك الشهري", "صورة إيصال فوري أو فودافون كاش أو إنستا باي"],
] as const;

export default function DriverScreen() {
  const colors = useColors();
  const { subscriptionStatus, driverOnline, fontScale, toggleDriverOnline } = useWasalnyState();
  const [vehicle, setVehicle] = useState<VehicleChoice | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { name: string; uri: string; mimeType?: string }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [offerInputs, setOfferInputs] = useState<Record<number, { price: string; eta: string }>>({});
  const driverRequestsQuery = trpc.rides.driverRequests.useQuery(undefined, { retry: false, refetchInterval: driverOnline ? 20_000 : false });
  const offerMutation = trpc.rides.offers.create.useMutation({ onSuccess: () => driverRequestsQuery.refetch() });
  const availabilityMutation = trpc.profile.availability.useMutation();
  const documentUploadMutation = trpc.driverDocuments.upload.useMutation();
  const uploadedCount = Object.keys(uploadedFiles).length;
  const complete = uploadedCount === documents.length;
  const statusLabel = useMemo(() => submitted ? "قيد مراجعة الإدارة" : complete ? "جاهز للإرسال" : "ارفع كل المستندات المطلوبة", [submitted, complete]);

  const pickDocument = async (id: string) => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadedFiles((current) => ({ ...current, [id]: { name: asset.name, uri: asset.uri, mimeType: asset.mimeType } }));
    if (Platform.OS !== "web") {
      const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      documentUploadMutation.mutate({ documentType: id, fileName: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", dataBase64 });
    }
  };

  return (
    <ScreenContainer className="p-5" safeAreaClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} style={{ transform: [{ scale: fontScale }] }}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>مساحة السائق</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>خليك سائق في وصلني</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>سجّل بياناتك مرة واحدة، وبعد موافقة الإدارة ابدأ تستقبل مشاوير بدون عمولة.</Text>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>نوع المركبة</Text>
        <View style={styles.vehicleRow}>
          {(["toktok", "car"] as VehicleChoice[]).map((item) => {
            const active = vehicle === item;
            return <Pressable key={item} onPress={() => setVehicle(item)} style={[styles.vehicleCard, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}><Text style={styles.vehicleEmoji}>{item === "toktok" ? "🛺" : "🚗"}</Text><Text style={[styles.vehicleTitle, { color: active ? "#FFFFFF" : colors.foreground }]}>{item === "toktok" ? "توك توك" : "سيارة"}</Text><Text style={[styles.vehicleMeta, { color: active ? "#DDF7E9" : colors.muted }]}>{item === "toktok" ? "٥٠ ج.م شهرياً" : "١٠٠ ج.م شهرياً"}</Text></Pressable>;
          })}
        </View>

        <View style={[styles.otpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.otpIcon, { backgroundColor: "#E8F5EE" }]}><Text>✓</Text></View><View style={styles.otpCopy}><Text style={[styles.otpTitle, { color: colors.foreground }]}>رقم الهاتف موثق</Text><Text style={[styles.otpText, { color: colors.muted }]}>010 1234 5678 · تم التحقق برسالة OTP</Text></View></View>

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>مستندات التحقق</Text><Text style={[styles.progress, { color: colors.primary }]}>{uploadedCount}/{documents.length}</Text></View>
        <Text style={[styles.uploadHint, { color: colors.muted }]}>اضغط على كل خانة لاختيار صورة أو ملف PDF من جهازك. لا يكفي تحديد الخانة فقط.</Text>
        {documents.map(([id, title, hint]) => {
          const file = uploadedFiles[id];
          const done = Boolean(file);
          return <Pressable key={id} onPress={() => pickDocument(id)} style={[styles.documentRow, { backgroundColor: colors.surface, borderColor: done ? colors.success : colors.border }]}><View style={[styles.documentStatus, { backgroundColor: done ? colors.success : colors.background }]}><Text style={{ color: done ? "#FFFFFF" : colors.primary, fontWeight: "800" }}>{done ? "✓" : "↑"}</Text></View><View style={styles.documentCopy}><Text style={[styles.documentTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.documentHint, { color: colors.muted }]}>{done ? `تم رفع: ${file.name}` : `${hint} · اضغط للرفع`}</Text></View></Pressable>;
        })}

        <View style={[styles.reviewCard, { backgroundColor: submitted ? "#FFF5DD" : "#E8F5EE" }]}><Text style={styles.reviewIcon}>{submitted ? "⏳" : "🛡️"}</Text><View style={styles.reviewCopy}><Text style={[styles.reviewTitle, { color: colors.foreground }]}>{statusLabel}</Text><Text style={[styles.reviewText, { color: colors.muted }]}>{submitted ? "هنراجع مستنداتك ونرد عليك قريباً." : "السائقين لا يمكنهم استقبال مشاوير قبل الموافقة."}</Text></View></View>
        <View style={[styles.subscriptionCard, { backgroundColor: subscriptionStatus === "approved" ? "#E8F5EE" : "#FFF5DD" }]}><Text style={styles.subscriptionIcon}>{subscriptionStatus === "approved" ? "✅" : "🔒"}</Text><View style={styles.subscriptionCopy}><Text style={[styles.subscriptionTitle, { color: colors.foreground }]}>{subscriptionStatus === "approved" ? "الاشتراك معتمد" : subscriptionStatus === "rejected" ? "الاشتراك مرفوض" : "استقبال المشاوير متوقف"}</Text><Text style={[styles.subscriptionText, { color: colors.muted }]}>{subscriptionStatus === "approved" ? "تقدر تستقبل طلبات الرحلات الآن." : "لا يمكن استقبال طلبات قبل اعتماد إيصال الاشتراك."}</Text></View><Pressable disabled={subscriptionStatus !== "approved"} onPress={async () => { const nextOnline = !driverOnline; if (!nextOnline) { availabilityMutation.mutate({ isOnline: false }, { onSuccess: toggleDriverOnline }); return; } const permission = await Location.requestForegroundPermissionsAsync(); if (permission.status !== "granted") return; const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); availabilityMutation.mutate({ isOnline: true, lat: location.coords.latitude, lng: location.coords.longitude }, { onSuccess: toggleDriverOnline }); }} style={[styles.onlineToggle, { backgroundColor: driverOnline ? colors.success : colors.surface, borderColor: subscriptionStatus === "approved" ? colors.success : colors.border }]}><Text style={[styles.onlineText, { color: driverOnline ? "#FFFFFF" : colors.muted }]}>{driverOnline ? "متصل" : "غير متصل"}</Text></Pressable></View>
        {vehicle === "car" && (driverRequestsQuery.data ?? []).length > 0 && <View style={[styles.requestsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>طلبات السيارات المفتوحة</Text>{(driverRequestsQuery.data ?? []).map((request) => { const input = offerInputs[request.id] ?? { price: "", eta: "" }; return <View key={request.id} style={[styles.requestRow, { borderTopColor: colors.border }]}><Text style={[styles.requestTitle, { color: colors.foreground }]}>{request.pickupLabel} ← {request.destinationLabel}</Text><Text style={[styles.requestMeta, { color: colors.muted }]}>رقم الرحلة {request.bookingCode}</Text><View style={styles.offerFields}><TextInput value={input.price} onChangeText={(price) => setOfferInputs((current) => ({ ...current, [request.id]: { ...input, price } }))} placeholder="السعر" keyboardType="number-pad" style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /><TextInput value={input.eta} onChangeText={(eta) => setOfferInputs((current) => ({ ...current, [request.id]: { ...input, eta } }))} placeholder="الدقائق" keyboardType="number-pad" style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} /><Pressable disabled={!input.price || !input.eta || offerMutation.isPending} onPress={() => offerMutation.mutate({ rideId: request.id, offeredPrice: Number(input.price), etaMinutes: Number(input.eta) })} style={[styles.offerButton, { backgroundColor: colors.primary }, (!input.price || !input.eta) && styles.disabled]}><Text style={styles.offerButtonText}>إرسال العرض</Text></Pressable></View></View>; })}</View>}
        <Pressable disabled={!vehicle || !complete || submitted} onPress={() => setSubmitted(true)} style={[styles.primaryButton, { backgroundColor: colors.primary }, (!vehicle || !complete || submitted) && styles.disabled]}><Text style={styles.primaryText}>{submitted ? "تم إرسال الطلب" : "إرسال للمراجعة"}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 36 }, requestsCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 }, requestRow: { borderTopWidth: 1, paddingTop: 12, gap: 6 }, requestTitle: { fontSize: 12, fontWeight: "800", textAlign: "right" }, requestMeta: { fontSize: 10, textAlign: "right" }, offerFields: { flexDirection: "row-reverse", gap: 6, alignItems: "center" }, offerInput: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, textAlign: "right", fontFamily: "Cairo_400Regular" }, offerButton: { borderRadius: 10, minHeight: 40, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, offerButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" }, subscriptionCard: { borderRadius: 18, padding: 13, flexDirection: "row-reverse", gap: 9, alignItems: "center" }, subscriptionIcon: { fontSize: 22 }, subscriptionCopy: { flex: 1, alignItems: "flex-end" }, subscriptionTitle: { fontSize: 12, fontWeight: "800" }, subscriptionText: { fontSize: 9, marginTop: 3, textAlign: "right" }, onlineToggle: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, onlineText: { fontSize: 10, fontWeight: "800" }, eyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right" }, title: { fontFamily: "Cairo_800ExtraBold", fontSize: 26, fontWeight: "800", textAlign: "right" }, subtitle: { fontSize: 13, lineHeight: 21, textAlign: "right", marginBottom: 10 }, sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, fontWeight: "800", textAlign: "right" }, vehicleRow: { flexDirection: "row-reverse", gap: 10 }, vehicleCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, alignItems: "center", gap: 4 }, vehicleEmoji: { fontSize: 28 }, vehicleTitle: { fontSize: 15, fontWeight: "800" }, vehicleMeta: { fontSize: 10 }, otpCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, otpIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, otpCopy: { flex: 1, alignItems: "flex-end" }, otpTitle: { fontSize: 13, fontWeight: "800" }, otpText: { fontSize: 10, marginTop: 3 }, sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 8 }, uploadHint: { fontSize: 10, lineHeight: 17, textAlign: "right", marginTop: -6 }, progress: { fontSize: 12, fontWeight: "800" }, documentRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, documentStatus: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" }, documentCopy: { flex: 1, alignItems: "flex-end" }, documentTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 13, fontWeight: "800" }, documentHint: { fontSize: 10, marginTop: 3, textAlign: "right" }, reviewCard: { borderRadius: 18, padding: 14, flexDirection: "row-reverse", gap: 10, alignItems: "center", marginTop: 3 }, reviewIcon: { fontSize: 24 }, reviewCopy: { flex: 1, alignItems: "flex-end" }, reviewTitle: { fontSize: 13, fontWeight: "800" }, reviewText: { fontSize: 10, marginTop: 3, textAlign: "right" }, primaryButton: { height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 4 }, primaryText: { fontFamily: "Cairo_700Bold", color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, disabled: { opacity: 0.45 } });
