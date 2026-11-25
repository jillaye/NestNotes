import { getBoxById } from "@/db/boxes";
import { getObservationsByBox } from "@/db/observations";
import { summarize, toMDY } from "@/lib/format";
import { directionsUrl } from "@/lib/maps";
import type { NestBox, Observation } from "@/types";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function BoxSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();

  const [box, setBox] = useState<NestBox | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  // Load box on mount (doesn't change)
  useEffect(() => {
    if (!id) return;
    getBoxById(db, id)
      .then((b) => {
        setBox(b);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [db, id]);

  // Refresh observations every time the screen gains focus (e.g. after saving)
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getObservationsByBox(db, id).then(setObservations);
    }, [db, id]),
  );

  const handleNavigate = useCallback(() => {
    if (!box) return;
    const url = directionsUrl(
      box.latitude,
      box.longitude,
      Platform.OS as "ios" | "android",
    );
    Linking.openURL(url).catch(() => {
      Alert.alert("Navigation Error", "Could not open the maps app.");
    });
  }, [box]);

  const handleNewObservation = useCallback(() => {
    router.push(`/box/${id}/observe` as unknown as never);
  }, [id]);

  const renderObservation = useCallback(({ item }: { item: Observation }) => {
    const summary = summarize(item);
    const parts = [`${toMDY(item.observed_on)} · ${item.inspector}`];
    if (summary) parts.push(summary);
    if (item.notes) parts.push(item.notes);

    return <Text style={styles.noteLine}>{parts.join(" · ")}</Text>;
  }, []);

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

  return (
    <View style={styles.container}>
      {/* Title rendered in content because Android sheets have no header */}
      <Stack.Screen
        options={{
          title: box.name,
        }}
      />

      <Text style={styles.title}>{box.name}</Text>

      <Text style={styles.coords}>
        {box.latitude.toFixed(6)}, {box.longitude.toFixed(6)}
      </Text>

      {observations.length > 0 && (
        <View style={styles.notesSection}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <FlatList
            data={observations}
            keyExtractor={(item) => item.id}
            renderItem={renderObservation}
            nestedScrollEnabled
            style={styles.notesList}
          />
        </View>
      )}

      {observations.length === 0 && (
        <View style={styles.emptyNotes}>
          <Text style={styles.emptyText}>No notes yet.</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <Pressable
          style={styles.button}
          onPress={handleNewObservation}
          accessibilityLabel="New Observation"
        >
          <Text style={styles.buttonText}>New Observation</Text>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={handleNavigate}
          accessibilityLabel="Navigate to this box"
        >
          <Text style={styles.buttonText}>Navigate to</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  errorText: { fontSize: 16, color: "#999" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  coords: {
    fontSize: 13,
    color: "#666",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 16,
  },
  notesSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notesList: {
    flex: 1,
  },
  noteLine: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
    marginBottom: 8,
  },
  emptyNotes: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
  buttons: {
    paddingVertical: 16,
    gap: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
