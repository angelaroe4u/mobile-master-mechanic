// ─── LEADERBOARD SCREEN (Feature #9) ─────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { COLORS, FONTS, RANKS } from "../constants/theme";
import { getLeaderboard } from "../services/firestore";
import { getUserRank } from "../components/RankBadge";
import RankBadge from "../components/RankBadge";

export default function LeaderboardScreen({ navigation, userPoints = 0 }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await getLeaderboard(50);
      setLeaders(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const renderItem = ({ item, index }) => {
    const rank = getUserRank(item.points || 0);
    const medals = ["🥇", "🥈", "🥉"];

    return (
      <View style={[styles.row, index < 3 && styles.topRow]}>
        <Text style={styles.position}>
          {index < 3 ? medals[index] : `#${index + 1}`}
        </Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name || "Anonymous"}</Text>
          <Text style={[styles.userRank, { color: rank.color }]}>{rank.title}</Text>
        </View>
        <View style={styles.pointsCol}>
          <Text style={styles.pointsValue}>{(item.points || 0).toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LEADERBOARD</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Your rank */}
      <View style={styles.yourRank}>
        <Text style={styles.yourRankLabel}>Your Rank</Text>
        <RankBadge points={userPoints} />
      </View>

      {/* Rank tiers */}
      <View style={styles.tiers}>
        {RANKS.map((r) => (
          <View key={r.level} style={[styles.tier, { borderColor: r.color + "40" }]}>
            <Text style={[styles.tierLevel, { color: r.color }]}>{r.level}</Text>
            <Text style={styles.tierTitle}>{r.title}</Text>
            <Text style={styles.tierPts}>{r.minPoints}+</Text>
          </View>
        ))}
      </View>

      {/* Leaderboard list */}
      <FlatList
        data={leaders}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? "Loading leaderboard..." : "No rankings yet. Be the first!"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { fontSize: 22, color: COLORS.accent },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    flex: 1,
  },
  yourRank: { padding: 16 },
  yourRankLabel: {
    fontSize: 11,
    color: COLORS.textM,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    fontFamily: FONTS.bodyBold,
  },
  tiers: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 6,
  },
  tier: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tierLevel: { fontSize: 10, fontWeight: "800", fontFamily: FONTS.bodyBold },
  tierTitle: { fontSize: 9, color: COLORS.textM, fontFamily: FONTS.body },
  tierPts: { fontSize: 8, color: COLORS.textD, fontFamily: FONTS.body },
  list: { padding: 16, paddingBottom: 100 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 14,
  },
  topRow: { borderColor: COLORS.accent + "40" },
  position: { fontSize: 18, width: 30, textAlign: "center" },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  userRank: { fontSize: 10, marginTop: 1, fontFamily: FONTS.body },
  pointsCol: { alignItems: "flex-end" },
  pointsValue: { fontSize: 16, fontWeight: "900", color: COLORS.accent, fontFamily: FONTS.heading },
  pointsLabel: { fontSize: 9, color: COLORS.textM, fontFamily: FONTS.body },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: COLORS.textM, fontSize: 14, fontFamily: FONTS.body },
});
