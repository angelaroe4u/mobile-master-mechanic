import React, { useState } from "react";
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet,
} from "react-native";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";
import HankAvatar from "./HankAvatar";

// Feature #7: Dynamic glossary with Hank-narrated explanations
export default function GlossaryModal({ visible, term, definition, onClose, onSpecifyVehicle }) {
  const [vehicleInput, setVehicleInput] = useState("");
  const [showVehicleField, setShowVehicleField] = useState(false);

  if (!visible || !term) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <HankAvatar mood="confident" size={48} />
            <View style={styles.headerText}>
              <Text style={styles.hankLabel}>HANK EXPLAINS</Text>
              <Text style={styles.termTitle}>{term}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Definition */}
          <ScrollView style={styles.body}>
            <Text style={styles.definition}>{definition}</Text>

            {/* Specify vehicle for more context */}
            {!showVehicleField ? (
              <TouchableOpacity
                onPress={() => setShowVehicleField(true)}
                style={styles.specifyBtn}
              >
                <Text style={styles.specifyBtnText}>
                  🚗 Get vehicle-specific info
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.vehicleSection}>
                <Text style={styles.vehicleLabel}>
                  Enter Year/Make/Model for a tailored explanation:
                </Text>
                <TextInput
                  value={vehicleInput}
                  onChangeText={setVehicleInput}
                  placeholder="e.g. 2019 Honda Civic"
                  placeholderTextColor={COLORS.textD}
                  style={styles.vehicleInput}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (vehicleInput.trim()) {
                      onSpecifyVehicle?.(term, vehicleInput.trim());
                    }
                  }}
                  style={styles.goBtn}
                >
                  <Text style={styles.goBtnText}>Get Details →</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Close */}
          <TouchableOpacity onPress={onClose} style={styles.bottomClose}>
            <Text style={styles.bottomCloseText}>Close Window</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: { flex: 1, marginLeft: 12 },
  hankLabel: {
    fontSize: 9,
    color: COLORS.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONTS.bodyBold,
  },
  termTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 2,
  },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 24, color: COLORS.textM },
  body: { padding: 20 },
  definition: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 24,
    fontFamily: FONTS.body,
  },
  specifyBtn: {
    marginTop: 20,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specifyBtnText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: FONTS.bodyBold,
  },
  vehicleSection: { marginTop: 20 },
  vehicleLabel: {
    fontSize: 12,
    color: COLORS.textM,
    marginBottom: 8,
    fontFamily: FONTS.body,
  },
  vehicleInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: FONTS.body,
    marginBottom: 10,
  },
  goBtn: {
    backgroundColor: COLORS.accent + "22",
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
    borderRadius: BORDER_RADIUS.sm,
    padding: 10,
    alignItems: "center",
  },
  goBtnText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: "700",
    fontFamily: FONTS.bodyBold,
  },
  bottomClose: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bottomCloseText: {
    fontSize: 14,
    color: COLORS.textM,
    fontWeight: "700",
    fontFamily: FONTS.bodyBold,
  },
});
