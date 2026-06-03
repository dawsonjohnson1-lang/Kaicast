// FareHarbor-side TypeScript types — mirror the Firestore docs
// written by functions/charter/fareharbor/*.
//
// Three doc shapes:
//   charter_accounts/{orgId}/integrations/fareharbor → FhIntegration
//   charter_accounts/{orgId}/fh_items/{fhItemPk}      → FhItem
//   /harbors/{harborId}                                → HarborDoc

/** Live-sync state for a charter's FareHarbor integration. The sync
 *  function writes lastSync / syncStatus / errorMsg / tripCount /
 *  itemCount; the client writes shortname / userApiKey / connectedAt. */
export interface FhIntegration {
  shortname: string;
  /** Sensitive — never log; UI masks it as a password field. */
  userApiKey: string;
  connectedAt: Date | null;
  lastSync: Date | null;
  syncStatus: 'ok' | 'error' | 'pending' | null;
  errorMsg: string | null;
  tripCount: number;
  itemCount: number;
}

/** Trip-type taxonomy used by the enrichment drawer. Mirrors the
 *  enrichment values written by the Settings UI. The TripType enum
 *  on `Trip` is narrower (dive/snorkel/freedive/spearfishing); this
 *  list covers more categories that map to FH products. */
export type FhTripType =
  | 'spearfishing'
  | 'freediving'
  | 'scuba'
  | 'snorkel'
  | 'fishing'
  | 'sunset'
  | 'whale_watch'
  | 'manta_ray'
  | 'other';

/** Sync mirror + charter enrichment fields. The sync uses setDoc
 *  with merge so enrichment survives every sync pass. */
export interface FhItem {
  fhItemPk: number;
  name: string;
  headline: string;
  description: string;
  maxCapacity: number;
  durationMinutes: number;
  lastSynced: Date | null;

  // ── Charter-supplied enrichment ──
  tripType: FhTripType | null;
  boatIds: string[];            // matches charter_accounts/{orgId}.fleet[].vesselId
  harborId: string | null;      // matches /harbors/{harborId}
  kaicastSpotIds: string[];     // matches public KaiCast spot ids (data/spots.ts)
  notes: string;
  enriched: boolean;            // computed at save time — all required fields set
}

/** Subset of FhItem the enrichment form mutates. */
export interface FhItemEnrichment {
  tripType: FhTripType | null;
  boatIds: string[];
  harborId: string | null;
  kaicastSpotIds: string[];
  notes: string;
}

/** One row of charter_accounts/{orgId}/fh_trips/{fhAvailabilityPk}.
 *  Written by syncFareHarborTrips every 30 minutes; cancelled by the
 *  fareharborWebhook when FH sends booking.cancelled. The enrichment
 *  fields are denormalized off the corresponding fh_items doc at
 *  sync time, so the trip surface can render without a second read. */
export interface FhTrip {
  /** Doc id — FH availability PK. */
  fhAvailabilityPk: number;
  fhItemPk: number;
  tripName: string;
  /** YYYY-MM-DD in HST. */
  date: string;
  /** HH:MM 24h, HST. */
  startTime: string;
  endTime: string;
  booked: number;
  capacity: number;
  cancelled: boolean;
  cancelledAt: Date | null;

  // ── Denormalized enrichment (may be empty if the captain hasn't
  //    set up the item yet — surface as "Setup required" in the UI). ──
  tripType: FhTripType | null;
  boatIds: string[];
  harborId: string | null;
  kaicastSpotIds: string[];

  lastSynced: Date | null;
}

/** Single harbor row from the global /harbors collection. The
 *  seedHarbors callable populates 12 Hawaii small-boat harbors. */
export interface HarborDoc {
  harborId: string;
  name: string;
  island: 'oahu' | 'maui' | 'big_island' | 'kauai' | 'molokai' | 'lanai';
  lat: number;
  lng: number;
  aka: string[];
}

export const HARBOR_ISLAND_LABEL: Record<HarborDoc['island'], string> = {
  oahu:       'Oahu',
  maui:       'Maui',
  big_island: 'Big Island',
  kauai:      'Kauai',
  molokai:    'Molokai',
  lanai:      'Lanai',
};

/** Map a harbor's island to the KaiCast public-spot `region` so the
 *  enrichment drawer can filter spots by harbor island. */
export const HARBOR_ISLAND_TO_SPOT_REGION: Record<HarborDoc['island'], string> = {
  oahu:       'Oahu',
  maui:       'Maui',
  big_island: 'Big Island',
  kauai:      'Kauai',
  molokai:    'Molokai',
  lanai:      'Lanai',
};

/** Display metadata for each FH trip type — icon + label. */
export const FH_TRIP_TYPE_META: Record<FhTripType, { icon: string; label: string }> = {
  spearfishing: { icon: '🎯', label: 'Spearfishing' },
  freediving:   { icon: '🤿', label: 'Freediving' },
  scuba:        { icon: '🐠', label: 'Scuba' },
  snorkel:      { icon: '🌊', label: 'Snorkel' },
  fishing:      { icon: '🎣', label: 'Fishing' },
  sunset:       { icon: '🌅', label: 'Sunset' },
  whale_watch:  { icon: '🐋', label: 'Whale Watch' },
  manta_ray:    { icon: '🐡', label: 'Manta Ray' },
  other:        { icon: '⚓', label: 'Other' },
};
