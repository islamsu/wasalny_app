import { View, Text, StyleSheet } from "react-native";
export default function NativeMapFallback({ latitude: _latitude, longitude: _longitude, color: _color }: { latitude: number; longitude: number; color: string }) { return <View style={styles.fallback}><Text style={styles.label}>الخريطة الحقيقية متاحة على Android وiOS</Text></View>; }
const styles = StyleSheet.create({ fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: "#EFF6F1", alignItems: "center", justifyContent: "center" }, label: { color: "#587468", fontSize: 11 } });
