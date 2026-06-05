// Shared form inputs for the Captain's Log filer. Built mobile-first
// (big tap targets, no free-text-when-a-chip-will-do) since the
// captain may be filing from a salt-spray-covered tablet on the dock.

import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';

// ─── ChipSelect ──────────────────────────────────────────────────────

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T | undefined;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Toggle (binary) ─────────────────────────────────────────────────

export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Number stepper ──────────────────────────────────────────────────
//
// Bigger tap target than a slider on a small viewport. Captain bumps a
// value up or down by a fixed step. Backing input is a TextInput so a
// keyboard user can still type a number directly.

export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const clamp = (n: number) => {
    let out = n;
    if (typeof min === 'number') out = Math.max(min, out);
    if (typeof max === 'number') out = Math.min(max, out);
    return out;
  };

  // Local text state so the input can hold transient values that don't
  // yet satisfy min/max — without this, typing "1" while min=10 instant-
  // clamps back to "10" and the user can never reach "15". We commit
  // unclamped numbers to onChange during typing (the surrounding form
  // validates at submit time) and clamp only on blur + on +/- buttons.
  const [text, setText] = React.useState<string>(value == null ? '' : String(value));
  // Tracks whether the displayed text is being driven by typing. When
  // true, the effect below DOESN'T sync from `value` — that would clobber
  // a partial input like "0." or "" with a re-stringified parent number.
  const editingRef = React.useRef(false);
  React.useEffect(() => {
    if (editingRef.current) return;
    setText(value == null ? '' : String(value));
  }, [value]);

  const commitTyping = (v: string) => {
    editingRef.current = true;
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    setText(cleaned);
    if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
      onChange(null);
      return;
    }
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) onChange(n);
  };

  const onBlur = () => {
    editingRef.current = false;
    if (value == null) {
      setText('');
      return;
    }
    // Only clamp DOWN to max on blur — clamping UP to min on blur is
    // user-hostile (typing "5" while min=10 instantly snaps back to "10"
    // and you can never reach "25" by hand). Form-level validation
    // catches sub-minimum values at step submit time. The +/- stepper
    // buttons still clamp both directions; this only affects keyboard
    // editing.
    let clamped = value;
    if (typeof max === 'number') clamped = Math.min(max, clamped);
    if (clamped !== value) onChange(clamped);
    setText(String(clamped));
  };

  return (
    <View style={styles.stepperWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => { editingRef.current = false; onChange(clamp((value ?? 0) - step)); }}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.stepInputWrap}>
          <TextInput
            value={text}
            onChangeText={commitTyping}
            onBlur={onBlur}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor={colors.text4}
            style={styles.stepInput}
          />
          {unit ? <Text style={styles.stepUnit}>{unit}</Text> : null}
        </View>
        <Pressable
          style={styles.stepBtn}
          onPress={() => { editingRef.current = false; onChange(clamp((value ?? 0) + step)); }}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Star rating ─────────────────────────────────────────────────────

export function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value != null && n <= value;
        return (
          <Pressable key={n} onPress={() => onChange(n as 1 | 2 | 3 | 4 | 5)} style={styles.starBtn}>
            <Text style={[styles.star, filled && styles.starFilled]}>★</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Free-text area ──────────────────────────────────────────────────

export function FreeTextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text4}
        multiline
        numberOfLines={rows}
        style={[styles.textArea, { minHeight: rows * 22 + 16 }]}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  chipText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },
  chipTextActive: { color: colors.text1 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleTrack: {
    width: 40, height: 22, padding: 2, borderRadius: 11,
    backgroundColor: colors.surface2,
  },
  toggleTrackOn: { backgroundColor: colors.accent },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.text1 },
  toggleThumbOn: { transform: [{ translateX: 18 }] },
  toggleLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.text1 },

  stepperWrap: { gap: 6, flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: colors.text1 },
  stepInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.surface1, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.hairlineStrong,
  },
  stepInput: { flex: 1, fontFamily: fonts.mono, fontSize: 14, color: colors.text1, padding: 0 },
  stepUnit: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3 },

  starsRow: { flexDirection: 'row', gap: 6 },
  starBtn: { padding: 4 },
  star: { fontSize: 30, color: colors.text4 },
  starFilled: { color: colors.accent },

  textArea: {
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.hairlineStrong,
    padding: 12,
    fontFamily: fonts.body, fontSize: 13, color: colors.text1,
    textAlignVertical: 'top',
  },
});
