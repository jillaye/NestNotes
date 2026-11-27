import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { migrateDbIfNeeded } from "@/db/schema";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="nestnotes.db" onInit={migrateDbIfNeeded}>
      {/* Light-only app (app.json userInterfaceStyle) — keep the bar dark-on-light. */}
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen
          name="box/[id]"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 1],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="box/[id]/observe"
          options={{ presentation: "card" }}
        />
      </Stack>
    </SQLiteProvider>
  );
}
