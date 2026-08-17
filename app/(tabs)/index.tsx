import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const vehicleOptions = [
  { id: "toktok", icon: "🛺", title: "اطلب توك توك", subtitle: "للمشاوير القريبة" },
  { id: "car", icon: "🚗", title: "اطلب سيارة", subtitle: "راحة ومساحة أكبر" },
  { id: "fast", icon: "⚡", title: "أسرع وسيلة", subtitle: "أقرب سائق متاح" },
] as const;

type VehicleId = (typeof vehicleOptions)[number]["id"];

type RideStage = "idle" | "request" | "matching" | "active" | "complete";

export default function HomeScreen() {
  const colors = useColors();
  const [vehicle, setVehicle] = useState<VehicleId | null>(null);
  const [stage, setStage] = useState<RideStage>("idle");
  const [showProfile, setShowProfile] = useState(false);

  const selectedVehicle = useMemo(
    () => vehicleOptions.find((item) => item.id === vehicle),
    [vehicle],
  );

  const openRequest = (nextVehicle: VehicleId) => {
    setVehicle(nextVehicle);
    setStage("request");
  };

  const resetRide = () => {
    setVehicle(null);
    setStage("idle");
  };

  return (
    <ScreenContainer safeAreaClassName="bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      >
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoGlyph}>↗</Text>
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>وصلني</Text>
              <Text style={[styles.tagline, { color: colors.muted }]}>أقرب... أوفر... أأمن</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="فتح الحساب"
            onPress={() => setShowProfile(true)}
            style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Text style={styles.profileEmoji}>👤</Text>
          </Pressable>
        </View>

        <View style={[styles.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.locationTopRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            <View style={styles.locationTextBlock}>
              <Text style={[styles.overline, { color: colors.muted }]}>موقعك الحالي</Text>
              <Text style={[styles.locationTitle, { color: colors.foreground }]}>مدينة نصر، القاهرة</Text>
            </View>
            <Text style={[styles.detected, { color: colors.success }]}>تم التحديد</Text>
          </View>
          <View style={[styles.mapPreview, { backgroundColor: colors.background }]}>
            <View style={[styles.mapRoad, styles.roadOne]} />
            <View style={[styles.mapRoad, styles.roadTwo]} />
            <View style={[styles.mapRoad, styles.roadThree]} />
            <View style={[styles.mapPin, { backgroundColor: colors.primary }]}>
              <View style={styles.mapPinInner} />
            </View>
            <Text style={[styles.mapLabel, { color: colors.muted }]}>اسحب العلامة لتعديل مكان الركوب</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>رايح فين النهارده؟</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>اختار الطريقة المناسبة ليك</Text>
          </View>
          <Text style={styles.wave}>👋</Text>
        </View>

        <View style={styles.actions}>
          {vehicleOptions.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => openRequest(item.id)}
              style={({ pressed }) => [
                styles.rideAction,
                { backgroundColor: index === 2 ? colors.primary : colors.surface, borderColor: index === 2 ? colors.primary : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: index === 2 ? "rgba(255,255,255,0.18)" : colors.background }]}>
                <Text style={styles.actionEmoji}>{item.icon}</Text>
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: index === 2 ? "#FFFFFF" : colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.actionSubtitle, { color: index === 2 ? "#DDF7E9" : colors.muted }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.actionArrow, { color: index === 2 ? "#FFFFFF" : colors.primary }]}>‹</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.safetyCard, { backgroundColor: "#E8F5EE" }]}>
          <Text style={styles.safetyIcon}>🛡️</Text>
          <View style={styles.safetyCopy}>
            <Text style={[styles.safetyTitle, { color: colors.foreground }]}>مشوارك في أمان</Text>
            <Text style={[styles.safetyText, { color: colors.muted }]}>كل سائق عندنا متراجع وموثق قبل ما يبدأ</Text>
          </View>
          <Text style={[styles.safetyArrow, { color: colors.primary }]}>‹</Text>
        </View>

        <View style={styles.recentHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>آخر مشوار</Text>
          <Text style={[styles.seeAll, { color: colors.primary }]}>عرض الكل</Text>
        </View>
        <View style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.recentIcon, { backgroundColor: "#E8F5EE" }]}><Text>🚗</Text></View>
          <View style={styles.recentCopy}>
            <Text style={[styles.recentTitle, { color: colors.foreground }]}>مدينة نصر ← عباس العقاد</Text>
            <Text style={[styles.recentMeta, { color: colors.muted }]}>الأحد، ١١ أغسطس · نقدي</Text>
          </View>
          <Text style={[styles.recentFare, { color: colors.foreground }]}>٤٥ ج.م</Text>
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={stage !== "idle"} onRequestClose={resetRide}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHandle} />
            {stage === "request" && selectedVehicle ? (
              <RideRequestSheet colors={colors} selectedVehicle={selectedVehicle} onBack={resetRide} onRequest={() => setStage("matching")} />
            ) : null}
            {stage === "matching" ? (
              <MatchingSheet colors={colors} selectedVehicle={selectedVehicle} onCancel={resetRide} onMatched={() => setStage("active")} />
            ) : null}
            {stage === "active" ? (
              <ActiveRideSheet colors={colors} onFinish={() => setStage("complete")} />
            ) : null}
            {stage === "complete" ? (
              <CompleteSheet colors={colors} onDone={resetRide} />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={showProfile} onRequestClose={() => setShowProfile(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>حسابي</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>إدارة بياناتك وإعدادات الأمان</Text>
            {["بياناتي الشخصية", "جهات اتصال الطوارئ", "سجل المشاوير", "الإشعارات", "الوضع الليلي"].map((item) => (
              <View key={item} style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.settingText, { color: colors.foreground }]}>{item}</Text>
                <Text style={{ color: colors.muted }}>‹</Text>
              </View>
            ))}
            <Pressable onPress={() => setShowProfile(false)} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>إغلاق</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function RideRequestSheet({ colors, selectedVehicle, onBack, onRequest }: any) {
  return <>
    <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>طلب مشوار جديد</Text>
    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>راجع تفاصيل المشوار</Text>
    <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>هنبعت طلبك لأقرب سائق متاح</Text>
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={styles.summaryIcon}>{selectedVehicle.icon}</Text><View style={styles.summaryCopy}><Text style={[styles.summaryTitle, { color: colors.foreground }]}>{selectedVehicle.title}</Text><Text style={[styles.summaryMeta, { color: colors.muted }]}>الدفع نقدي عند الوصول</Text></View><Text style={[styles.summaryCheck, { color: colors.success }]}>✓</Text>
    </View>
    <View style={[styles.routeRow, { borderBottomColor: colors.border }]}><View style={[styles.routeDot, { backgroundColor: colors.primary }]} /><View><Text style={[styles.routeLabel, { color: colors.muted }]}>من</Text><Text style={[styles.routeValue, { color: colors.foreground }]}>مدينة نصر، القاهرة</Text></View></View>
    <View style={[styles.routeRow, { borderBottomColor: colors.border }]}><View style={[styles.routeDot, { backgroundColor: colors.warning }]} /><View><Text style={[styles.routeLabel, { color: colors.muted }]}>إلى</Text><Text style={[styles.routeValue, { color: colors.foreground }]}>اختار وجهتك من الخريطة</Text></View></View>
    <Pressable onPress={onRequest} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>اطلب الآن</Text></Pressable>
    <Pressable onPress={onBack} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.muted }]}>رجوع</Text></Pressable>
  </>;
}

