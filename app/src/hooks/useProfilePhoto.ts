import { ImageSourcePropType } from 'react-native';

/**
 * Static fallback profile photo. The real per-user photo comes from
 * `users/{uid}.photoUrl` via the useUserProfile hook — see how AppBar
 * composes the chain: `profile?.photoUrl ?? user?.photoUrl ?? this`.
 *
 * This hook only returns the bundled placeholder, so the avatar
 * always has *something* to render even when the user is signed out
 * or hasn't uploaded a photo yet. Don't read this directly on a
 * screen that knows the user's uid — go through useUserProfile so
 * edits show up live.
 */
const profile = require('../../assets/dawson.png');

export function useProfilePhoto(): ImageSourcePropType {
  return profile;
}
