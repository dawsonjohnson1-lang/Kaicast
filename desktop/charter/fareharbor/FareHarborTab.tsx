// FareHarborTab — the "FareHarbor" sub-tab inside /charter/settings.
// Two sub-tabs of its own:
//   Connection — shortname + user API key, Connect / Disconnect flow.
//   Products   — list of fh_items, each card opens the Enrichment Drawer.
//
// Lives entirely under one tab so the surrounding settings shell only
// renders/unmounts a single component.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../tokens';
import type { CharterAccount } from '../types';
import {
  useFareHarborIntegration, useFareHarborItems, useHarbors,
} from './useFareHarbor';
import {
  callValidateFareHarbor, saveFareHarborConnection, disconnectFareHarbor,
} from './saveFareHarbor';
import { EnrichmentDrawer } from './EnrichmentDrawer';
import { FH_TRIP_TYPE_META, HARBOR_ISLAND_LABEL, type FhItem } from './types';

interface Props {
  orgId: string;
  account: CharterAccount;
}

type SubTab = 'Connection' | 'Products';

export function FareHarborTab({ orgId, account }: Props) {
  const [sub, setSub] = React.useState<SubTab>('Connection');
  const { integration, loading } = useFareHarborIntegration(orgId);
  const connected = !!integration && !!integration.shortname && !!integration.userApiKey;

  // If the user just connected, auto-flip to Products so they see the
  // sync result land.
  const prevConnectedRef = React.useRef(connected);
  React.useEffect(() => {
    if (!prevConnectedRef.current && connected) setSub('Products');
    prevConnectedRef.current = connected;
  }, [connected]);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>FareHarbor</Text>
          <Text style={styles.sectionSub}>
            Sync products from your FareHarbor account and enrich each one with the
            KaiCast metadata the briefing pipeline needs.
          </Text>
        </View>
        <View style={styles.connBadgeWrap}>
          {loading ? (
            <View style={styles.connBadgePending}>
              <ActivityIndicator color={colors.text3} size="small" />
              <Text style={styles.connBadgeText}>Checking…</Text>
            </View>
          ) : connected ? (
            <View style={styles.connBadgeOk}>
              <View style={styles.dotGreen} />
              <Text style={[styles.connBadgeText, { color: '#3DDC84' }]}>Connected</Text>
            </View>
          ) : (
            <View style={styles.connBadgeOff}>
              <View style={styles.dotGrey} />
              <Text style={styles.connBadgeText}>Not connected</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.subTabBar}>
        {(['Connection', 'Products'] as SubTab[]).map((t) => (
          <Pressable key={t} onPress={() => setSub(t)} style={[styles.subTabBtn, sub === t && styles.subTabBtnActive]}>
            <Text style={[styles.subTabText, sub === t && styles.subTabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {sub === 'Connection' && <ConnectionSubTab orgId={orgId} />}
      {sub === 'Products'   && <ProductsSubTab   orgId={orgId} account={account} connected={connected} />}
    </View>
  );
}

// ─── Connection sub-tab ──────────────────────────────────────────────

function ConnectionSubTab({ orgId }: { orgId: string }) {
  const { integration, loading } = useFareHarborIntegration(orgId);

  const [shortname, setShortname] = React.useState('');
  const [apiKey, setApiKey]       = React.useState('');
  const [showKey, setShowKey]     = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [saving, setSaving]       = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [err, setErr]             = React.useState<string | null>(null);
  const [okMsg, setOkMsg]         = React.useState<string | null>(null);

  // Seed inputs from the live doc — useful if the user lands here after
  // a previous session.
  React.useEffect(() => {
    if (integration) {
      setShortname(integration.shortname);
      setApiKey(integration.userApiKey);
    } else {
      setShortname('');
      setApiKey('');
    }
  }, [integration?.shortname, integration?.userApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = async () => {
    setErr(null);
    setOkMsg(null);
    const sn = shortname.trim();
    const key = apiKey.trim();
    if (!sn || !key) { setErr('Both shortname and User API key are required.'); return; }
    setValidating(true);
    try {
      const res = await callValidateFareHarbor({ shortname: sn, userApiKey: key });
      setValidating(false);
      if (!res.valid) {
        setErr(res.error || 'FareHarbor rejected those credentials. Double-check the shortname and key.');
        return;
      }
      setSaving(true);
      await saveFareHarborConnection(orgId, { shortname: sn, userApiKey: key });
      setOkMsg(`Connected as "${res.companyName}" — ${res.itemCount} product${res.itemCount === 1 ? '' : 's'} found. First sync is queued and will run within 30 minutes.`);
    } catch (e) {
      setErr((e as Error).message || 'Connection failed');
    } finally {
      setValidating(false);
      setSaving(false);
    }
  };

  const onDisconnect = async () => {
    if (typeof window !== 'undefined'
      && !window.confirm('Disconnect FareHarbor? Your fh_items and trip-mapping enrichment will remain in the database but will stop syncing.')
    ) return;
    setDisconnecting(true);
    setErr(null);
    setOkMsg(null);
    try {
      await disconnectFareHarbor(orgId);
      setShortname('');
      setApiKey('');
      setOkMsg('FareHarbor disconnected. Syncs paused.');
    } catch (e) {
      setErr((e as Error).message || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = !!integration?.shortname && !!integration?.userApiKey;
  const dirty = (integration?.shortname ?? '') !== shortname.trim()
    || (integration?.userApiKey ?? '') !== apiKey.trim();
  const busy = validating || saving || disconnecting;

  if (loading) {
    return (
      <View style={styles.cardLoading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading integration…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.subScroll} contentContainerStyle={styles.subScrollContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Credentials</Text>
        <Text style={styles.cardBody}>
          Find these in your FareHarbor dashboard under <Text style={styles.mono}>Settings → API</Text>.
          The User API key is sensitive and stored encrypted at rest in Firestore — only KaiCast Functions
          can read it.
        </Text>

        <View style={{ gap: 12, marginTop: 14 }}>
          <View>
            <Text style={styles.fieldLabel}>FareHarbor shortname *</Text>
            <TextInput
              value={shortname}
              onChangeText={setShortname}
              placeholder="e.g. bluewatercharters"
              placeholderTextColor={colors.text4}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Text style={styles.fieldHint}>The path segment in your FareHarbor URL: fareharbor.com/<Text style={styles.mono}>shortname</Text>/</Text>
          </View>

          <View>
            <Text style={styles.fieldLabel}>User API key *</Text>
            <View style={styles.keyRow}>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="fhapikey_…"
                placeholderTextColor={colors.text4}
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKey}
                editable={!busy}
              />
              <Pressable onPress={() => setShowKey((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeBtnText}>{showKey ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldHint}>Treated as a secret — never logged or surfaced to other crew members.</Text>
          </View>
        </View>

        {err ? (
          <View style={styles.errInline}>
            <Text style={styles.errInlineTitle}>Connection failed</Text>
            <Text style={styles.errInlineBody}>{err}</Text>
          </View>
        ) : null}
        {okMsg ? (
          <View style={styles.okInline}>
            <Text style={styles.okInlineTitle}>Success</Text>
            <Text style={styles.okInlineBody}>{okMsg}</Text>
          </View>
        ) : null}

        <View style={styles.connectRow}>
          {connected && !dirty ? (
            <>
              <Text style={styles.muted}>You're connected. Updating the shortname or key will re-validate before saving.</Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={onDisconnect}
                disabled={busy}
                style={[styles.dangerBtn, busy && { opacity: 0.6 }]}
              >
                <Text style={styles.dangerBtnText}>{disconnecting ? 'Disconnecting…' : 'Disconnect'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={onConnect}
                disabled={busy || !shortname.trim() || !apiKey.trim()}
                style={[
                  styles.primaryBtn,
                  (busy || !shortname.trim() || !apiKey.trim()) && styles.primaryBtnDisabled,
                ]}
              >
                <Text style={[
                  styles.primaryBtnText,
                  (busy || !shortname.trim() || !apiKey.trim()) && styles.primaryBtnTextDisabled,
                ]}>
                  {validating ? 'Validating…' : saving ? 'Saving…' : connected ? 'Reconnect' : 'Connect'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {integration ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>SYNC STATUS</Text>
          <View style={styles.statusGrid}>
            <StatRow label="Status" value={
              integration.syncStatus === 'ok'      ? 'Healthy'
              : integration.syncStatus === 'error' ? 'Error'
              : 'Queued / pending'
            } tone={
              integration.syncStatus === 'ok'      ? 'good'
              : integration.syncStatus === 'error' ? 'bad'
              : 'neutral'
            } />
            <StatRow label="Last sync" value={integration.lastSync ? integration.lastSync.toLocaleString() : 'Never'} />
            <StatRow label="Products"  value={String(integration.itemCount)} />
            <StatRow label="Trips (next 60d)" value={String(integration.tripCount)} />
            <StatRow label="Connected" value={integration.connectedAt ? integration.connectedAt.toLocaleString() : '—'} />
          </View>
          {integration.errorMsg ? (
            <View style={styles.errInline}>
              <Text style={styles.errInlineTitle}>Last sync error</Text>
              <Text style={styles.errInlineBody}>{integration.errorMsg}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>WHAT KAICAST DOES WITH THESE CREDENTIALS</Text>
        <Text style={styles.helpBody}>
          • Lists your active FareHarbor products every 30 minutes (server-side){'\n'}
          • Pulls each product's bookable availabilities through the next 60 days{'\n'}
          • Maps each availability to a KaiCast trip with condition forecasts{'\n'}
          • Cancels mirrored trips when FareHarbor sends a webhook cancellation{'\n\n'}
          KaiCast never modifies anything inside your FareHarbor account.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? '#3DDC84' : tone === 'bad' ? '#F73726' : colors.text1;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Products sub-tab ────────────────────────────────────────────────

function ProductsSubTab({ orgId, account, connected }: { orgId: string; account: CharterAccount; connected: boolean }) {
  const { items, loading, error } = useFareHarborItems(orgId);
  const { harbors } = useHarbors();
  const [editing, setEditing] = React.useState<FhItem | null>(null);

  if (!connected) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Not connected to FareHarbor yet.</Text>
        <Text style={styles.emptyBody}>
          Switch to the Connection sub-tab and enter your shortname and User API key.
          Products will appear here automatically after the first sync.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.cardLoading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Loading products…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errCard}>
        <Text style={styles.errTitle}>Could not read products</Text>
        <Text style={styles.errBody}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No products synced yet.</Text>
        <Text style={styles.emptyBody}>
          The first FareHarbor sync runs within 30 minutes of connecting. Products you create
          in FareHarbor will appear here on the next sync pass.
        </Text>
      </View>
    );
  }

  const enrichedCount = items.filter((i) => i.enriched).length;

  return (
    <ScrollView style={styles.subScroll} contentContainerStyle={styles.subScrollContent}>
      <View style={styles.summaryRow}>
        <SummaryPill label="TOTAL" value={String(items.length)} />
        <SummaryPill label="ACTIVE" value={String(enrichedCount)} tone="good" />
        <SummaryPill label="SETUP REQUIRED" value={String(items.length - enrichedCount)} tone={enrichedCount === items.length ? 'good' : 'warn'} />
      </View>

      <View style={{ gap: 10 }}>
        {items.map((item) => (
          <ProductCard
            key={item.fhItemPk}
            item={item}
            harborLabel={harbors.find((h) => h.harborId === item.harborId)?.name}
            harborIsland={harbors.find((h) => h.harborId === item.harborId)?.island}
            fleetSize={item.boatIds.length}
            spotsCount={item.kaicastSpotIds.length}
            onEdit={() => setEditing(item)}
          />
        ))}
      </View>

      {editing ? (
        <EnrichmentDrawer
          orgId={orgId}
          item={editing}
          fleet={account.fleet}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : null}
    </ScrollView>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? '#3DDC84' : tone === 'warn' ? '#F5A623' : colors.text1;
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillLabel}>{label}</Text>
      <Text style={[styles.summaryPillValue, { color }]}>{value}</Text>
    </View>
  );
}

function ProductCard({
  item, harborLabel, harborIsland, fleetSize, spotsCount, onEdit,
}: {
  item: FhItem;
  harborLabel?: string;
  harborIsland?: string;
  fleetSize: number;
  spotsCount: number;
  onEdit: () => void;
}) {
  const meta = item.tripType ? FH_TRIP_TYPE_META[item.tripType] : null;
  return (
    <Pressable onPress={onEdit} style={styles.productCard}>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {meta ? <Text style={styles.productIcon}>{meta.icon}</Text> : null}
          <Text style={styles.productName} numberOfLines={1}>{item.name || '(unnamed)'}</Text>
        </View>
        {item.headline ? <Text style={styles.productHeadline} numberOfLines={2}>{item.headline}</Text> : null}
        <View style={styles.productMetaRow}>
          {item.durationMinutes > 0 ? (
            <Text style={styles.productMeta}>
              {Math.floor(item.durationMinutes / 60)}h {item.durationMinutes % 60}m
            </Text>
          ) : null}
          {item.maxCapacity > 0 ? (
            <Text style={styles.productMeta}>{item.maxCapacity}-pax cap</Text>
          ) : null}
          {harborLabel ? (
            <Text style={styles.productMeta}>
              ⚓ {harborLabel}{harborIsland ? ` · ${HARBOR_ISLAND_LABEL[harborIsland as keyof typeof HARBOR_ISLAND_LABEL]}` : ''}
            </Text>
          ) : null}
          {fleetSize > 0 ? <Text style={styles.productMeta}>{fleetSize} boat{fleetSize === 1 ? '' : 's'}</Text> : null}
          {spotsCount > 0 ? <Text style={styles.productMeta}>{spotsCount} spot{spotsCount === 1 ? '' : 's'}</Text> : null}
          {item.lastSynced ? <Text style={styles.productMetaDim}>synced {timeAgo(item.lastSynced)}</Text> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        {item.enriched ? (
          <View style={styles.statusBadgeOk}>
            <Text style={styles.statusBadgeText}>Active</Text>
          </View>
        ) : (
          <View style={styles.statusBadgeWarn}>
            <Text style={styles.statusBadgeText}>Setup required</Text>
          </View>
        )}
        <Text style={styles.editLink}>Edit →</Text>
      </View>
    </Pressable>
  );
}

function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  sectionSub: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, lineHeight: 19 },

  connBadgeWrap: { paddingTop: 4 },
  connBadgeOk: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(61,220,132,0.10)', borderWidth: 1, borderColor: '#3DDC84' },
  connBadgeOff: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  connBadgePending: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  connBadgeText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700', color: colors.text3, letterSpacing: 1 },
  dotGreen: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#3DDC84' },
  dotGrey: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.text4 },

  subTabBar: { flexDirection: 'row', padding: 3, gap: 2, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.sm, alignSelf: 'flex-start' },
  subTabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm - 2 },
  subTabBtnActive: { backgroundColor: colors.surface2 },
  subTabText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text3 },
  subTabTextActive: { color: colors.text1 },

  subScroll: { maxHeight: 600 },
  subScrollContent: { gap: 14, paddingBottom: 8 },

  card: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong },
  cardTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text1 },
  cardBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, marginTop: 6, lineHeight: 18 },
  cardLoading: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },

  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  fieldHint: { fontFamily: fonts.body, fontSize: 11, color: colors.text4, marginTop: 6 },
  input: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, fontFamily: fonts.body, fontSize: 13, color: colors.text1 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  eyeBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },

  connectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },

  primaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  primaryBtnDisabled: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  primaryBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  primaryBtnTextDisabled: { color: colors.text4 },
  dangerBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: '#F73726', backgroundColor: 'rgba(247,55,38,0.08)' },
  dangerBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },

  errInline: { padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726', marginTop: 12 },
  errInlineTitle: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: '#F73726' },
  errInlineBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  okInline: { padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(61,220,132,0.10)', borderWidth: 1, borderColor: '#3DDC84', marginTop: 12 },
  okInlineTitle: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: '#3DDC84' },
  okInlineBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },

  statusCard: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong },
  statusTitle: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  statusGrid: { gap: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, fontWeight: '600' },
  statValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.text1 },

  helpCard: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  helpTitle: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  helpBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 18 },

  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryPill: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  summaryPillLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.text4, fontWeight: '700', letterSpacing: 1.2 },
  summaryPillValue: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1, marginTop: 4 },

  productCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong },
  productIcon: { fontSize: 16 },
  productName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text1, flex: 1 },
  productHeadline: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },
  productMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  productMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text2 },
  productMetaDim: { fontFamily: fonts.mono, fontSize: 10, color: colors.text4 },
  statusBadgeOk: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(61,220,132,0.14)', borderWidth: 1, borderColor: '#3DDC84' },
  statusBadgeWarn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(245,166,35,0.14)', borderWidth: 1, borderColor: '#F5A623' },
  statusBadgeText: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.text1 },
  editLink: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: colors.accent },

  errCard: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  emptyCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline, gap: 10 },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontStyle: 'italic' },
  mono: { fontFamily: fonts.mono, color: colors.accent, fontSize: 11 },
});
