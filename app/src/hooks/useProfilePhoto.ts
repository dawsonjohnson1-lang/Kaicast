import { ImageSourcePropType } from 'react-native';

/**
 * Single source of truth for the signed-in user's profile photo. All
 * screens render this so the avatar reads identically everywhere.
 *
 * TODO: when we ship a profile-photo upload flow, swap this for the
 * remote URL stored on the user record.
 */
const profile = require('../../assets/dawson.png');

export function useProfilePhoto(): ImageSourcePropType {
  return profile;
}
