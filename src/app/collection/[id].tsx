import { getBoxesByCollection } from "@/db/boxes";
import { getCollectionById } from "@/db/collections";
import type { Collection, NestBox } from "@/types";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function CollectionMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const mapRef = useRef<MapView>(null);
  const isFittedRef = useRef(false);

  const [collection, setCollection] = useState<Collection | null>(null);
  const [boxes, setBoxes] = useState<NestBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [mapLayoutDone, setMapLayoutDone] = useState(false);

  // Load collection and boxes from DB
  useEffect(() => {
    if (!id) return;
    Promise.all([getCollectionById(db, id), getBoxesByCollection(db, id)])
      .then(([col, bxs]) => {
        setCollection(col);
        setBoxes(bxs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [db, id]);

  // Header title set via Stack.Screen below

  // Request location permission (non-blocking — map works without it)
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") {
        setLocationDenied(true);
      }
    });
  }, []);

  // fitToCoordinates once both the map layout and box data are ready
  useEffect(() => {
    if (
      mapLayoutDone &&
      boxes.length > 0 &&
      !isFittedRef.current &&
      mapRef.current
    ) {
      isFittedRef.current = true;
      const coords = boxes.map((b) => ({
        latitude: b.latitude,
        longitude: b.longitude,
      }));
      // Small delay to let the native map engine initialise
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [mapLayoutDone, boxes]);

  const onLayout = useCallback(() => {
    setMapLayoutDone(true);
  }, []);

  const handleMarkerPress = useCallback((boxId: string) => {
    router.push(`/box/${boxId}` as unknown as never);
  }, []);

  // Memoise markers so they don't re-render on every state change
  const markers = useMemo(
    () =>
      boxes.map((box) => (
        <Marker
          key={box.id}
          coordinate={{ latitude: box.latitude, longitude: box.longitude }}
          title={box.name}
          onPress={() => handleMarkerPress(box.id)}
        />
      )),
    [boxes, handleMarkerPress],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Collection not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: collection?.name ?? "Collection" }} />

      {locationDenied && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Location access denied. Map still works, but your position is
            hidden.
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton
        onLayout={onLayout}
      >
        {markers}
      </MapView>

      {/* Add box — reserved for v2 */}
      <View style={styles.addBoxContainer}>
        <Pressable
          style={styles.addBoxButton}
          disabled
          accessibilityLabel="Add box (coming in a future version)"
        >
          <Text style={styles.addBoxText}>+ Add box (v2)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  errorText: { fontSize: 16, color: "#999" },
  banner: {
    backgroundColor: "#FFF3CD",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerText: { fontSize: 13, color: "#856404" },
  map: { flex: 1 },
  addBoxContainer: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
  },
  addBoxButton: {
    backgroundColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    opacity: 0.6,
  },
  addBoxText: { fontSize: 16, fontWeight: "600", color: "#666" },
});
