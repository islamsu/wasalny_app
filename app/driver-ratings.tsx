import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function DriverRatingsScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ driverUserId?: string; driverName?: string }>();
  const driverUserId = Number(params.driverUserId ?? 0);
  const driverName = params.driverName ?? "السائق";
  const ratingsQuery = trpc.ratings.forDriver.useQuery({ driverUserId }, { enabled: driverUserId > 0, retry: false });
  const summary = ratingsQuery.data;

  return (
    <ScreenContainer className="p-5" safeAreaClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.backText, { color: colors.primary }]}>رجوع</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>ملف السائق العام</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{driverName}</Text>
          </View>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryScore}>
            <Text style={[styles.average, { color: colors.foreground }]}>{summary?.averageRating ?? "—"}</Text>
            <Text style={styles.largeStar}>★</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>متوسط التقييم</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryCount}>
            <Text style={[styles.count, { color: colors.primary }]}>{summary?.totalRatings ?? 0}</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>تقييم موثق</Text>
            <Text style={[styles.summaryHint, { color: colors.muted }]}>من عائلات وصلني</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>سجل التقييمات</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{summary?.totalRatings ?? 0} تقييم</Text>
        </View>

        {ratingsQuery.isLoading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.muted }]}>جاري تحميل التقييمات</Text></View> : null}
        {!ratingsQuery.isLoading && (!summary?.ratings?.length) ? <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={styles.emptyIcon}>☆</Text><Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد تقييمات بعد</Text><Text style={[styles.muted, { color: colors.muted }]}>سيظهر سجل التقييمات بعد إتمام أولى الرحلات.</Text></View> : null}
        {!ratingsQuery.isLoading && summary?.ratings?.map((item) => <View key={item.id} style={[styles.ratingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.ratingTop}><Text style={[styles.date, { color: colors.muted }]}>{new Date(item.createdAt).toLocaleDateString("ar-EG")}</Text><Text style={styles.stars}>{"★".repeat(item.rating)}<Text style={styles.emptyStars}>{"★".repeat(5 - item.rating)}</Text></Text></View><Text style={[styles.ratingValue, { color: colors.foreground }]}>{item.rating} من 5</Text>{item.comment ? <Text style={[styles.comment, { color: colors.muted }]}>{item.comment}</Text> : <Text style={[styles.comment, { color: colors.muted }]}>تم استلام التقييم بدون تعليق.</Text>}</View>)}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCopy: { flex: 1, alignItems: "flex-end" },
  backButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  backText: { fontSize: 13, fontWeight: "800" },
  eyebrow: { fontSize: 12, fontWeight: "800", textAlign: "right" },
  title: { fontSize: 25, fontWeight: "900", textAlign: "right", marginTop: 2 },
  summaryCard: { borderWidth: 1, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  summaryScore: { alignItems: "center", gap: 3 },
  summaryCount: { alignItems: "center", gap: 3 },
  summaryDivider: { width: 1, height: 70 },
  average: { fontSize: 38, fontWeight: "900" },
  largeStar: { color: "#F4B740", fontSize: 22 },
  count: { fontSize: 34, fontWeight: "900" },
  muted: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  summaryHint: { fontSize: 11, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 19, fontWeight: "900", textAlign: "right" },
  ratingCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  ratingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stars: { color: "#F4B740", fontSize: 18, letterSpacing: 1 },
  emptyStars: { color: "#D5DAD7" },
  date: { fontSize: 12, fontWeight: "600" },
  ratingValue: { fontSize: 14, fontWeight: "800", textAlign: "right" },
  comment: { fontSize: 14, lineHeight: 22, textAlign: "right" },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 28, alignItems: "center", gap: 8 },
  emptyIcon: { color: "#F4B740", fontSize: 34 },
  emptyTitle: { fontSize: 17, fontWeight: "900" },
  center: { alignItems: "center", gap: 10, paddingVertical: 30 },
});
