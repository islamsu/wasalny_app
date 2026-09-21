import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { ConfirmationResult } from "firebase/auth";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { confirmPhoneCode, loginWithGoogle, nativeAuthNotice, sendPhoneCode } from "@/lib/firebase-auth";
import type { User } from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const colors = useColors();
  useAuth({ autoFetch: false });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const captcha = useRef<View>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => { cleanup.current?.(); }, []);
  const finish = (user: User) => {
    cleanup.current?.();
    router.replace(user.appRole === "admin" ? "/admin" : user.appRole === "driver" ? "/driver" : "/");
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : "تعذر تسجيل الدخول."); }
    finally { setBusy(false); }
  };
  const inputStyle = [styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.surface }];
  return <ScreenContainer className="p-5" safeAreaClassName="bg-background">
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}><Text style={styles.logoText}>↗</Text></View>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>وصلني</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>دخول آمن لكل أفراد المنظومة</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>سجّل الدخول بحساب Google أو رقم هاتفك. يحدد الخادم صلاحيات حسابك، ولا يمنح تسجيل الدخول صلاحيات السائق أو الإدارة تلقائياً.</Text>
      {Platform.OS !== "web" ? <Text style={{ color: colors.muted }}>{nativeAuthNotice}</Text> : <>
        <Pressable testID="google-sign-in" disabled={busy} onPress={() => void run(async () => finish(await loginWithGoogle()))} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 }]}><Text style={styles.primaryText}>المتابعة باستخدام Google</Text></Pressable>
        <TextInput testID="phone-number" editable={!busy && !confirmation} value={phone} onChangeText={setPhone} placeholder="رقم الهاتف بالصيغة الدولية (+…)" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={inputStyle} />
        <View ref={captcha} />
        {!confirmation ? <Pressable testID="send-phone-code" disabled={busy} onPress={() => void run(async () => {
          cleanup.current?.();
          if (!captcha.current) throw new Error("تعذر تحميل reCAPTCHA.");
          const result = await sendPhoneCode(phone.trim(), captcha.current as unknown as HTMLElement);
          cleanup.current = result.clear;
          setConfirmation(result.confirmation);
        })} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>إرسال رمز التحقق</Text></Pressable> : <>
          <TextInput testID="phone-code" value={code} onChangeText={setCode} placeholder="رمز التحقق" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={6} style={inputStyle} />
          <Pressable testID="confirm-phone-code" disabled={busy} onPress={() => void run(async () => finish(await confirmPhoneCode(confirmation, code.trim())))} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>تأكيد وتسجيل الدخول</Text></Pressable>
          <Pressable disabled={busy} onPress={() => { cleanup.current?.(); cleanup.current = null; setConfirmation(null); setCode(""); }}><Text style={{ color: colors.primary }}>تغيير الرقم / إعادة إرسال الرمز</Text></Pressable>
        </>}
      </>}
      {busy && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>جارٍ التحقق…</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
      <Text style={[styles.footer, { color: colors.muted }]}>الجلسة على الويب في الذاكرة فقط لحماية الرموز؛ يلزم تسجيل الدخول مجدداً بعد إعادة تحميل الصفحة.</Text>
    </ScrollView>
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 34, paddingTop: Platform.OS === "web" ? 67 : 0 },
  logo: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  logoText: { color: "#FFFFFF", fontSize: 34, fontWeight: "800" },
  eyebrow: { fontFamily: "Cairo_700Bold", fontSize: 14, fontWeight: "800", textAlign: "right" },
  title: { fontFamily: "Cairo_800ExtraBold", fontSize: 28, fontWeight: "800", textAlign: "right", lineHeight: 38 },
  subtitle: { fontSize: 13, lineHeight: 22, textAlign: "right" },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, textAlign: "right" },
  primaryButton: { borderRadius: 16, padding: 16, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  footer: { fontSize: 11, lineHeight: 20, textAlign: "center" },
});