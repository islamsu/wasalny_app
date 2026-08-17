import MapView, { Marker, Polyline } from "react-native-maps";
import { StyleSheet } from "react-native";

export default function NativeMap({ latitude, longitude, color }: { latitude: number; longitude: number; color: string }) {
  return <MapView style={StyleSheet.absoluteFillObject} initialRegion={{ latitude, longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }} showsUserLocation showsMyLocationButton><Marker coordinate={{ latitude, longitude }} title="مكان الركوب" /><Polyline coordinates={[{ latitude, longitude }, { latitude: latitude + 0.012, longitude: longitude + 0.008 }]} strokeColor={color} strokeWidth={4} /></MapView>;
}
