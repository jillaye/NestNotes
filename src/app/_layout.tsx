import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDbIfNeeded } from "@/db/schema";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="nestnotes.db" onInit={migrateDbIfNeeded}>
      <Stack>
        <Stack.Screen
          name="box/[id]"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 1],
            sheetInitialDetentIndex: 1,
            sheetGrabberVisible: true,
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
