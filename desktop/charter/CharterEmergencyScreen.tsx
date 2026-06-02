// CharterEmergencyScreen — one-tap reference, designed for the moment
// someone actually needs it. Big readable type, high contrast, no
// marketing chrome. Phone numbers and address links are real and
// tap-to-act on every device.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import type { NavigateFn } from '../router';

const USCG_PHONE = '+1-808-842-2600';
const HSP_PHONE  = '+1-808-723-3300';            // Honolulu Police, non-emergency line for water-patrol routing
const QUEENS_PHONE = '+1-808-538-9011';          // Queen's Medical Center main line
const QUEENS_ADDRESS = '1301 Punchbowl St, Honolulu, HI 96813';
const DLNR_DOCARE_HOTLINE = '+1-808-643-3567';   // DLNR Division of Conservation & Resources Enforcement statewide hotline (DOCARE)
const DAN_DIVE_HOTLINE = '+1-919-684-9111';      // Divers Alert Network 24-hr emergency hotline

type GpsState =
  | { kind: 'unknown' }
  | { kind: 'requesting' }
  | { kind: 'ready'; lat: number; lng: number; accuracyM: number; ts: number }
  | { kind: 'denied' | 'unavailable'; message: string };

export function CharterEmergencyScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const [gps, setGps] = React.useState<GpsState>({ kind: 'unknown' });

  const requestGps = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps({ kind: 'unavailable', message: 'Geolocation not available in this browser.' });
      return;
    }
    setGps({ kind: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({
        kind: 'ready',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        ts: Date.now(),
      }),
      (err) => setGps({
        kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        message: err.message || 'Could not read location.',
      }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }, []);

  // Auto-request on mount — in an emergency the user shouldn't have to
  // tap a button before the coordinates appear. The browser still
  // prompts for permission the first time, but on subsequent visits
  // it's instant.
  React.useEffect(() => {
    requestGps();
  }, [requestGps]);

  return (
    <CharterShell active="charter-emergency" onNavigate={onNavigate}>
      <View style={styles.header}>
        <Text style={styles.title}>Emergency</Text>
        <Text style={styles.subtitle}>
          One-tap contacts + your current GPS. In a life-safety situation, call 911 first — these
          numbers route to the agencies you'd ask 911 to dispatch.
        </Text>
      </View>

      {/* GPS readout — big, copyable, refreshable */}
      <GpsCard gps={gps} onRefresh={requestGps} />

      {/* Primary contacts */}
      <ContactRow
        priority="primary"
        label="US Coast Guard — Sector Honolulu"
        sub="Sea + air rescue, vessel-in-distress, medevac coordination"
        phone={USCG_PHONE}
      />
      <ContactRow
        priority="primary"
        label="Divers Alert Network (DAN)"
        sub="24-hour dive medicine + chamber referral. Free even if not a member."
        phone={DAN_DIVE_HOTLINE}
      />
      <ContactRow
        priority="primary"
        label="The Queen's Medical Center"
        sub="Nearest hyperbaric chamber on Oahu — call before transporting"
        phone={QUEENS_PHONE}
        secondaryAction={{
          label: 'Directions',
          href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(QUEENS_ADDRESS)}`,
        }}
        sub2={QUEENS_ADDRESS}
      />

      {/* Secondary contacts */}
      <ContactRow
        priority="secondary"
        label="HPD / HSP Water Patrol"
        sub="Honolulu Police Department — non-emergency dispatch routes to water patrol"
        phone={HSP_PHONE}
      />
      <ContactRow
        priority="secondary"
        label="DLNR DOCARE Hotline"
        sub="Marine wildlife incidents, illegal take, protected-species strandings"
        phone={DLNR_DOCARE_HOTLINE}
      />

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>Before you call</Text>
        <Text style={styles.disclaimerBody}>
          1. Are you and the patient safe? Move to the nearest secure surface first.{'\n'}
          2. Read your GPS coordinates from the card above — every dispatcher will ask first.{'\n'}
          3. Vessel name, # of people aboard, nature of emergency, current vitals if injured.{'\n'}
          4. Stay on the line — don't hang up to call the next number; the dispatcher will conference.
        </Text>
      </View>
    </CharterShell>
  );
}

// ─── GPS card ────────────────────────────────────────────────────────

function GpsCard({ gps, onRefresh }: { gps: GpsState; onRefresh: () => void }) {
  let body: React.ReactNode;
  let copyText: string | null = null;
  if (gps.kind === 'requesting' || gps.kind === 'unknown') {
    body = <Text style={styles.gpsPlaceholder}>Reading current position…</Text>;
  } else if (gps.kind === 'ready') {
    const latStr = formatLatLng(gps.lat, 'NS');
    const lngStr = formatLatLng(gps.lng, 'EW');
    copyText = `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`;
    body = (
      <View>
        <Text style={styles.gpsCoord}>{latStr}</Text>
        <Text style={styles.gpsCoord}>{lngStr}</Text>
        <Text style={styles.gpsMeta}>
          ± {Math.round(gps.accuracyM)} m · read {Math.round((Date.now() - gps.ts) / 1000)}s ago
        </Text>
      </View>
    );
  } else {
    body = (
      <Text style={styles.gpsError}>
        Location unavailable — {gps.message}. Tap Refresh to retry; check that location permission
        is granted for this site.
      </Text>
    );
  }
  return (
    <View style={styles.gpsCard}>
      <View style={styles.gpsHeaderRow}>
        <Text style={styles.gpsLabel}>YOUR POSITION</Text>
        <Pressable onPress={onRefresh} style={styles.gpsRefreshBtn}>
          <Text style={styles.gpsRefreshText}>Refresh</Text>
        </Pressable>
      </View>
      {body}
      {copyText ? (
        <Pressable
          onPress={() => {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(copyText!).catch(() => undefined);
            }
          }}
          style={styles.gpsCopyBtn}
        >
          <Text style={styles.gpsCopyText}>Copy decimal pair</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatLatLng(value: number, axis: 'NS' | 'EW'): string {
  const hemi = value >= 0 ? axis[0] : axis[1];
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = (minFull - min) * 60;
  return `${deg}° ${String(min).padStart(2, '0')}' ${sec.toFixed(2)}" ${hemi}`;
}

// ─── Contact row ─────────────────────────────────────────────────────

function ContactRow({
  priority,
  label,
  sub,
  sub2,
  phone,
  secondaryAction,
}: {
  priority: 'primary' | 'secondary';
  label: string;
  sub: string;
  sub2?: string;
  phone: string;
  secondaryAction?: { label: string; href: string };
}) {
  const onCall = () => Linking.openURL(`tel:${phone}`).catch(() => undefined);
  return (
    <View style={[styles.contactRow, priority === 'primary' && styles.contactRowPrimary]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.contactLabel, priority === 'primary' && styles.contactLabelPrimary]}>
          {label}
        </Text>
        <Text style={styles.contactSub}>{sub}</Text>
        {sub2 ? <Text style={styles.contactSub}>{sub2}</Text> : null}
      </View>
      <View style={styles.contactActionCol}>
        <Pressable onPress={onCall} style={[styles.callBtn, priority === 'primary' && styles.callBtnPrimary]}>
          <Text style={[styles.callBtnText, priority === 'primary' && styles.callBtnTextPrimary]}>
            Call {formatPhone(phone)}
          </Text>
        </Pressable>
        {secondaryAction ? (
          <Pressable
            onPress={() => Linking.openURL(secondaryAction.href).catch(() => undefined)}
            style={styles.secondaryActionBtn}
          >
            <Text style={styles.secondaryActionText}>{secondaryAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function formatPhone(p: string): string {
  // +1-808-842-2600 → (808) 842-2600
  const m = p.match(/^\+1-(\d{3})-(\d{3})-(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text3,
    maxWidth: 720,
    lineHeight: 21,
  },

  gpsCard: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    padding: 20,
    gap: 12,
  },
  gpsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gpsLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.accent,
  },
  gpsRefreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  gpsRefreshText: { fontFamily: fonts.body, fontSize: 12, color: colors.text2 },
  gpsCoord: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  gpsMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 6 },
  gpsPlaceholder: { fontFamily: fonts.body, fontSize: 14, color: colors.text3 },
  gpsError: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  gpsCopyBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  gpsCopyText: { fontFamily: fonts.body, fontSize: 12, color: colors.accent, fontWeight: '600' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface0,
  },
  contactRowPrimary: {
    borderColor: colors.accent,
    backgroundColor: colors.surface1,
  },
  contactLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  contactLabelPrimary: { color: colors.text1 },
  contactSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    marginTop: 4,
    lineHeight: 18,
  },
  contactActionCol: { gap: 6, alignItems: 'flex-end' },
  callBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface2,
  },
  callBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  callBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  callBtnTextPrimary: { color: colors.bg },
  secondaryActionBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  secondaryActionText: { fontFamily: fonts.body, fontSize: 12, color: colors.accent, fontWeight: '600' },

  disclaimerCard: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  disclaimerTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.text3,
    marginBottom: 8,
  },
  disclaimerBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 22,
  },
});
