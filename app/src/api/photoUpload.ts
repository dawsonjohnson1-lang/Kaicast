// Photo picker + uploader. Wraps expo-image-picker for the picker UI
// and Firebase Storage for persistence. When Firebase isn't
// configured, returns the picked file:// URI so the UI can preview
// the local image during demo mode (the URI won't survive an app
// reinstall).
//
// Use:
//   const result = await pickAndUploadPhoto({ uid, kind: 'profile' });
//   if (result) setProfilePhoto(result.publicUrl);

import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { storage, firebaseConfigured } from '@/firebase';

export type PhotoUploadKind = 'profile' | 'diveLog';

export type PhotoUploadResult = {
  /** A URL or file:// URI you can put in `<Image source={{ uri }} />`. */
  publicUrl: string;
  /** Storage path relative to the bucket. Use to delete later. */
  storagePath: string | null;
};

/**
 * Open the image picker, then upload the selected asset to Firebase
 * Storage at `users/{uid}/{kind}/{timestamp}.jpg`. Returns null if
 * the user cancels the picker.
 *
 * - Enforces a 1 MB max file-size cap (per spec) by inspecting the
 *   asset's `fileSize` after the picker returns.
 * - Asks for media-library permission first; surfaces the rejection
 *   to the caller so the screen can show a friendly message.
 */
export async function pickAndUploadPhoto(opts: {
  uid: string;
  kind: PhotoUploadKind;
}): Promise<PhotoUploadResult | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library access was denied.');
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: opts.kind === 'profile' ? [1, 1] : [4, 3],
    quality: 0.8,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];

  // 1 MB cap. The picker returns size in bytes when available.
  const ONE_MB = 1024 * 1024;
  if (asset.fileSize && asset.fileSize > ONE_MB) {
    throw new Error(`Photo is too large (${(asset.fileSize / ONE_MB).toFixed(1)} MB). Max 1 MB.`);
  }

  // Stub mode: just return the local file:// URI. The UI will preview
  // it; nothing else gets stored.
  if (!firebaseConfigured || !storage) {
    return { publicUrl: asset.uri, storagePath: null };
  }

  // Upload to Firebase Storage.
  const ext = asset.uri.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
  const storagePath = `users/${opts.uid}/${opts.kind}/${Date.now()}.${ext}`;
  const fileRef = ref(storage, storagePath);

  // React Native fetch returns a Blob; upload that.
  const blob = await (await fetch(asset.uri)).blob();
  await uploadBytes(fileRef, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
  const publicUrl = await getDownloadURL(fileRef);

  return { publicUrl, storagePath };
}
