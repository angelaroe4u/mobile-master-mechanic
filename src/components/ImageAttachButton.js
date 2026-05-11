// ─── IMAGE ATTACH BUTTON ─────────────────────────────────────────────────────
// Camera icon button for the Hank chat input bar. On tap, shows an action
// sheet (Take Photo / Choose from Gallery / Cancel). Returns a base64-encoded
// JPEG to its parent via onPicked, plus a short data: URI for in-chat preview.
//
// HEAVY LIFTING:
//   1. Permissions: uses expo-image-picker's permission helpers so the user
//      sees the OS prompt the first time.
//   2. Resize/compress: photos out of expo-image-picker are 3-8 MB at full
//      resolution. Vision APIs cap per-image at ~5 MB and bill by pixel
//      count. We pre-resize to 1568px on the long edge at JPEG quality 0.7
//      (typically ~200-400 KB) before handing back. Faster upload, cheaper
//      tokens, no quality loss for diagnostic photos.
//
// USAGE:
//   <ImageAttachButton
//     onPicked={({ base64, mediaType, dataUri }) => setPendingImage(...)}
//     onError={(msg) => Alert.alert("Couldn't attach photo", msg)}
//   />

import React, { useState } from "react";
import { TouchableOpacity, Text, ActionSheetIOS, Alert, Platform, StyleSheet, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { COLORS } from "../constants/theme";

const TARGET_LONG_EDGE = 1568;   // Anthropic's recommended max for vision
const JPEG_QUALITY     = 0.7;    // good-enough quality, small file
const MEDIA_TYPE       = "image/jpeg";

export default function ImageAttachButton({ onPicked, onError, disabled }) {
  const [busy, setBusy] = useState(false);

  const handleTap = () => {
    if (busy || disabled) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) launchCamera();
          else if (idx === 2) launchGallery();
        }
      );
    } else {
      // Android: small modal-style alert with three buttons.
      Alert.alert(
        "Attach a photo",
        "Show Hank what you're looking at.",
        [
          { text: "Take Photo",        onPress: launchCamera },
          { text: "Choose from Gallery", onPress: launchGallery },
          { text: "Cancel",            style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  };

  const launchCamera = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        onError && onError("Camera permission was denied. You can enable it in Settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1.0,        // grab full quality, we resize ourselves
        exif: false,
      });
      await handlePickerResult(result);
    } catch (e) {
      onError && onError(e?.message || "Couldn't open camera.");
    } finally {
      setBusy(false);
    }
  };

  const launchGallery = async () => {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        onError && onError("Photo library permission was denied. You can enable it in Settings.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
        exif: false,
      });
      await handlePickerResult(result);
    } catch (e) {
      onError && onError(e?.message || "Couldn't open photo library.");
    } finally {
      setBusy(false);
    }
  };

  const handlePickerResult = async (result) => {
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      onError && onError("Couldn't read the selected photo.");
      return;
    }
    // Resize + recompress + base64 in one pass. ImageManipulator handles
    // EXIF rotation automatically so portraits don't end up sideways.
    const longEdge = Math.max(asset.width || TARGET_LONG_EDGE, asset.height || TARGET_LONG_EDGE);
    const scale = longEdge > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / longEdge : 1;
    const targetW = Math.round((asset.width || TARGET_LONG_EDGE) * scale);

    const processed = await ImageManipulator.manipulateAsync(
      asset.uri,
      scale < 1 ? [{ resize: { width: targetW } }] : [],
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!processed.base64) {
      onError && onError("Couldn't process the photo.");
      return;
    }

    onPicked && onPicked({
      base64:    processed.base64,
      mediaType: MEDIA_TYPE,
      dataUri:   `data:${MEDIA_TYPE};base64,${processed.base64}`,
      width:     processed.width,
      height:    processed.height,
    });
  };

  return (
    <TouchableOpacity
      onPress={handleTap}
      disabled={busy || disabled}
      style={[styles.btn, (busy || disabled) && { opacity: 0.5 }]}
      accessibilityLabel="Attach photo"
      accessibilityRole="button"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={COLORS.accent} />
      ) : (
        <Text style={styles.icon}>📷</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  icon: {
    fontSize: 22,
  },
});
