import { Platform } from "react-native";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, inMemoryPersistence, setPersistence, signInWithPopup, signInWithPhoneNumber, RecaptchaVerifier, signOut, type ConfirmationResult, type UserCredential } from "firebase/auth";
import { exchangeFirebaseToken } from "./_core/auth";

export const nativeAuthNotice = "تسجيل الدخول على Android/iOS غير مُهيأ بعد. يلزم إعداد SDK الأصلي والتحقق على جهاز حقيقي والتوقيع. استخدم نسخة الويب حالياً.";
function firebaseAuth() {
  if (Platform.OS !== "web") throw new Error(nativeAuthNotice);
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Firebase is not configured: missing EXPO_PUBLIC_FIREBASE values (${missing.join(", ")}).`);
  return getAuth(getApps().length ? getApp() : initializeApp(config));
}
async function exchange(credential: UserCredential) {
  try { return await exchangeFirebaseToken(await credential.user.getIdToken(true)); }
  finally { await signOut(firebaseAuth()); }
}
export async function loginWithGoogle() {
  const auth = firebaseAuth();
  await setPersistence(auth, inMemoryPersistence);
  return exchange(await signInWithPopup(auth, new GoogleAuthProvider()));
}
export async function sendPhoneCode(phone: string, container: HTMLElement) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("أدخل الرقم بالصيغة الدولية مثل + ثم رمز البلد ورقم الهاتف.");
  const auth = firebaseAuth();
  await setPersistence(auth, inMemoryPersistence);
  const verifier = new RecaptchaVerifier(auth, container, { size: "normal" });
  try {
    const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
    return { confirmation, clear: () => verifier.clear() };
  } catch (error) { verifier.clear(); throw error; }
}
export async function confirmPhoneCode(confirmation: ConfirmationResult, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("أدخل رمز التحقق المكون من ستة أرقام.");
  return exchange(await confirmation.confirm(code));
}