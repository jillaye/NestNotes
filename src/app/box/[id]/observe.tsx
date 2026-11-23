import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getBoxById } from "@/db/boxes";
import { addObservation } from "@/db/observations";
import { getAppState, setAppState } from "@/db/app_state";
import { parseMDY } from "@/lib/format";
import Stepper from "@/components/Stepper";
import type { NestBox } from "@/types";

type FormKind = "nest" | "box";

export default function ObserveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();

  const [box, setBox] = useState<NestBox | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formKind, setFormKind] = useState<FormKind | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  });
  const [inspector, setInspector] = useState("");
  const [notes, setNotes] = useState("");
  const [nests, setNests] = useState(0);
  const [eggs, setEggs] = useState(0);
  const [chicks, setChicks] = useState(0);
  const [cleanedOut, setCleanedOut] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load box + last inspector name
  useEffect(() => {
    if (!id) return;
    Promise.all([
      getBoxById(db, id),
      getAppState(db, "lastInspector"),
    ]).then(([b, lastInsp]) => {
      setBox(b);
      if (lastInsp) setInspector(lastInsp);
      setLoading(false);
    });
  }, [db, id]);

  // Choose form kind
  const handleChooseForm = useCallback((kind: FormKind) => {
    setFormKind(kind);
  }, []);

  // Go back to form choice
  const handleBack = useCallback(() => {
    setFormKind(null);
  }, []);

  // Save observation
  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    const isoDate = parseMDY(date);
    if (!isoDate) {
      Alert.alert("Invalid Date", "Please enter a valid date in MM/DD/YYYY format.");
      return;
    }

    if (!inspector.trim()) {
      Alert.alert("Missing Inspector", "Please enter an inspector name.");
      return;
    }

    if (!id || !box) return;

    setSaving(true);
    try {
      await setAppState(db, "lastInspector", inspector.trim());

      const kind = formKind as FormKind;

      await addObservation(db, {
        nest_box_id: id,
        kind,
        observed_on: isoDate,
        inspector: inspector.trim(),
        nests: kind === "nest" ? nests : null,
        eggs: kind === "nest" ? eggs : null,
        chicks: kind === "nest" ? chicks : null,
        cleaned_out: kind === "nest" ? cleanedOut : false,
        notes: notes.trim(),
      });

      router.back();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save observation.";
      Alert.alert("Save Error", message);
      // Keep form data on error
    } finally {
      setSaving(false);
    }
  }, [date, inspector, notes, nests, eggs, chicks, cleanedOut, formKind, id, box, db]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!box) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Box not found.</Text>
      </View>
    );
  }

  // ── Choice screen ──────────────────────────────────────────
  if (!formKind) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "New Note", presentation: "card" }} />
        <Text style={styles.boxTitle}>{box.name}</Text>
        <View style={styles.choiceContainer}>
          <Pressable
            style={styles.choiceButton}
            onPress={() => handleChooseForm("nest")}
            accessibilityLabel="Box present – Take New Note"
            accessibilityRole="button"
          >
            <Text style={styles.choiceIcon}>🪺</Text>
            <Text style={styles.choiceText}>Box present</Text>
            <Text style={styles.choiceSub}>Take New Note</Text>
          </Pressable>
          <Pressable
            style={styles.choiceButton}
            onPress={() => handleChooseForm("box")}
            accessibilityLabel="Box missing – Take New Note"
            accessibilityRole="button"
          >
            <Text style={styles.choiceIcon}>❌</Text>
            <Text style={styles.choiceText}>Box missing</Text>
            <Text style={styles.choiceSub}>Take New Note</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Form screen ────────────────────────────────────────────
  const isNest = formKind === "nest";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Stack.Screen options={{ title: isNest ? "Nest Note" : "Box Note", presentation: "card" }} />
      <View style={styles.formOuter}>
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="always"
        >
          <Pressable
            style={styles.backLink}
            onPress={handleBack}
            accessibilityLabel="Change note type"
          >
            <Text style={styles.backLinkText}>← Change type</Text>
          </Pressable>

          <Text style={styles.boxTitle}>{box.name}</Text>

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.textInput}
            value={date}
            onChangeText={setDate}
            placeholder="MM/DD/YYYY"
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Observation date"
          />

          <Text style={styles.fieldLabel}>Inspector</Text>
          <TextInput
            style={styles.textInput}
            value={inspector}
            onChangeText={setInspector}
            placeholder="Your name"
            accessibilityLabel="Inspector name"
          />

          {isNest && (
            <>
              <Stepper label="Nests" value={nests} onChange={setNests} min={0} />
              <Stepper label="Eggs" value={eggs} onChange={setEggs} min={0} />
              <Stepper label="Chicks" value={chicks} onChange={setChicks} min={0} />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Cleaned out</Text>
                <Switch
                  value={cleanedOut}
                  onValueChange={setCleanedOut}
                  accessibilityLabel="Cleaned out"
                />
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes…"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Notes"
          />
        </ScrollView>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Save observation"
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  errorText: { fontSize: 16, color: "#999" },
  boxTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: "#333" },
  choiceContainer: { flex: 1, justifyContent: "center", gap: 20, paddingHorizontal: 20 },
  choiceButton: {
    backgroundColor: "#007AFF", borderRadius: 16, paddingVertical: 28,
    alignItems: "center", minHeight: 120, justifyContent: "center",
  },
  choiceIcon: { fontSize: 36, marginBottom: 8 },
  choiceText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  choiceSub: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 4 },
  formScroll: { flex: 1 },
  formOuter: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 40 },
  backLink: {
    marginBottom: 8, alignSelf: "flex-start", paddingVertical: 4,
    minHeight: 36, justifyContent: "center",
  },
  backLinkText: { fontSize: 15, color: "#007AFF", fontWeight: "500" },
  fieldLabel: {
    fontSize: 14, fontWeight: "600", color: "#666",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  },
  textInput: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    color: "#333", backgroundColor: "#fafafa", marginBottom: 16,
  },
  notesInput: { minHeight: 80 },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: 48, marginBottom: 16,
  },
  saveButton: { backgroundColor: "#34C759", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveButtonPressed: { backgroundColor: "#2DB14F" },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});