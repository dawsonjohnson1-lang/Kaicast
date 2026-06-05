// SubmitLogScreen — final review + submit.
//
// Shows the day's summary stats, the trip list (read-only), and two
// CTAs:
//   • Generate PDF — calls generateCaptainsLog and opens the result.
//   • Submit Log   — flips status → submitted, fires the email digest
//                    via the same callable, and routes back home.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Tag } from '@/components/Tag';
import { SectionTitle } from '@/components/SectionTitle';
import { CharterUpsell } from '@/components/charter/CharterUpsell';
import { colors, radius, spacing, typography } from '@/theme';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFareHarbor } from '@/hooks/useFareHarbor';
import { useCharterLog } from '@/hooks/useCharterLog';
import { TRIP_TYPE_LABEL, type CharterLogCrew } from '@/types/charterLog';

import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SubmitLogScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);
  const isCharter = profile?.accountType === 'charter';
  const orgId = profile?.orgId;
  const dateMs = useMemo(() => Date.now(), []);

  const { trips: fhTrips, loading: fhLoading } = useFareHarbor(orgId, dateMs);
  const seed = useMemo(() => {
    if (!isCharter || !orgId || fhLoading) return null;
    return {
      operatorId: orgId,
      vesselId: orgId,
      vesselName: profile?.handle ?? 'Vessel',
      captainName: profile?.name ?? '',
      captainLicense: '',
      harborDeparture: '',
      dailyAlerts: '',
      trips: fhTrips,
      crew: [] as CharterLogCrew[],
    };
  }, [isCharter, orgId, fhLoading, fhTrips, profile?.handle, profile?.name]);

  const { log, submit } = useCharterLog(dateMs, seed);
  const [submitting, setSubmitting] = useState(false);

  if (profileLoading) {
    return <Screen contentStyle={{ paddingTop: 0 }}><View /></Screen>;
  }
  if (!isCharter) {
    return (
      <CharterUpsell
        title="Submit Log"
        body="The Captain's Log is part of KaiCast Charter."
        onBack={() => nav.goBack()}
      />
    );
  }

  const handleSubmit = async () => {
    if (!log) return;
    setSubmitting(true);
    try {
      const { pdfUrl } = await submit();
      if (pdfUrl) {
        Alert.alert('Log submitted', 'The PDF was generated and sent to the operator.', [
          { text: 'Open PDF', onPress: () => Linking.openURL(pdfUrl) },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Log submitted', 'The PDF will be emailed when the renderer is back online.');
      }
      nav.popToTop();
    } catch (err) {
      Alert.alert('Submit failed', err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitted = log?.status === 'submitted' || log?.status === 'archived';

  return (
    <Screen contentStyle={{ paddingTop: 0 }} scroll={false}>
      <Header title="Submit log" onBack={() => nav.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.idRow}>
          <Text style={styles.idText}>{log?.logId ?? ''}</Text>
          {submitted ? <Tag variant="excellent" label="SUBMITTED" /> : <Tag variant="warn" label="DRAFT" />}
        </View>

        <SectionTitle title="Today" />
        <Card style={{ gap: spacing.sm, marginBottom: spacing.xl }} bordered>
          <SummaryRow label="Vessel"  value={log?.vesselName ?? '—'} />
          <SummaryRow label="Captain" value={log?.captainName ?? '—'} />
          <SummaryRow label="License" value={log?.captainLicense || '—'} />
          <SummaryRow label="Harbor"  value={log?.harborDeparture || '—'} />
          <SummaryRow
            label="Date"
            value={new Date(dateMs).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          />
        </Card>

        <SectionTitle title="Totals" />
        <Card style={{ marginBottom: spacing.xl }} bordered>
          <View style={styles.totalsRow}>
            <Total label="Trips" value={String(log?.totalTrips ?? 0)} />
            <Total label="Guests" value={String(log?.totalGuests ?? 0)} />
            <Total label="Incidents" value={String(log?.incidents ?? 0)} />
          </View>
        </Card>

        <SectionTitle title="Trip recap" />
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          {(log?.trips ?? []).map((t) => (
            <Card key={t.tripId} style={styles.recapCard} bordered>
              <View style={styles.recapHeader}>
                <Text style={styles.recapTitle}>
                  {t.tripNum}. {t.title}
                </Text>
                <Tag
                  variant={t.complete ? 'excellent' : 'neutral'}
                  label={t.complete ? 'COMPLETE' : 'DRAFT'}
                />
              </View>
              <Text style={styles.recapSub}>
                {TRIP_TYPE_LABEL[t.type]} · {t.departureTime || '—:—'} ·{' '}
                {t.passengerCount} {t.passengerCount === 1 ? 'guest' : 'guests'}
              </Text>
              {t.incident && t.incident !== 'None' ? (
                <Text style={styles.recapIncident}>Incident: {t.incident}</Text>
              ) : null}
            </Card>
          ))}
        </View>

        <Button
          label={submitted ? 'Log already submitted' : 'Submit Daily Log'}
          fullWidth
          loading={submitting}
          disabled={submitted}
          onPress={handleSubmit}
        />
      </ScrollView>
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value}</Text>
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalCell}>
      <Text style={styles.totalValue}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  idText: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  sumLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.6,
    fontSize: 10,
  },
  sumValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  totalsRow: { flexDirection: 'row', paddingVertical: spacing.sm },
  totalCell: { flex: 1, alignItems: 'center', gap: 2 },
  totalValue: {
    ...typography.h1,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  totalLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  recapCard: { gap: 4 },
  recapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recapTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  recapSub: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  recapIncident: {
    ...typography.bodySm,
    color: colors.hazard,
    fontWeight: '600',
  },
});
