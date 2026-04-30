import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONTS, RANKS } from "../constants/theme";

export function getUserRank(points = 0) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.minPoints) rank = r;
  }
  const nextRank = RANKS.find(r => r.minPoints > points);
  const progress = nextRank
    ? (points - rank.minPoints) / (nextRank.minPoints - rank.minPoints)
    : 1;
  return { ...rank, points, nextRank, progress };
}

// ─── COMPACT BADGE (used on home screen header) ──────────────────────────────
export default function RankBadge({ points = 0, compact = false }) {
  const rank = getUserRank(points);

  if (compact) {
    return (
      <View style={[styles.compactWrap, { borderColor: rank.color + "50" }]}>
        <View style={[styles.compactLevelCircle, { backgroundColor: rank.color + "22", borderColor: rank.color }]}>
          <Text style={[styles.compactLevelNum, { color: rank.color }]}>{rank.level}</Text>
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.compactTitle, { color: rank.color }]}>{rank.title}</Text>
          <Text style={styles.compactPts}>{rank.points} pts</Text>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(rank.progress * 100, 100)}%`,
                  backgroundColor: rank.color,
                },
              ]}
            />
          </View>
          {rank.nextRank && (
            <Text style={styles.nextLabel}>
              {rank.nextRank.minPoints - rank.points} pts to next level
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Full badge (used in Settings)
  return (
    <View style={[styles.container, { borderColor: rank.color + "30" }]}>
      <View style={styles.header}>
        <View style={[styles.levelCircle, { backgroundColor: rank.color + "22", borderColor: rank.color }]}>
          <Text style={[styles.levelNum, { color: rank.color }]}>{rank.level}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.title, { color: rank.color }]}>{rank.title}</Text>
          <Text style={styles.points}>{rank.points} points earned</Text>
        </View>
      </View>

      {rank.nextRank && (
        <View style={styles.progressSection}>
          <View style={styles.progressTrackFull}>
            <View
              style={[
                styles.progressFillFull,
                {
                  width: `${Math.min(rank.progress * 100, 100)}%`,
                  backgroundColor: rank.color,
                },
              ]}
            />
          </View>
          <Text style={styles.nextLabelFull}>
            {rank.nextRank.minPoints - rank.points} pts to {rank.nextRank.title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Compact
  compactWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10,14,26,0.7)",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  compactLevelCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  compactLevelNum: { fontSize: 14, fontWeight: "900", fontFamily: FONTS.heading },
  compactInfo: { flex: 1 },
  compactTitle: { fontSize: 11, fontWeight: "800", fontFamily: FONTS.bodyBold, textTransform: "uppercase", letterSpacing: 0.5 },
  compactPts: { fontSize: 9, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 1 },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
    width: "100%",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  nextLabel: { fontSize: 8, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 2 },

  // ── Full
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  levelCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNum: { fontSize: 22, fontWeight: "900", fontFamily: FONTS.heading },
  info: { flex: 1 },
  title: { fontSize: 17, fontWeight: "900", fontFamily: FONTS.heading, letterSpacing: 1, textTransform: "uppercase" },
  points: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },
  progressSection: { marginTop: 14 },
  progressTrackFull: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFillFull: { height: "100%", borderRadius: 3 },
  nextLabelFull: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 5, textAlign: "right" },
});
