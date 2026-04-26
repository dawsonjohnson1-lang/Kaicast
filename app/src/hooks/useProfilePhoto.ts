import { ImageSourcePropType } from 'react-native';

/**
 * Bundled profile photo. Drop your actual photo into
 * `app/src/assets/profile.png` (overwrite the placeholder there) and the
 * Avatar/AppBar will pick it up automatically.
 *
 * TODO: when we ship a profile-photo upload flow, swap this for the
 * remote URL stored on the user record.
 */
const profile = require('@/assets/profile.png');

export function useProfilePhoto(): ImageSourcePropType {
  return profile;
}
