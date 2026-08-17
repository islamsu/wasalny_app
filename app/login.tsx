import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useWasalnyState, type UserRole } from "@/lib/wasalny-state";

const roles: { id: UserRole; icon: string; title: string; hint: string }[] = [
  { id: "family", icon: "👨‍👩‍👧", title: "العائلة", hint: "اطلب مشواراً وتابع الرحلات والشكاوى" },
  { id: "driver", icon: "🚗", title: "السائق", hint: "استقبل الطلبات وأدر مستنداتك واشتراكك" },
  { id: "admin", icon: "🛡️", title: "الإدارة", hint: "أدر السائقين والرحلات والمدفوعات" },
];

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useWasalnyState();
  const [role, setRole] = useState<UserRole>("family");
  const [phone, setPhone] = useState("");
  const selected = roles.find((item) => item.id === role)!;
  const submit = () => { login(role, role === "admin" ? "المشرف الرئيسي" : phone || selected.title); router.replace(role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/"); };
  return <ScreenContainer className="p-5" safeAreaClassName="bg-background"><ScrollView contentContainerStyle={styles.content}><View style={[styles.logo, { backgroundColor: colors.primary }]}><Text style={styles.logoText}>↗</Text></View><Text style={[styles.eyebrow, { color: colors.primary }]}>وصلني</Text><Text style={[styles.title, { color: colors.foreground }]}>دخول آمن لكل أفراد المنظومة</Text><Text style={[styles.subtitle, { color: colors.muted }]}>اختار نوع حسابك للمتابعة إلى التجربة المناسبة لك.</Text><View style={styles.roles}>{roles.map((item) => <Pressable key={item.id} onPress={() => setRole(item.id)} style={[styles.roleCard, { backgroundColor: role === item.id ? colors.primary : colors.surface, borderColor: role === item.id ? colors.primary : colors.border }]}><Text style={styles.roleIcon}>{item.icon}</Text><Text style={[styles.roleTitle, { color: role === item.id ? "#FFFFFF" : colors.foreground }]}>{item.title}</Text><Text style={[styles.roleHint, { color: role === item.id ? "#DDF7E9" : colors.muted }]}>{item.hint}</Text></Pressable>)}</View>{role !== "admin" && <TextInput value={phone} onChangeText={setPhone} placeholder="رقم الهاتف" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }]} />}<View style={[styles.otpNote, { backgroundColor: "#E8F5EE" }]}><Text style={styles.otpIcon}>🔐</Text><Text style={[styles.otpText, { color: colors.foreground }]}>سيتم التحقق من رقم الهاتف برمز OTP عند الربط الفعلي بالخادم.</Text></View><Pressable onPress={submit} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>الدخول كـ {selected.title}</Text></Pressable><Text style={[styles.footer, { color: colors.muted }]}>تجربة محلية آمنة · الصلاحيات تختلف حسب الدور</Text></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingBottom: 30 }, logo: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" }, logoText: { color: "#FFFFFF", fontSize: 34, fontWeight: "800" }, eyebrow: { fontFamily: "Cairo_700Bold", fontSize: 14, fontWeight: "800", textAlign: "right" }, title: { fontFamily: "Cairo_800ExtraBold", fontSize: 28, fontWeight: "800", textAlign: "right", lineHeight: 38 }, subtitle: { fontSize: 13, lineHeight: 22, textAlign: "right" }, roles: { gap: 10, marginTop: 8 }, roleCard: { borderWidth: 1, borderRadius: 18, padding: 14, alignItems: "flex-end", gap: 3 }, roleIcon: { fontSize: 25 }, roleTitle: { fontFamily: "Cairo_700Bold", fontSize: 15, fontWeight: "800" }, roleHint: { fontSize: 10, textAlign: "right" }, input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, textAlign: "right", fontSize: 14 }, otpNote: { borderRadius: 16, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 9 }, otpIcon: { fontSize: 20 }, otpText: { flex: 1, fontSize: 10, lineHeight: 17, textAlign: "right" }, primaryButton: { minHeight: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 6 }, primaryText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 15, fontWeight: "800" }, footer: { textAlign: "center", fontSize: 10 } });
