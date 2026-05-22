/**
 * useUserLocation — best-effort browser geolocation hook.
 *
 * Returns the visitor's approximate { lat, lon } once the browser
 * grants permission. Falls back to Honolulu (a sensible Hawaii-default
 * center) when permission is denied, the browser doesn't support
 * geolocation, or the request errors. The fallback flag lets callers
 * distinguish "real location" from "default" — handy for UI like
 * "X miles away (approx)".
 *
 * Permission is requested once per session on mount; we don't poll.
 * Result is memoized in module scope so multiple consumers share one
 * geolocation prompt rather than each firing their own.
 */

import { useEffect, useState } from 'react';

export interface UserLocation {
  lat: number;
  lon: number;
  /** True when this is the fallback (geolocation unavailable / denied). */
  isFallback: boolean;
}

// Honolulu — central enough to make distance ranking still useful when
// we can't get a real position.
const FALLBACK: UserLocation = { lat: 21.3099, lon: -157.8581, isFallback: true };

let cached: UserLocation | null = null;
const subscribers = new Set<(loc: UserLocation) => void>();

function publish(loc: UserLocation) {
  cached = loc;
  subscribers.forEach((fn) => fn(loc));
}

let requestInFlight = false;
function requestLocation() {
  if (cached || requestInFlight) return;
  if (typeof window === 'undefined' || !window.navigator?.geolocation) {
    publish(FALLBACK);
    return;
  }
  requestInFlight = true;
  window.navigator.geolocation.getCurrentPosition(
    (pos) => {
      requestInFlight = false;
      publish({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        isFallback: false,
      });
    },
    () => {
      requestInFlight = false;
      publish(FALLBACK);
    },
    { timeout: 8000, maximumAge: 5 * 60 * 1000 },
  );
}

export function useUserLocation(): UserLocation {
  const [loc, setLoc] = useState<UserLocation>(() => cached ?? FALLBACK);

  useEffect(() => {
    const sub = (next: UserLocation) => setLoc(next);
    subscribers.add(sub);
    requestLocation();
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  return loc;
}

/** Haversine great-circle distance in miles between two lat/lon points. */
export function distanceMiles(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
