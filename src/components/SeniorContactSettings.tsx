import { useEffect, useState, type ReactNode } from "react";
import { View, Text, Image, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { pickAndUploadAvatar } from "@/lib/uploadAvatar";
import { speak } from "@/lib/speech";
import { VOICE_OPTIONS, VOICE_PREVIEW_TEXT } from "@/lib/voiceOptions";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { colors } from "@/theme/colors";
import type { LinkedSenior } from "@/hooks/useLinkedSeniors";

interface Props {
  senior: LinkedSenior;
  onSeniorAvatarChanged: () => void;
}

export function SeniorContactSettings({ senior, onSeniorAvatarChanged }: Props) {
  const { settings, loading: loadingSettings, reload } = useCompanionSettings(senior.seniorId);
  const [relationship, setRelationship] = useState(senior.relationship ?? "");
  const [companionName, setCompanionName] = useState(settings.companion_name);
  const [nickname, setNickname] = useState(settings.senior_nickname ?? "");
  const [voiceId, setVoiceId] = useState(settings.voice_id ?? VOICE_OPTIONS[0].voiceId);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Settings load async after mount — sync local drafts once they arrive.
  useEffect(() => {
    if (!loadingSettings) {
      setCompanionName(settings.companion_name);
      setNickname(settings.senior_nickname ?? "");
      setVoiceId(settings.voice_id ?? VOICE_OPTIONS[0].voiceId);
    }
  }, [loadingSettings, settings.companion_name, settings.senior_nickname, settings.voice_id]);

  async function saveRelationship() {
    const value = relationship.trim();
    if (!value || value === senior.relationship) return;
    setSavingField("relationship");
    const { error } = await supabase.from("senior_family_links").update({ relationship: value }).eq("id", senior.linkId);
    setSavingField(null);
    if (error) Alert.alert("Couldn't save", "Please try again.");
  }

  async function saveCompanionSettings(patch: Partial<{ companion_name: string; senior_nickname: string | null; voice_id: string }>) {
    setSavingField(Object.keys(patch)[0]);
    const { error } = await supabase
      .from("companion_settings")
      .upsert({ senior_id: senior.seniorId, companion_name: companionName, senior_nickname: nickname || null, voice_id: voiceId, ...patch });
    setSavingField(null);
    if (error) {
      Alert.alert("Couldn't save", "Please try again.");
      return;
    }
    reload();
  }

  async function handlePreviewVoice(id: string) {
    setPreviewingVoice(id);
    try {
      await speak(VOICE_PREVIEW_TEXT, id);
    } finally {
      setPreviewingVoice(null);
    }
  }

  async function handleChangeSeniorAvatar() {
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(senior.seniorId);
      if (!url) return;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", senior.seniorId);
      if (error) throw error;
      onSeniorAvatarChanged();
    } catch {
      Alert.alert("Couldn't update photo", "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={handleChangeSeniorAvatar} disabled={uploadingAvatar} accessibilityRole="button" accessibilityLabel={`Change ${senior.fullName}'s photo`}>
          {senior.avatarUrl ? (
            <Image source={{ uri: senior.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{senior.fullName[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          )}
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={colors.white} size="small" />
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.seniorName}>{senior.fullName}</Text>
          {senior.isEmergencyContact && <Text style={styles.badge}>Emergency contact</Text>}
          <Pressable onPress={handleChangeSeniorAvatar} disabled={uploadingAvatar}>
            <Text style={styles.changePhotoText}>Change their photo</Text>
          </Pressable>
        </View>
      </View>

      <Field label="Your relationship" hint='Shows on your call bubble, e.g. "Son", "Daughter", "Neighbor"'>
        <TextInput
          style={styles.input}
          value={relationship}
          onChangeText={setRelationship}
          onBlur={saveRelationship}
          placeholder="Relationship"
          accessibilityLabel={`Your relationship to ${senior.fullName}`}
        />
      </Field>

      <Field label="Companion's name" hint="What the AI companion calls itself">
        <TextInput
          style={styles.input}
          value={companionName}
          onChangeText={setCompanionName}
          onBlur={() => saveCompanionSettings({ companion_name: companionName || "SilverBeam" })}
          placeholder="SilverBeam"
        />
      </Field>

      <Field label={`What it calls ${senior.fullName.split(" ")[0]}`} hint='e.g. "Grandma Sue" instead of their full name — only used in conversation'>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          onBlur={() => saveCompanionSettings({ senior_nickname: nickname || null })}
          placeholder={senior.fullName}
        />
      </Field>

      <Field label="Companion's voice" hint="A preference for now — spoken replies use this voice">
        <View style={styles.voiceGrid}>
          {VOICE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.voiceId}
              style={[styles.voiceOption, voiceId === opt.voiceId && styles.voiceOptionSelected]}
              onPress={() => {
                setVoiceId(opt.voiceId);
                saveCompanionSettings({ voice_id: opt.voiceId });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select voice: ${opt.label}`}
            >
              <Text style={[styles.voiceLabel, voiceId === opt.voiceId && styles.voiceLabelSelected]}>{opt.label}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => handlePreviewVoice(opt.voiceId)}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${opt.label} voice`}
              >
                {previewingVoice === opt.voiceId ? (
                  <ActivityIndicator size="small" color={voiceId === opt.voiceId ? colors.white : colors.terracotta} />
                ) : (
                  <Ionicons name="play-circle" size={22} color={voiceId === opt.voiceId ? colors.white : colors.terracotta} />
                )}
              </Pressable>
            </Pressable>
          ))}
        </View>
      </Field>

      {savingField && (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={colors.terracotta} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 14, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: colors.sageLight, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 22, fontWeight: "700", color: colors.navy },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  seniorName: { fontSize: 17, fontWeight: "700", color: colors.text },
  badge: { fontSize: 12, color: "#5F7355", fontWeight: "700" },
  changePhotoText: { fontSize: 13, fontWeight: "600", color: colors.terracotta, marginTop: 2 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.navy },
  fieldHint: { fontSize: 12, color: colors.textMuted, marginTop: -4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.cream,
  },
  voiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  voiceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.cream,
  },
  voiceOptionSelected: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  voiceLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  voiceLabelSelected: { color: colors.white },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  savingText: { fontSize: 12, color: colors.textMuted },
});
