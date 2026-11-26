import type { CollectionWithCounts } from "@/db/collections";
import {
  deleteCollection,
  exportCollection,
  getAllCollections,
  importCollection,
} from "@/db/collections";
import { parseCollection } from "@/lib/geojson";
import { LOCAL_USER } from "@/lib/permissions";
import * as DocumentPicker from "expo-document-picker";
import { router, Stack, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function CollectionPicker() {
  const db = useSQLiteContext();
  const [collections, setCollections] = useState<CollectionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAllCollections(db)
        .then(setCollections)
        .finally(() => setLoading(false));
    }, [db]),
  );

  const refresh = useCallback(async () => {
    const data = await getAllCollections(db);
    setCollections(data);
  }, [db]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/geo+json", "application/json", "*/*"],
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      setImporting(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const text = await response.text();
      const parsed = parseCollection(text);

      if (parsed.boxes.length === 0) {
        const reason =
          parsed.skipped > 0
            ? `All ${parsed.skipped} features were skipped due to invalid geometry or coordinates.`
            : "No valid nest boxes found in the file.";
        Alert.alert("Import Error", reason);
        return;
      }

      const collectionName = parsed.name || asset.name.replace(/\.[^.]+$/, "");
      await importCollection(db, { ...parsed, name: collectionName });
      await refresh();
      const successMsg =
        parsed.skipped > 0
          ? `Imported ${parsed.boxes.length} box${parsed.boxes.length !== 1 ? "es" : ""}, skipped ${parsed.skipped} feature${parsed.skipped !== 1 ? "s" : ""}.`
          : `Imported ${parsed.boxes.length} box${parsed.boxes.length !== 1 ? "es" : ""}.`;
      Alert.alert("Import Successful", successMsg);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to import file.";
      Alert.alert("Import Error", message);
    } finally {
      setImporting(false);
    }
  }, [db, refresh]);
  const handleDelete = useCallback(
    (collection: CollectionWithCounts) => {
      const nounBox = collection.box_count === 1 ? "box" : "boxes";
      const nounObs = collection.observation_count === 1 ? "note" : "notes";
      Alert.alert(
        "Delete",
        `Delete "${collection.name}"? This removes ${collection.box_count} ${nounBox} and ${collection.observation_count} ${nounObs} from this phone.`,
        [
          { text: "Cancel", style: "cancel", isPreferred: true },
          {
            text: "Export first",
            onPress: async () => {
              try {
                await exportCollection(db, collection);
              } catch (error: unknown) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to export collection.";
                Alert.alert("Export Error", message);
              }
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteCollection(db, LOCAL_USER, collection.id);
                await refresh();
              } catch (error: unknown) {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to delete collection.";
                Alert.alert("Error", message);
              }
            },
          },
        ],
      );
    },
    [db, refresh],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "NestNotes" }} />

      {collections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No collections yet.{"\n"}Import a GeoJSON file to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={styles.rowLink}
                onPress={() =>
                  router.push(`/collection/${item.id}` as unknown as never)
                }
              >
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowCount}>
                  {item.box_count} box{item.box_count !== 1 ? "es" : ""}
                </Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                accessibilityLabel={`Delete ${item.name}`}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteText}>🗑</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          style={styles.importButton}
          onPress={handleImport}
          disabled={importing}
          accessibilityLabel="Import collection from file"
        >
          <Text style={styles.importButtonText}>
            {importing ? "Importing…" : "Import collection"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    minHeight: 48,
  },
  rowLink: { flex: 1, paddingVertical: 12 },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowCount: { fontSize: 13, color: "#666", marginTop: 2 },
  deleteButton: {
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { fontSize: 20 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  importButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  importButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
