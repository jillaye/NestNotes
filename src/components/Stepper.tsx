import { useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";

interface StepperProps {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}

export default function Stepper({
  label,
  value,
  min = 0,
  onChange,
}: StepperProps) {
  const decrement = useCallback(() => {
    const next = value - 1;
    if (next >= min) onChange(next);
  }, [value, min, onChange]);

  const increment = useCallback(() => {
    onChange(value + 1);
  }, [value, onChange]);

  const handleTextChange = useCallback(
    (text: string) => {
      // Allow clearing the field (reset to min)
      if (text === "") {
        onChange(min);
        return;
      }
      const parsed = parseInt(text, 10);
      if (!isNaN(parsed) && parsed >= min) {
        onChange(parsed);
      }
    },
    [min, onChange],
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label} accessibilityLabel={label}>
        {label}
      </Text>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            value <= min && styles.btnDisabled,
            pressed && value > min && styles.btnPressed,
          ]}
          onPress={decrement}
          disabled={value <= min}
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, value <= min && styles.btnTextDisabled]}>
            −
          </Text>
        </Pressable>

        <TextInput
          style={styles.input}
          value={String(value)}
          onChangeText={handleTextChange}
          keyboardType="number-pad"
          accessibilityLabel={`${label} value`}
        />

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.btnPressed,
          ]}
          onPress={increment}
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // ponytail: minHeight (not height) so the control grows with the OS font size
  // instead of clipping its glyph. Ceiling: the fixed 48px tap width can clip "−"/"+"
  // at the extreme 3.2× accessibility scale — widen if that ever matters.
  btn: {
    width: 48,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    backgroundColor: "#f0f0f0",
  },
  btnPressed: {
    backgroundColor: "#ccc",
  },
  btnText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
  },
  btnTextDisabled: {
    color: "#bbb",
  },
  input: {
    width: 64,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