function MatchingSheet({ colors, selectedVehicle, onCancel, onMatched }: any) {
  return <>
    <View style={[styles.matchingCircle, { backgroundColor: "#E8F5EE" }]}><Text style={styles.matchingEmoji}>{selectedVehicle?.icon ?? "⚡"}</Text></View>
    <Text style={[styles.sheetTitle, styles.centerText, { color: colors.foreground }]}>بندور لك على أقرب سائق</Text>
    <Text style={[styles.sheetSubtitle, styles.centerText, { color: colors.muted }]}>هنكلمه واحد واحد عشان توصلك أسرع وسيلة</Text>
    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { backgroundColor: colors.primary }]} /></View>
    <Text style={[styles.matchingHint, { color: colors.primary }]}>جاري التواصل مع أول سائق قريب...</Text>
    <Pressable onPress={onMatched} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={styles.primaryButtonText}>محاكاة قبول السائق</Text></Pressable>
    <Pressable onPress={onCancel} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.muted }]}>إلغاء الطلب</Text></Pressable>
  </>;
}

function ActiveRideSheet({ colors, onFinish }: any) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setProgress((current) => (current >= 92 ? 0 : current + 8)), 3000);
    return () => clearInterval(timer);
  }, []);
  return <>
    <View style={styles.activeHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.success }]}>السائق في الطريق · تحديث مباشر</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>محمود السيد</Text><Text style={[styles.sheetSubtitle, { color: colors.muted }]}>🚗 سيارة · أ ب ج ١٢٣٤ · ٤.٩ ★</Text></View><View style={[styles.driverAvatar, { backgroundColor: "#DDEDE4" }]}><Text style={styles.driverEmoji}>👨🏻</Text></View></View>
    <View style={[styles.activeMap, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.mapRoad, styles.roadFour]} /><View style={[styles.mapRoad, styles.roadFive]} /><View style={[styles.routeTrace, { backgroundColor: colors.primary, width: `${Math.max(22, progress)}%` }]} /><View style={[styles.livePin, { backgroundColor: colors.primary, left: `${12 + progress * 0.72}%` }]}><Text style={styles.livePinText}>🚗</Text></View><Text style={[styles.etaText, { color: colors.foreground }]}>٤ دقائق</Text><Text style={[styles.etaLabel, { color: colors.muted }]}>وقت الوصول المتوقع · GPS حي</Text></View>
    <View style={styles.tripInfoRow}><View><Text style={[styles.infoLabel, { color: colors.muted }]}>رمز المشوار</Text><Text style={[styles.tripPin, { color: colors.foreground }]}>٤٨٢٧</Text></View><View><Text style={[styles.infoLabel, { color: colors.muted }]}>المسافة</Text><Text style={[styles.tripPin, { color: colors.foreground }]}>٢٫٣ كم</Text></View><View><Text style={[styles.infoLabel, { color: colors.muted }]}>الدفع</Text><Text style={[styles.tripPin, { color: colors.foreground }]}>نقدي</Text></View></View>
    <View style={styles.safetyActions}><Pressable style={[styles.safetyAction, { borderColor: colors.border }]}><Text>📞</Text><Text style={[styles.safetyActionText, { color: colors.foreground }]}>اتصال</Text></Pressable><Pressable style={[styles.safetyAction, { borderColor: colors.border }]}><Text>↗</Text><Text style={[styles.safetyActionText, { color: colors.foreground }]}>مشاركة</Text></Pressable><Pressable style={[styles.safetyAction, { borderColor: "#F5C7C2" }]}><Text>🆘</Text><Text style={[styles.safetyActionText, { color: colors.error }]}>نجدة</Text></Pressable></View>
    <Pressable onPress={onFinish} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={styles.primaryButtonText}>إنهاء المشوار</Text></Pressable>
  </>;
}

