import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDbIfNeeded } from "@/db/schema";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="nestnotes.db" onInit={migrateDbIfNeeded}>
      <Stack />
    </SQLiteProvider>
  );
}
