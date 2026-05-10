import React, { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useSpots } from '@/hooks/useSpots';
import { colors, radius, spacing, typography } from '@/theme';
import type { Spot } from '@/types';

/**
 * What the picker resolves to. `kind: 'known'` is one of the spots in
 * the `spots` collection (or mockData fallback) — its id matches the
 * backend's SPOTS object so forecasts work. `kind: 'custom'` is an
 * ad-hoc spot the user typed; the dive log stores the name and
 * coordinates inline so the log is still meaningful, even though
 * the backend has no report for those coordinates yet.
 */
export type PickedSpot =
  | { kind: 'known'; id: string; name: string; lat: number; lon: number }
  | { kind: 'custom'; id: string; name: string; lat: number; lon: number };

type Props = {
  open: boolean;
  value: PickedSpot | null;
  onClose: () => void;
  onSelect: (spot: PickedSpot) => void;
};

export function SpotPicker({ open, value, onClose, onSelect }: Props) {
  const { spots } = useSpots();
  const [view, setView] = useState<'list' | 'custom'>('list');
  const [search, setSearch] = useState('');

  // Custom spot form state.
  const [customName, setCustomName] = useState('');
  const [customLat, setCustomLat] = useState('');
  const [customLon, setCustomLon] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return spots;
    const q = search.trim().toLowerCase();
    return spots.filter((s) =>
      s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q),
    );
  }, [spots, search]);

  const reset = () => {
    setView('list');
    setSearch('');
    setCustomName('');
    setCustomLat('');
    setCustomLon('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickKnown = (spot: Spot) => {
    onSelect({ kind: 'known', id: spot.id, name: spot.name, lat: spot.lat, lon: spot.lon });
    reset();
  };

  const saveCustom = () => {
    const name = customName.trim();
    const lat = Number.parseFloat(customLat);
    const lon = Number.parseFloat(customLon);
    if (!name) return Alert.alert('Spot name required', 'Give your spot a name.');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return Alert.alert('Invalid latitude', 'Latitude must be a number between -90 and 90.');
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      return Alert.alert('Invalid longitude', 'Longitude must be a number between -180 and 180.');
    }
    onSelect({
      kind: 'custom',
      id: `custom_${Date.now().toString(36)}`,
      name,
      lat,
      lon,
    });
    reset();
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={s.sheet} onPress={() => undefined}>
          <View style={s.handle} />

          {view === 'list' ? (
            <>
              <View style={s.headerRow}>
                <Text style={typography.h3}>Choose a spot</Text>
                <Pressable hitSlop={10} onPress={close}>
                  <Icon name="x" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={s.searchWrap}>
                <Icon name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search spots…"
                  placeholderTextColor={colors.textMuted}
                  style={s.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {filtered.map((spot) => {
                  const selected = value?.kind === 'known' && value.id === spot.id;
                  return (
                    <Pressable
                      key={spot.id}
                      onPress={() => pickKnown(spot)}
                      style={[s.spotRow, selected && s.spotRowSelected]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={typography.body}>{spot.name}</Text>
                        <Text style={s.spotRegion}>{spot.region}</Text>
                      </View>
                      {selected ? <Icon name="check" size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
                {filtered.length === 0 ? (
                  <Text style={s.empty}>No spots match "{search}".</Text>
                ) : null}
              </ScrollView>

              <Pressable style={s.customLink} onPress={() => setView('custom')}>
                <Icon name="plus" size={16} color={colors.accent} />
                <Text style={s.customLinkText}>Add a custom spot</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={s.headerRow}>
                <Pressable hitSlop={10} onPress={() => setView('list')}>
                  <Icon name="chevron-left" size={20} color={colors.textSecondary} />
                </Pressable>
                <Text style={typography.h3}>Add a custom spot</Text>
                <View style={{ width: 20 }} />
              </View>

              <Text style={s.helper}>
                Give your spot a name and coordinates. KaiCast won't have a
                forecast for it yet, but your dive log will record the
                location.
              </Text>

              <View style={s.field}>
                <Text style={s.label}>Spot name</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. Secret Cove"
                  placeholderTextColor={colors.textMuted}
                  style={s.input}
                />
              </View>
              <View style={s.row2}>
                <View style={s.field}>
                  <Text style={s.label}>Latitude</Text>
                  <TextInput
                    value={customLat}
                    onChangeText={setCustomLat}
                    placeholder="21.355"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    style={s.input}
                  />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>Longitude</Text>
                  <TextInput
                    value={customLon}
                    onChangeText={setCustomLon}
                    placeholder="-158.122"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numbers-and-punctuation"
                    style={s.input}
                  />
                </View>
              </View>

              <View style={s.actions}>
                <Button label="Cancel" variant="ghost" onPress={() => setView('list')} />
                <Button label="Save spot" onPress={saveCustom} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    minHeight: '55%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 999,
    backgroundColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  spotRowSelected: { backgroundColor: colors.accentSoft, borderRadius: radius.md, borderBottomColor: 'transparent' },
  spotRegion: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  empty: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  customLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  customLinkText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  helper: { ...typography.bodySm, color: colors.textMuted, lineHeight: 18 },
  field: { gap: spacing.xs, flex: 1 },
  label: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  row2: { flexDirection: 'row', gap: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
});
