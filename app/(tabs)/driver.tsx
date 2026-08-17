import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

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
  const [vehicle, setVehicle] = useState<VehicleChoice | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const complete = uploaded.length === documents.length;
  const statusLabel = useMemo(() => submitted ? "قيد مراجعة الإدارة" : complete ? "جاهز للإرسال" : "أكمل البيانات المطلوبة", [submitted, complete]);

  const toggleDocument = (id: string) => {
    setUploaded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <ScreenContainer className="p-5" safeAreaClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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

        <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>مستندات التحقق</Text><Text style={[styles.progress, { color: colors.primary }]}>{uploaded.length}/{documents.length}</Text></View>
        {documents.map(([id, title, hint]) => {
          const done = uploaded.includes(id);
          return <Pressable key={id} onPress={() => toggleDocument(id)} style={[styles.documentRow, { backgroundColor: colors.surface, borderColor: done ? colors.success : colors.border }]}><View style={[styles.documentStatus, { backgroundColor: done ? colors.success : colors.background }]}><Text style={{ color: done ? "#FFFFFF" : colors.muted, fontWeight: "800" }}>{done ? "✓" : "+"}</Text></View><View style={styles.documentCopy}><Text style={[styles.documentTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.documentHint, { color: colors.muted }]}>{done ? "تم رفع المستند · اضغط للتعديل" : hint}</Text></View></Pressable>;
        })}

        <View style={[styles.reviewCard, { backgroundColor: submitted ? "#FFF5DD" : "#E8F5EE" }]}><Text style={styles.reviewIcon}>{submitted ? "⏳" : "🛡️"}</Text><View style={styles.reviewCopy}><Text style={[styles.reviewTitle, { color: colors.foreground }]}>{statusLabel}</Text><Text style={[styles.reviewText, { color: colors.muted }]}>{submitted ? "هنراجع مستنداتك ونرد عليك قريباً." : "السائقين لا يمكنهم استقبال مشاوير قبل الموافقة."}</Text></View></View>
        <Pressable disabled={!vehicle || !complete || submitted} onPress={() => setSubmitted(true)} style={[styles.primaryButton, { backgroundColor: colors.primary }, (!vehicle || !complete || submitted) && styles.disabled]}><Text style={styles.primaryText}>{submitted ? "تم إرسال الطلب" : "إرسال للمراجعة"}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 36 }, eyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right" }, title: { fontSize: 26, fontWeight: "800", textAlign: "right" }, subtitle: { fontSize: 13, lineHeight: 21, textAlign: "right", marginBottom: 10 }, sectionTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" }, vehicleRow: { flexDirection: "row-reverse", gap: 10 }, vehicleCard: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, alignItems: "center", gap: 4 }, vehicleEmoji: { fontSize: 28 }, vehicleTitle: { fontSize: 15, fontWeight: "800" }, vehicleMeta: { fontSize: 10 }, otpCard: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, otpIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, otpCopy: { flex: 1, alignItems: "flex-end" }, otpTitle: { fontSize: 13, fontWeight: "800" }, otpText: { fontSize: 10, marginTop: 3 }, sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginTop: 8 }, progress: { fontSize: 12, fontWeight: "800" }, documentRow: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, documentStatus: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" }, documentCopy: { flex: 1, alignItems: "flex-end" }, documentTitle: { fontSize: 13, fontWeight: "800" }, documentHint: { fontSize: 10, marginTop: 3, textAlign: "right" }, reviewCard: { borderRadius: 18, padding: 14, flexDirection: "row-reverse", gap: 10, alignItems: "center", marginTop: 3 }, reviewIcon: { fontSize: 24 }, reviewCopy: { flex: 1, alignItems: "flex-end" }, reviewTitle: { fontSize: 13, fontWeight: "800" }, reviewText: { fontSize: 10, marginTop: 3, textAlign: "right" }, primaryButton: { height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 4 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, disabled: { opacity: 0.45 } });
