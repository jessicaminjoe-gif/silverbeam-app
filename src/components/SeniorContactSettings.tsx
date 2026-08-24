import { useEffect, useState, type ReactNode } from "react";
import { View, Text, Image, Pressable, TextInput, Switch, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { pickAndUploadAvatar } from "@/lib/uploadAvatar";
import { speak } from "@/lib/speech";
import { VOICE_OPTIONS, VOICE_PREVIEW_TEXT } from "@/lib/voiceOptions";
import { useCompanionSettings } from "@/hooks/useCompanionSettings";
import { useReminders } from "@/hooks/useReminders";
import { colors } from "@/theme/colors";
import type { LinkedSenior } from "@/hooks/useLinkedSeniors";
import type { CheckInOption, ReminderRecurrence } from "@/types/database";

const MAX_CHECK_IN_OPTIONS = 5;
const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: "once", label: "One time" },
  { value: "yearly", label: "Every year" },
  { value: "daily", label: "Every day" },
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface Props {
  senior: LinkedSenior;
  onChanged: () => void;
}

export function SeniorContactSettings({ senior, onChanged }: Props) {
  const { settings, loading: loadingSettings, reload } = useCompanionSettings(senior.seniorId);
  const { reminders, addReminder, removeReminder } = useReminders(senior.seniorId);
  const [relationship, setRelationship] = useState(senior.relationship ?? "");
  const [nickname, setNickname] = useState(settings.senior_nickname ?? "");
  const [voiceId, setVoiceId] = useState(settings.voice_id ?? VOICE_OPTIONS[0].voiceId);
  const [checkInOptions, setCheckInOptions] = useState<CheckInOption[]>(settings.check_in_options);
  const [locationZip, setLocationZip] = useState(settings.location_zip ?? "");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderRecurrence, setNewReminderRecurrence] = useState<ReminderRecurrence>("once");
  const [newReminderDate, setNewReminderDate] = useState("");
  const [addingReminder, setAddingReminder] = useState(false);

  // The voice IS the name -- see voiceOptions.ts. Falls back to the first
  // option's name if voiceId somehow doesn't match any (shouldn't happen
  // outside a stale/removed preset).
  const companionName = VOICE_OPTIONS.find((o) => o.voiceId === voiceId)?.name ?? VOICE_OPTIONS[0].name;

  // Settings load async after mount — sync local drafts once they arrive.
  useEffect(() => {
    if (!loadingSettings) {
      setNickname(settings.senior_nickname ?? "");
      setVoiceId(settings.voice_id ?? VOICE_OPTIONS[0].voiceId);
      setCheckInOptions(settings.check_in_options);
      setLocationZip(settings.location_zip ?? "");
    }
  }, [loadingSettings, settings.senior_nickname, settings.voice_id, settings.check_in_options, settings.location_zip]);

  async function saveRelationship() {
    const value = relationship.trim();
    if (!value || value === senior.relationship) return;
    setSavingField("relationship");
    const { error } = await supabase.from("senior_family_links").update({ relationship: value }).eq("id", senior.linkId);
    setSavingField(null);
    if (error) Alert.alert("Couldn't save", "Please try again.");
  }

  async function saveCompanionSettings(
    patch: Partial<{
      companion_name: string;
      senior_nickname: string | null;
      voice_id: string;
      check_in_options: CheckInOption[];
      location_zip: string | null;
      briefing_weather: boolean;
      briefing_news: boolean;
      briefing_reminders: boolean;
    }>
  ) {
    setSavingField(Object.keys(patch)[0]);
    const { error } = await supabase.from("companion_settings").upsert({
      senior_id: senior.seniorId,
      companion_name: companionName,
      senior_nickname: nickname || null,
      voice_id: voiceId,
      check_in_options: checkInOptions,
      location_zip: locationZip || null,
      briefing_weather: settings.briefing_weather,
      briefing_news: settings.briefing_news,
      briefing_reminders: settings.briefing_reminders,
      ...patch,
    });
    setSavingField(null);
    if (error) {
      Alert.alert("Couldn't save", "Please try again.");
      return;
    }
    reload();
  }

  async function handleAddReminder() {
    const title = newReminderTitle.trim();
    if (!title) return;
    if (newReminderRecurrence !== "daily" && !DATE_PATTERN.test(newReminderDate)) {
      Alert.alert("Add a date", "Enter the date as YYYY-MM-DD.");
      return;
    }
    setAddingReminder(true);
    const { error } = await addReminder({
      title,
      recurrence: newReminderRecurrence,
      remind_on: newReminderRecurrence === "daily" ? null : newReminderDate,
    });
    setAddingReminder(false);
    if (error) {
      Alert.alert("Couldn't add reminder", "Please try again.");
      return;
    }
    setNewReminderTitle("");
    setNewReminderDate("");
    setNewReminderRecurrence("once");
  }

  function updateCheckInOption(index: number, patch: Partial<CheckInOption>) {
    setCheckInOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
  }

  function addCheckInOption() {
    if (checkInOptions.length >= MAX_CHECK_IN_OPTIONS) return;
    const next = [...checkInOptions, { label: "", emoji: "🙂" }];
    setCheckInOptions(next);
  }

  function removeCheckInOption(index: number) {
    const next = checkInOptions.filter((_, i) => i !== index);
    setCheckInOptions(next);
    saveCompanionSettings({ check_in_options: next });
  }

  async function handlePreviewVoice(id: string) {
    setPreviewingVoice(id);
    try {
      const result = await speak(VOICE_PREVIEW_TEXT, id);
      if (!result.ok) {
        Alert.alert("Couldn't play preview", result.errorMessage ?? "Please try again.");
      }
    } finally {
      setPreviewingVoice(null);
    }
  }

  function handleRemove() {
    Alert.alert(
      "Remove this connection?",
      `You'll stop seeing ${senior.fullName}'s updates and alerts. This can't be undone from the app — you'd need to be re-linked.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("senior_family_links").delete().eq("id", senior.linkId);
            if (error) {
              Alert.alert("Couldn't remove", "Please try again.");
              return;
            }
            onChanged();
          },
        },
      ]
    );
  }

  async function handleChangeSeniorAvatar() {
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(senior.seniorId);
      if (!url) return;
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", senior.seniorId);
      if (error) throw error;
      onChanged();
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
        <Pressable onPress={handleRemove} accessibilityRole="button" accessibilityLabel={`Remove ${senior.fullName}`} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Selectable (long-press to copy) so it can be sent to the SilverBeam
          team if this senior's device ever needs to be re-linked, e.g.
          after a reinstall. */}
      <Text style={styles.seniorIdText} selectable>
        Senior ID: {senior.seniorId}
      </Text>

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

      <Field label={`What it calls ${senior.fullName.split(" ")[0]}`} hint='e.g. "Grandma Sue" instead of their full name — only used in conversation'>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          onBlur={() => saveCompanionSettings({ senior_nickname: nickname || null })}
          placeholder={senior.fullName}
        />
      </Field>

      <Field label="Companion's name & voice" hint="Picking a voice names the companion -- they're paired so the voice always matches its name">
        <View style={styles.voiceGrid}>
          {VOICE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.voiceId}
              style={[styles.voiceOption, voiceId === opt.voiceId && styles.voiceOptionSelected]}
              onPress={() => {
                setVoiceId(opt.voiceId);
                saveCompanionSettings({ voice_id: opt.voiceId, companion_name: opt.name });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select ${opt.name}: ${opt.label}`}
            >
              <View>
                <Text style={[styles.voiceName, voiceId === opt.voiceId && styles.voiceLabelSelected]}>{opt.name}</Text>
                <Text style={[styles.voiceLabel, voiceId === opt.voiceId && styles.voiceLabelSelected]}>{opt.label}</Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => handlePreviewVoice(opt.voiceId)}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${opt.name}'s voice`}
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

      <Field label="Check-in options" hint={`Up to ${MAX_CHECK_IN_OPTIONS} choices for "How are you feeling today?"`}>
        <View style={{ gap: 8 }}>
          {checkInOptions.map((option, index) => (
            <View key={index} style={styles.checkInOptionRow}>
              <TextInput
                style={styles.checkInEmojiInput}
                value={option.emoji}
                onChangeText={(text) => updateCheckInOption(index, { emoji: text })}
                onBlur={() => saveCompanionSettings({ check_in_options: checkInOptions })}
                maxLength={4}
                accessibilityLabel={`Emoji for option ${index + 1}`}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={option.label}
                onChangeText={(text) => updateCheckInOption(index, { label: text })}
                onBlur={() => saveCompanionSettings({ check_in_options: checkInOptions })}
                placeholder="Option label"
                accessibilityLabel={`Label for option ${index + 1}`}
              />
              <Pressable
                onPress={() => removeCheckInOption(index)}
                disabled={checkInOptions.length <= 1}
                accessibilityRole="button"
                accessibilityLabel={`Remove option ${index + 1}`}
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color={checkInOptions.length <= 1 ? colors.border : colors.textMuted}
                />
              </Pressable>
            </View>
          ))}
          {checkInOptions.length < MAX_CHECK_IN_OPTIONS && (
            <Pressable onPress={addCheckInOption} accessibilityRole="button" accessibilityLabel="Add check-in option">
              <Text style={styles.addOptionText}>+ Add option</Text>
            </Pressable>
          )}
        </View>
      </Field>

      <Field label="Daily greeting" hint="What the companion offers when the app opens for the first time each day">
        <View style={{ gap: 10 }}>
          <TextInput
            style={styles.input}
            value={locationZip}
            onChangeText={setLocationZip}
            onBlur={() => saveCompanionSettings({ location_zip: locationZip || null })}
            placeholder="ZIP code for weather"
            keyboardType="number-pad"
            maxLength={5}
            accessibilityLabel="ZIP code for weather"
          />
          <ToggleRow
            label="Weather"
            value={settings.briefing_weather}
            onChange={(value) => saveCompanionSettings({ briefing_weather: value })}
          />
          <ToggleRow
            label="News headlines"
            value={settings.briefing_news}
            onChange={(value) => saveCompanionSettings({ briefing_news: value })}
          />
          <ToggleRow
            label="Reminders"
            value={settings.briefing_reminders}
            onChange={(value) => saveCompanionSettings({ briefing_reminders: value })}
          />
        </View>
      </Field>

      <Field label="Reminders" hint="Birthdays, anniversaries, medications -- anything worth a nudge">
        <View style={{ gap: 10 }}>
          {reminders.map((reminder) => (
            <View key={reminder.id} style={styles.reminderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderTitle}>{reminder.title}</Text>
                <Text style={styles.reminderMeta}>
                  {reminder.recurrence === "daily"
                    ? "Every day"
                    : reminder.recurrence === "yearly"
                      ? `Every year · ${reminder.remind_on}`
                      : reminder.remind_on ?? ""}
                </Text>
              </View>
              <Pressable
                onPress={() => removeReminder(reminder.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove reminder ${reminder.title}`}
                hitSlop={8}
              >
                <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}

          <View style={styles.addReminderForm}>
            <TextInput
              style={styles.input}
              value={newReminderTitle}
              onChangeText={setNewReminderTitle}
              placeholder="e.g. Take blood pressure medicine"
              accessibilityLabel="New reminder title"
            />
            <View style={styles.recurrenceRow}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.recurrenceOption, newReminderRecurrence === opt.value && styles.recurrenceOptionSelected]}
                  onPress={() => setNewReminderRecurrence(opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <Text style={[styles.recurrenceText, newReminderRecurrence === opt.value && styles.recurrenceTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {newReminderRecurrence !== "daily" && (
              <TextInput
                style={styles.input}
                value={newReminderDate}
                onChangeText={setNewReminderDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
                accessibilityLabel="Reminder date"
              />
            )}
            <Pressable
              style={styles.addReminderButton}
              onPress={handleAddReminder}
              disabled={addingReminder || !newReminderTitle.trim()}
              accessibilityRole="button"
              accessibilityLabel="Add reminder"
            >
              {addingReminder ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.addReminderButtonText}>Add reminder</Text>
              )}
            </Pressable>
          </View>
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

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.sage }}
        thumbColor={colors.white}
        accessibilityLabel={label}
      />
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
  seniorIdText: { fontSize: 11, color: colors.textMuted, marginTop: -8 },
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
  voiceName: { fontSize: 15, fontWeight: "700", color: colors.navy },
  voiceLabel: { fontSize: 12, color: colors.textMuted },
  voiceLabelSelected: { color: colors.white },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  savingText: { fontSize: 12, color: colors.textMuted },
  checkInOptionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkInEmojiInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 18,
    width: 48,
    textAlign: "center",
    backgroundColor: colors.cream,
  },
  addOptionText: { fontSize: 14, fontWeight: "600", color: colors.terracotta },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { fontSize: 15, color: colors.text },
  reminderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reminderTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  reminderMeta: { fontSize: 12, color: colors.textMuted },
  addReminderForm: { gap: 8, paddingTop: 4 },
  recurrenceRow: { flexDirection: "row", gap: 8 },
  recurrenceOption: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    backgroundColor: colors.cream,
  },
  recurrenceOptionSelected: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  recurrenceText: { fontSize: 13, fontWeight: "600", color: colors.text },
  recurrenceTextSelected: { color: colors.white },
  addReminderButton: {
    backgroundColor: colors.terracotta,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  addReminderButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});
