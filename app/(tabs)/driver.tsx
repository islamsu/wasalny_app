import { useEffect, useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { trpc } from "@/lib/trpc";
import { pendingOperation } from "@/lib/pending-operation";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useWasalnyState } from "@/lib/wasalny-state";

type VehicleChoice = "toktok" | "car";
const DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

function getDocumentMimeType(fileName: string, mimeType?: string): DocumentMimeType | null {
  if (DOCUMENT_MIME_TYPES.includes(mimeType as DocumentMimeType)) return mimeType as DocumentMimeType;
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "pdf") return "application/pdf";
  return null;
}

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
  const { fontScale } = useWasalnyState();
  const me = trpc.auth.me.useQuery();
  const onboarding = trpc.profile.onboarding.useQuery(undefined, { enabled: me.data?.appRole === "driver", retry: false, refetchInterval: 10_000 });
  const documentsQuery = trpc.driverDocuments.listMine.useQuery(undefined, { enabled: me.data?.appRole === "driver", retry: false });
  const ensure = trpc.profile.ensureDriver.useMutation();
  const submit = trpc.profile.submitOnboarding.useMutation();
  const currentRides = trpc.rides.current.useQuery(undefined, { enabled: me.data?.appRole === "driver", retry: false, refetchInterval: 5000 });
  const currentRide = { ...currentRides, data: currentRides.data?.[0] };
  const statusMutation = trpc.rides.status.useMutation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const profile = onboarding.data?.profile;
  const subscriptionStatus = profile?.subscriptionStatus ?? "unpaid";
  const driverOnline = profile?.isOnline ?? false;
  const [vehicle, setVehicle] = useState<VehicleChoice | null>(null);
  const latestDocuments = [...(documentsQuery.data ?? [])].sort((a, b) => b.id - a.id).filter((d, index, all) => all.findIndex((item) => item.documentType === d.documentType) === index);
  const uploadedFiles = Object.fromEntries(latestDocuments.filter((d) => d.status !== "rejected" && (!d.expiresAt || new Date(d.expiresAt).getTime() > Date.now())).map((d) => [d.documentType, { name: d.fileName }]));
  const submitted = onboarding.data?.submitted ?? false;
  const [offerInputs, setOfferInputs] = useState<Record<number, { price: string; eta: string }>>({});
  useEffect(() => {
    setVehicle(null); setVehicleNumber(""); setExpiry({}); setOfferInputs({}); setError("");
  }, [me.data?.id]);
  const driverRequestsQuery = trpc.rides.driverRequests.useQuery(undefined, { enabled: me.data?.appRole === "driver" && driverOnline, retry: false, refetchInterval: driverOnline ? 10_000 : false });
  const offerMutation = trpc.rides.offers.create.useMutation({ onSuccess: () => driverRequestsQuery.refetch() });
  const availabilityMutation = trpc.profile.availability.useMutation();
  const documentUploadMutation = trpc.driverDocuments.upload.useMutation();
  const uploadedCount = Object.keys(uploadedFiles).length;
  const complete = uploadedCount === documents.length;
  const statusLabel = useMemo(() => submitted ? "قيد مراجعة الإدارة" : complete ? "جاهز للإرسال" : "ارفع كل المستندات المطلوبة", [submitted, complete]);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); await Promise.all([onboarding.refetch(), documentsQuery.refetch(), currentRide.refetch()]); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر الحفظ"); }
    finally { setBusy(false); }
  };
  const pickDocument = (id: (typeof documents)[number][0]) => run(async () => {
    if (!vehicle && !profile?.vehicleType) throw new Error("اختر نوع المركبة أولاً");
    let expiresAt: string | undefined;
    if (["id", "license", "vehicle"].includes(id)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry[id] ?? "")) throw new Error("أدخل تاريخ الانتهاء YYYY-MM-DD");
      const date = new Date(`${expiry[id]}T23:59:59.000Z`);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error("تاريخ الانتهاء يجب أن يكون في المستقبل");
      expiresAt = date.toISOString();
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = getDocumentMimeType(asset.name, asset.mimeType);
    if (!mimeType) {
      Alert.alert("نوع ملف غير مدعوم", "اختر صورة JPG أو PNG أو ملف PDF.");
      return;
    }
    if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error("الحد الأقصى 10 ميجابايت");
    await ensure.mutateAsync({ vehicleType: vehicle ?? profile!.vehicleType });
    let dataBase64: string;
    if (Platform.OS === "web") {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("تعذر قراءة الملف");
      const blob = await response.blob();
      dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(blob);
      });
    } else {
      dataBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    }
    await documentUploadMutation.mutateAsync({ documentType: id, fileName: asset.name, mimeType, dataBase64, expiresAt });
  });

  return (
    <ScreenContainer className="p-5" safeAreaClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} style={{ transform: [{ scale: fontScale }] }}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>مساحة السائق</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>خليك سائق في وصلني</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>سجّل بياناتك مرة واحدة، وبعد موافقة الإدارة ابدأ تستقبل مشاوير بدون عمولة.</Text>
        {!!(error || onboarding.error || documentsQuery.error || currentRide.error || availabilityMutation.error || offerMutation.error) && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error || onboarding.error?.message || documentsQuery.error?.message || currentRide.error?.message || availabilityMutation.error?.message || offerMutation.error?.message}</Text>}
        {busy && <Text style={{ color: colors.muted }}>جاري الحفظ…</Text>}
        <TextInput value={vehicleNumber} onChangeText={setVehicleNumber} placeholder={profile?.vehicleNumber || "رقم لوحة المركبة"} style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border }]} />
        {["id", "license", "vehicle"].map((id) => <TextInput key={id} value={expiry[id] ?? ""} onChangeText={(value) => setExpiry((prev) => ({ ...prev, [id]: value }))} placeholder={`انتهاء ${documents.find((d) => d[0] === id)?.[1]} YYYY-MM-DD`} style={[styles.offerInput, { color: colors.foreground, borderColor: colors.border }]} />)}
        {currentRide.data && <View style={[styles.requestsCard, { borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground }}>{currentRide.data.bookingCode} · {currentRide.data.status}</Text>
          <Text style={{ color: colors.foreground }}>{currentRide.data.pickupLabel} ← {currentRide.data.destinationLabel}</Text>
          {(["arriving", "active", "completed", "cancelled"] as const).filter((status) => status === "cancelled" ? currentRide.data?.status !== "active" : status === "arriving" ? currentRide.data?.status === "accepted" : status === "active" ? ["accepted", "arriving"].includes(currentRide.data!.status) : currentRide.data?.status === "active").map((status) => <Pressable key={status} disabled={busy} onPress={() => void run(() => pendingOperation(me.data!.id, `${status}-${currentRide.data!.id}`, { id: currentRide.data!.id, status }, (input) => statusMutation.mutateAsync(input)))}><Text style={{ color: colors.primary }}>{({ arriving: "في الطريق", active: "بدء الرحلة", completed: "إكمال الرحلة", cancelled: "إلغاء" })[status]}</Text></Pressable>)}
        </View>}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>نوع المركبة</Text>
        <View style={styles.vehicleRow}>
          {(["toktok", "car"] as VehicleChoice[]).map((item) => {
            const active = (vehicle ?? profile?.vehicleType) === item;
            return <Pressable key={item} onPress={() => setVehicle(item)} style={[styles.vehicleCard, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}><Text style={styles.vehicleEmoji}>{item === "toktok" ? "🛺" : "🚗"}</Text><Text style={[styles.vehicleTitle, { color: active ? "#FFFFFF" : colors.foreground }]}>{item === "toktok" ? "توك توك" : "سيارة"}</Text><Text style={[styles.vehicleMeta, { color: active ? "#DDF7E9" : colors.muted }]}>{item === "toktok" ? "٥٠ ج.م شهرياً" : "١٠٠ ج.م شهرياً"}</Text></Pressable>;
          })}
        </View>

        <Text style={{ color: colors.muted }}>{me.data?.phone ?? "سجل الدخول برقم هاتفك لإكمال التسجيل"}</Text>

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>مستندات التحقق</Text><Text style={[styles.progress, { color: colors.primary }]}>{uploadedCount}/{documents.length}</Text></View>
        <Text style={[styles.uploadHint, { color: colors.muted }]}>اضغط على كل خانة لاختيار صورة أو ملف PDF من جهازك. لا يكفي تحديد الخانة فقط.</Text>
        {latestDocuments.map((d) => <Text key={d.id} style={{ color: d.status === "rejected" ? colors.error : colors.muted }}>{documents.find((item) => item[0] === d.documentType)?.[1]}: {d.status}{d.expiresAt ? ` · ينتهي ${new Date(d.expiresAt).toLocaleDateString("ar-EG")}` : ""}{d.reviewReason ? ` · ${d.reviewReason}` : ""}</Text>)}
        {documents.map(([id, title, hint]) => {
          const file = uploadedFiles[id];
          const done = Boolean(file);
          return <Pressable key={id} onPress={() => pickDocument(id)} style={[styles.documentRow, { backgroundColor: colors.surface, borderColor: done ? colors.success : colors.border }]}><View style={[styles.documentStatus, { backgroundColor: done ? colors.success : colors.background }]}><Text style={{ color: done ? "#FFFFFF" : colors.primary, fontWeight: "800" }}>{done ? "✓" : "↑"}</Text></View><View style={styles.documentCopy}><Text style={[styles.documentTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.documentHint, { color: colors.muted }]}>{done ? `تم رفع: ${file.name}` : `${hint} · اضغط للرفع`}</Text></View></Pressable>;
        })}

        <View style={[styles.reviewCard, { backgroundColor: submitted ? "#FFF5DD" : "#E8F5EE" }]}><Text style={styles.reviewIcon}>{submitted ? "⏳" : "🛡️"}</Text><View style={styles.reviewCopy}><Text style={[styles.reviewTitle, { color: colors.foreground }]}>{statusLabel}</Text><Text style={[styles.reviewText, { color: colors.muted }]}>{submitted ? "هنراجع مستنداتك ونرد عليك قريباً." : "السائقين لا يمكنهم استقبال مشاوير قبل الموافقة."}</Text></View></View>
        <View style={[styles.subscriptionCard, { backgroundColor: subscriptionStatus === "approved" ? "#E8F5EE" : "#FFF5DD" }]}>
          <View style={styles.subscriptionCopy}><Text style={[styles.subscriptionTitle, { color: colors.foreground }]}>الاشتراك: {subscriptionStatus} · الحساب: {profile?.accountStatus ?? "غير مكتمل"}</Text></View>
          <Pressable disabled={busy || (subscriptionStatus !== "approved" && !driverOnline)} onPress={() => void run(async () => {
            if (driverOnline) { await availabilityMutation.mutateAsync({ isOnline: false }); return; }
            if (Platform.OS === "web") {
              if (!navigator.geolocation) throw new Error("المتصفح لا يدعم تحديد الموقع");
              const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));
              await availabilityMutation.mutateAsync({ isOnline: true, lat: position.coords.latitude, lng: position.coords.longitude });
              return;
            }
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== "granted") throw new Error("اسمح بالوصول إلى الموقع من إعدادات الجهاز");
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            await availabilityMutation.mutateAsync({ isOnline: true, lat: location.coords.latitude, lng: location.coords.longitude });
          })} style={[styles.onlineToggle, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>{driverOnline ? "متصل — إيقاف" : "اتصال"}</Text></Pressable>
        </View>
        {profile?.subscriptionStartsAt && profile?.subscriptionEndsAt && <Text style={{ color: colors.muted }}>مدة الاشتراك: {new Date(profile.subscriptionStartsAt).toLocaleDateString("ar-EG")} — {new Date(profile.subscriptionEndsAt).toLocaleDateString("ar-EG")}</Text>}
        {(driverRequestsQuery.data ?? []).map((request) => {
          const input = offerInputs[request.id] ?? { price: "", eta: "" };
          return <View key={request.id} style={[styles.requestsCard, { borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground }}>{request.pickupLabel} ← {request.destinationLabel}</Text>
            <View style={styles.offerFields}>
              <TextInput value={input.price} onChangeText={(price) => setOfferInputs((prev) => ({ ...prev, [request.id]: { ...input, price } }))} placeholder="السعر" keyboardType="number-pad" style={[styles.offerInput, { color: colors.foreground }]} />
              <TextInput value={input.eta} onChangeText={(eta) => setOfferInputs((prev) => ({ ...prev, [request.id]: { ...input, eta } }))} placeholder="الدقائق" keyboardType="number-pad" style={[styles.offerInput, { color: colors.foreground }]} />
              <Pressable disabled={busy || !input.price || !input.eta} onPress={() => void run(() => pendingOperation(me.data!.id, `bid-${request.id}`, { rideId: request.id, offeredPrice: Number(input.price), etaMinutes: Number(input.eta) }, (payload) => offerMutation.mutateAsync(payload)))}><Text style={{ color: colors.primary }}>إرسال العرض</Text></Pressable>
            </View>
          </View>;
        })}
        <Pressable disabled={busy || (!vehicle && !profile?.vehicleType) || !complete} onPress={() => void run(() => submit.mutateAsync({ vehicleType: vehicle ?? profile!.vehicleType, vehicleNumber: vehicleNumber.trim() || profile?.vehicleNumber || "" }))} style={[styles.primaryButton, { backgroundColor: colors.primary }, (!complete || busy) && styles.disabled]}><Text style={styles.primaryText}>{submitted ? "تحديث طلب المراجعة" : "إرسال للمراجعة"}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 36 }, requestsCard: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 }, requestRow: { borderTopWidth: 1, paddingTop: 12, gap: 6 }, requestTitle: { fontSize: 12, fontWeight: "800", textAlign: "right" }, requestMeta: { fontSize: 10, textAlign: "right" }, offerFields: { flexDirection: "row-reverse", gap: 6, alignItems: "center" }, offerInput: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, textAlign: "right", fontFamily: "Cairo_400Regular" }, offerButton: { borderRadius: 10, minHeight: 40, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, offerButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" }, subscriptionCard: { borderRadius: 18, padding: 13, flexDirection: "row-reverse", gap: 9, alignItems: "center" }, subscriptionIcon: { fontSize: 22 }, subscriptionCopy: { flex: 1, alignItems: "flex-end" }, subscriptionTitle: { fontSize: 12, fontWeight: "800" }, subscriptionText: { fontSize: 9, marginTop: 3, textAlign: "right" }, onlineToggle: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, onlineText: { fontSize: 10, fontWeight: "800" }, eyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right" }, title: { fontFamily: "Cairo_800ExtraBold", fontSize: 26, fontWeight: "800", textAlign: "right" }, subtitle: { fontSize: 13, lineHeight: 21, textAlign: "right", marginBottom: 10 }, sectionTitle: { fontFamily: "Cairo_700Bold", fontSize: 16, fontWeight: "800", textAlign: "right" }, vehicleRow: { flexDirection: "row-reverse", gap: 10 }, vehicleCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, alignItems: "center", gap: 4 }, vehicleEmoji: { fontSize: 28 }, vehicleTitle: { fontSize: 15, fontWeight: "800" }, vehicleMeta: { fontSize: 10 }, otpCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, otpIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, otpCopy: { flex: 1, alignItems: "flex-end" }, otpTitle: { fontSize: 13, fontWeight: "800" }, otpText: { fontSize: 10, marginTop: 3 }, sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 8 }, uploadHint: { fontSize: 10, lineHeight: 17, textAlign: "right", marginTop: -6 }, progress: { fontSize: 12, fontWeight: "800" }, documentRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, documentStatus: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" }, documentCopy: { flex: 1, alignItems: "flex-end" }, documentTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 13, fontWeight: "800" }, documentHint: { fontSize: 10, marginTop: 3, textAlign: "right" }, reviewCard: { borderRadius: 18, padding: 14, flexDirection: "row-reverse", gap: 10, alignItems: "center", marginTop: 3 }, reviewIcon: { fontSize: 24 }, reviewCopy: { flex: 1, alignItems: "flex-end" }, reviewTitle: { fontSize: 13, fontWeight: "800" }, reviewText: { fontSize: 10, marginTop: 3, textAlign: "right" }, primaryButton: { height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 4 }, primaryText: { fontFamily: "Cairo_700Bold", color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, disabled: { opacity: 0.45 } });
