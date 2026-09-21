import { Text } from "react-native";
import { Link } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function OAuthCallback() {
  // Never accept a bearer credential, user, role, or legacy OAuth code from a URL.
  return <ScreenContainer className="p-5 gap-4">
    <Text className="text-foreground">رابط تسجيل الدخول القديم غير مدعوم. سجّل الدخول عبر Firebase من صفحة الدخول.</Text>
    <Link href="/login" className="text-primary">العودة لتسجيل الدخول</Link>
  </ScreenContainer>;
}