function CompleteSheet({ colors, onDone }: any) {
  return <>
    <View style={[styles.successCircle, { backgroundColor: "#E8F5EE" }]}><Text style={styles.successEmoji}>✓</Text></View>
    <Text style={[styles.sheetTitle, styles.centerText, { color: colors.foreground }]}>وصلت بالسلامة</Text>
    <Text style={[styles.sheetSubtitle, styles.centerText, { color: colors.muted }]}>إجمالي المشوار ٤٥ جنيه · الدفع نقدي</Text>
    <Text style={[styles.ratingLabel, { color: colors.foreground }]}>قيّم تجربتك مع محمود</Text>
    <View style={styles.stars}>{[1, 2, 3, 4, 5].map((item) => <Text key={item} style={styles.star}>★</Text>)}</View>
    <Pressable onPress={onDone} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={styles.primaryButtonText}>تم</Text></Pressable>
  </>;
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 36, gap: 18 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingTop: 8 },
  brandBlock: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  logoMark: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  logoGlyph: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  brandName: { fontSize: 25, fontWeight: "800", textAlign: "right" },
  tagline: { fontSize: 11, marginTop: 2, textAlign: "right" },
  profileButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  profileEmoji: { fontSize: 20 },
  locationCard: { borderRadius: 24, borderWidth: 1, padding: 12, gap: 12 },
  locationTopRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  locationDot: { width: 11, height: 11, borderRadius: 6 },
  locationTextBlock: { flex: 1, alignItems: "flex-end" },
  overline: { fontSize: 11, textAlign: "right" },
  locationTitle: { fontSize: 15, fontWeight: "700", marginTop: 2, textAlign: "right" },
  detected: { fontSize: 11, fontWeight: "700" },
  mapPreview: { height: 142, borderRadius: 17, overflow: "hidden", position: "relative" },
  mapRoad: { position: "absolute", height: 4, borderRadius: 4, backgroundColor: "#C8DCD2", transform: [{ rotate: "-20deg" }] },
  roadOne: { width: 180, top: 52, left: -10 }, roadTwo: { width: 220, top: 92, left: 40, transform: [{ rotate: "17deg" }] }, roadThree: { width: 130, top: 10, left: 135, transform: [{ rotate: "72deg" }] }, roadFour: { width: 240, top: 70, left: 15, transform: [{ rotate: "-12deg" }] }, roadFive: { width: 180, top: 110, left: 50, transform: [{ rotate: "35deg" }] },
  mapPin: { position: "absolute", top: 46, left: "48%", width: 30, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#FFFFFF" },
  mapPinInner: { width: 7, height: 7, backgroundColor: "#FFFFFF", borderRadius: 4 },
  mapLabel: { position: "absolute", bottom: 10, right: 12, fontSize: 10 },
  sectionHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  sectionSubtitle: { fontSize: 12, marginTop: 4, textAlign: "right" },
  wave: { fontSize: 25 },
  actions: { gap: 10 },
  rideAction: { minHeight: 78, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionEmoji: { fontSize: 26 },
  actionCopy: { flex: 1, alignItems: "flex-end" },
  actionTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" },
  actionSubtitle: { fontSize: 11, marginTop: 3, textAlign: "right" },
  actionArrow: { fontSize: 30, transform: [{ rotate: "180deg" }] },
  safetyCard: { borderRadius: 20, padding: 15, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  safetyIcon: { fontSize: 24 }, safetyCopy: { flex: 1, alignItems: "flex-end" }, safetyTitle: { fontWeight: "800", fontSize: 14 }, safetyText: { fontSize: 11, marginTop: 3, textAlign: "right" }, safetyArrow: { fontSize: 28, transform: [{ rotate: "180deg" }] },
  recentHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  seeAll: { fontSize: 12, fontWeight: "700" },
  recentCard: { minHeight: 68, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  recentIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }, recentCopy: { flex: 1, alignItems: "flex-end" }, recentTitle: { fontSize: 13, fontWeight: "700" }, recentMeta: { fontSize: 10, marginTop: 3 }, recentFare: { fontSize: 13, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9, 26, 18, 0.35)" },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingBottom: 28, paddingTop: 10, minHeight: 430 },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 4, backgroundColor: "#B7C7BE", marginBottom: 22 },
  sheetEyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 5 },
  sheetTitle: { fontSize: 23, fontWeight: "800", textAlign: "right" }, sheetSubtitle: { fontSize: 13, textAlign: "right", marginTop: 5, lineHeight: 20 },
  summaryCard: { flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, borderRadius: 18, padding: 13, marginTop: 20, gap: 11 }, summaryIcon: { fontSize: 27 }, summaryCopy: { flex: 1, alignItems: "flex-end" }, summaryTitle: { fontSize: 15, fontWeight: "800" }, summaryMeta: { fontSize: 11, marginTop: 3 }, summaryCheck: { fontSize: 22, fontWeight: "800" },
  routeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 }, routeDot: { width: 11, height: 11, borderRadius: 6 }, routeLabel: { fontSize: 11, textAlign: "right" }, routeValue: { fontSize: 14, fontWeight: "700", marginTop: 2, textAlign: "right" },
  primaryButton: { minHeight: 55, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 20 }, primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, cancelButton: { alignItems: "center", paddingVertical: 13 }, cancelText: { fontSize: 13, fontWeight: "700" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  matchingCircle: { alignSelf: "center", width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", marginTop: 5, marginBottom: 18 }, matchingEmoji: { fontSize: 42 }, centerText: { textAlign: "center" }, progressTrack: { height: 8, borderRadius: 8, overflow: "hidden", marginTop: 25 }, progressFill: { height: 8, width: "58%", borderRadius: 8 }, matchingHint: { fontSize: 12, textAlign: "center", marginTop: 12, fontWeight: "700" },
  activeHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, driverAvatar: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" }, driverEmoji: { fontSize: 30 },   activeMap: { height: 165, borderRadius: 20, borderWidth: 1, marginTop: 18, position: "relative", overflow: "hidden" }, routeTrace: { position: "absolute", left: 16, top: 104, height: 5, borderRadius: 5, opacity: 0.82 }, livePin: { position: "absolute", top: 72, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#FFFFFF" }, livePinText: { fontSize: 16 }, etaText: { position: "absolute", top: 12, right: 12, fontSize: 19, fontWeight: "800" }, etaLabel: { position: "absolute", top: 38, right: 12, fontSize: 10 }, tripInfoRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 18 }, infoLabel: { fontSize: 10, textAlign: "right" }, tripPin: { fontSize: 15, fontWeight: "800", marginTop: 4, textAlign: "right" }, safetyActions: { flexDirection: "row-reverse", gap: 8 }, safetyAction: { flex: 1, height: 62, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 }, safetyActionText: { fontSize: 11, fontWeight: "700" }, successCircle: { alignSelf: "center", width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 15 }, successEmoji: { color: "#137A5A", fontSize: 46, fontWeight: "800" }, ratingLabel: { textAlign: "center", marginTop: 26, fontSize: 14, fontWeight: "700" }, stars: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 12 }, star: { color: "#F5A623", fontSize: 30 },
  settingRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 17, borderBottomWidth: 1 }, settingText: { fontSize: 15, fontWeight: "600" }, secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 20 }, secondaryButtonText: { fontSize: 15, fontWeight: "800" },
});
