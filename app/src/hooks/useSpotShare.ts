/**
 * useSpotShare — wraps RN's built-in `Share.share` for the spot detail
 * share button.
 *
 * iOS uses the `url` field to drive the iMessage / Safari rich-link
 * preview (the OS fetches the URL's OG meta tags). Android's Share
 * intent has no separate URL slot, so we concatenate `message + url`
 * into a single bubble string.
 *
 * Errors fall into two buckets:
 *  - User cancelled the share sheet → not surfaced (expected).
 *  - Anything else → logged. We do NOT surface a toast here because
 *    the screen calling this hook may not have one mounted; callers
 *    can wrap if needed.
 */

import { useCallback, useState } from 'react';
import { Platform, Share } from 'react-native';
import type { Spot } from '@/types';

// Same host the spotSharePage rewrite lives on. Routing `/s/{slug}` →
// the OG-tag function happens via firebase.json on the desktop
// hosting target; kaicast.com must be attached to that target via
// Firebase console for these to resolve. Until then the same path
// works on the kaicast-207dc-5d2f2.web.app preview URL — set
// EXPO_PUBLIC_SHARE_BASE in the .env to override during testing.
const SHARE_BASE =
  process.env.EXPO_PUBLIC_SHARE_BASE || 'https://kaicast.com';

type UseSpotShareResult = {
  share: () => Promise<void>;
  isSharing: boolean;
};

export function useSpotShare(
  spot: Pick<Spot, 'id' | 'name'> | null | undefined,
  date?: string | null,
): UseSpotShareResult {
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(async () => {
    if (!spot) return;
    const slug = spot.id;
    const url = date
      ? `${SHARE_BASE}/s/${encodeURIComponent(slug)}/${encodeURIComponent(date)}`
      : `${SHARE_BASE}/s/${encodeURIComponent(slug)}`;
    const message = `Check conditions for ${spot.name} on KaiCast`;

    setIsSharing(true);
    try {
      if (Platform.OS === 'android') {
        // Android share intent has no URL slot — the link must live in
        // the body or it won't reach the recipient at all.
        await Share.share({ message: `${message}\n${url}` });
      } else {
        // iOS: `url` populates the rich-link preview; `message` is the
        // bubble text. Passing both is what makes iMessage render the
        // OG card AND show a friendly intro line.
        await Share.share({ message, url });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // RN's Share rejects on dismiss with an AbortError on some
      // platforms — treat as silent. Anything else is real.
      if (!/abort/i.test(msg)) {
        // eslint-disable-next-line no-console
        console.warn('[useSpotShare] share failed', msg);
      }
    } finally {
      setIsSharing(false);
    }
  }, [spot, date]);

  return { share, isSharing };
}
