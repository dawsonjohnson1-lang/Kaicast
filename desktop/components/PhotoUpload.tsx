/**
 * PhotoUpload — click-to-browse + drag-and-drop image uploader for the
 * LogDive screen.
 *
 * Replaces the static "Drop photos here" View that did nothing. Files
 * are uploaded directly from the browser to Firebase Storage at
 *   users/{uid}/dives/{logId}/{filename}
 * where logId is a per-form-session id created when the user starts
 * adding photos. We do NOT wait for the dive log to be saved before
 * uploading — the user can pick photos at any step and they stream up
 * in parallel. The resulting full-size storage paths are reported via
 * `onPathsChange` so the parent form can include them in submitDiveLog's
 * `photos: string[]` payload.
 *
 * On abandoned drafts the photos linger under that draft logId path
 * until a future cleanup job sweeps drafts with no matching diveLogs
 * doc — same pattern the schema doc describes for orphaned reports.
 *
 * Auth + storage gated: when the user isn't signed in or Firebase
 * isn't configured (preview mode), the dropzone renders disabled with
 * a "Sign in to upload photos" hint instead of silently failing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { colors, fonts } from '../tokens';

type UploadStatus = 'uploading' | 'done' | 'error';

interface UploadItem {
  /** Stable client-side id for keying + remove. */
  id: string;
  name: string;
  sizeBytes: number;
  /** 0..1, only meaningful while uploading. */
  progress: number;
  status: UploadStatus;
  /** Storage path once uploaded — this is what we report up. */
  storagePath: string | null;
  /** Public download URL — used for the thumbnail preview. */
  downloadUrl: string | null;
  /** Original File object kept around so we can render a blob: preview
   *  while the network upload is still in flight. */
  previewUrl: string;
  errorMsg?: string;
}

interface Props {
  /** Called with the current list of successful storage paths whenever
   *  the upload set changes. Parent owns this in form state. */
  onPathsChange: (paths: string[]) => void;
  /** Initial set of paths to render as already-uploaded (e.g. when the
   *  user navigates back to step 6 after picking more). */
  initialPaths?: string[];
  /** Max files in the picker dialog AND total per dive. Defaults to 10. */
  maxFiles?: number;
  /** Max bytes per file. Defaults to 10 MB to match the helper text. */
  maxFileBytes?: number;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function newSessionId(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(name: string): string {
  // Strip path separators and shell-ugly chars; keep the extension. The
  // server-side rule caps at 200 chars so we trim aggressively here too.
  const cleaned = name.replace(/[^\w.\-]+/g, '_').slice(0, 180);
  return cleaned || `photo-${Date.now()}`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoUpload({
  onPathsChange,
  initialPaths,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileBytes = DEFAULT_MAX_BYTES,
}: Props) {
  const auth = useAuth();
  const uid = auth.user?.uid ?? null;
  const enabled = !!uid && !!storage;

  // Per-form-session draft id. Created lazily on first upload so we
  // don't allocate a path for users who never pick a file.
  const sessionIdRef = React.useRef<string | null>(null);
  const sessionId = () => {
    if (!sessionIdRef.current) sessionIdRef.current = newSessionId();
    return sessionIdRef.current;
  };

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [rejected, setRejected] = React.useState<string | null>(null);

  // Seed already-uploaded paths once on mount as `done` items without
  // previews (we don't re-resolve download URLs to keep mount cheap).
  React.useEffect(() => {
    if (!initialPaths || initialPaths.length === 0) return;
    setItems((prev) => {
      if (prev.length > 0) return prev;
      return initialPaths.map((p) => ({
        id: p,
        name: p.split('/').pop() || p,
        sizeBytes: 0,
        progress: 1,
        status: 'done' as const,
        storagePath: p,
        downloadUrl: null,
        previewUrl: '',
      }));
    });
    // We only want to seed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the latest callback in a ref so its (usually inline) identity
  // isn't a dependency of the report effect below. Depending on it
  // caused an infinite setState loop: the parent passes
  // `onPathsChange={(p) => update('photos', p)}` (new identity every
  // render), the effect fired `update('photos', [])`, that re-rendered
  // the parent, which handed us a fresh callback, which re-ran the
  // effect, forever.
  const onPathsChangeRef = React.useRef(onPathsChange);
  React.useEffect(() => {
    onPathsChangeRef.current = onPathsChange;
  });

  // Report path changes upward only when the resolved set actually
  // changes — keyed on the joined paths so an unrelated `items` update
  // (upload progress ticks) doesn't spam the parent. Depends on `items`
  // alone, never the callback identity.
  const lastReportedRef = React.useRef<string>('');
  React.useEffect(() => {
    const paths = items
      .filter((i) => i.status === 'done' && i.storagePath)
      .map((i) => i.storagePath!) as string[];
    const key = paths.join('\n');
    if (key === lastReportedRef.current) return;
    lastReportedRef.current = key;
    onPathsChangeRef.current(paths);
  }, [items]);

  const startUpload = React.useCallback(
    (files: File[]) => {
      if (!enabled || !uid || !storage) return;
      if (files.length === 0) return;

      // Slot-based filtering — respect maxFiles across both already-
      // uploaded items and the new batch.
      const remainingSlots = Math.max(0, maxFiles - items.length);
      const accepted: File[] = [];
      let rejection: string | null = null;
      for (const f of files) {
        if (accepted.length >= remainingSlots) {
          rejection = `Limit ${maxFiles} photos per dive`;
          break;
        }
        if (!f.type.startsWith('image/')) {
          rejection = `${f.name} isn't an image file`;
          continue;
        }
        if (f.size > maxFileBytes) {
          rejection = `${f.name} is larger than ${formatBytes(maxFileBytes)}`;
          continue;
        }
        accepted.push(f);
      }
      setRejected(rejection);

      const sid = sessionId();
      const newItems: UploadItem[] = accepted.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        sizeBytes: f.size,
        progress: 0,
        status: 'uploading' as const,
        storagePath: null,
        downloadUrl: null,
        previewUrl: URL.createObjectURL(f),
      }));
      setItems((prev) => [...prev, ...newItems]);

      accepted.forEach((file, idx) => {
        const item = newItems[idx];
        const path = `users/${uid}/dives/${sid}/${Date.now()}-${sanitizeName(file.name)}`;
        const r = ref(storage!, path);
        const task = uploadBytesResumable(r, file, { contentType: file.type });
        task.on(
          'state_changed',
          (snap) => {
            const p = snap.totalBytes > 0 ? snap.bytesTransferred / snap.totalBytes : 0;
            setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, progress: p } : x)));
          },
          (err) => {
            setItems((prev) =>
              prev.map((x) =>
                x.id === item.id ? { ...x, status: 'error', errorMsg: err.message } : x,
              ),
            );
          },
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              setItems((prev) =>
                prev.map((x) =>
                  x.id === item.id
                    ? { ...x, status: 'done', progress: 1, storagePath: path, downloadUrl: url }
                    : x,
                ),
              );
            } catch (err) {
              setItems((prev) =>
                prev.map((x) =>
                  x.id === item.id
                    ? { ...x, status: 'error', errorMsg: (err as Error).message }
                    : x,
                ),
              );
            }
          },
        );
      });
    },
    [enabled, uid, items.length, maxFiles, maxFileBytes],
  );

  const handleRemove = React.useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.storagePath && storage) {
        // Fire-and-forget delete; if it fails the file just lingers
        // under the draft path until the orphan-sweep job runs.
        deleteObject(ref(storage, target.storagePath)).catch(() => {});
      }
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const openPicker = () => inputRef.current?.click();

  const dropProps = enabled
    ? {
        onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
        onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
        onDragLeave: (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
          startUpload(files);
        },
      }
    : {};

  return (
    <View>
      <Pressable
        style={[
          styles.dropzone,
          dragOver && styles.dropzoneActive,
          !enabled && styles.dropzoneDisabled,
        ]}
        onPress={enabled ? openPicker : undefined}
        // RN Web View renders as a <div> so HTML drag events are valid.
        // Typings don't expose them; cast to any.
        {...(dropProps as any)}
      >
        <Text style={styles.icon}>{dragOver ? '⤵' : '⬆'}</Text>
        <Text style={styles.title}>
          {enabled ? (dragOver ? 'Drop to upload' : 'Drop photos here') : 'Sign in to upload photos'}
        </Text>
        <Text style={styles.sub}>
          {enabled
            ? `or click to browse · JPG / PNG / HEIC · up to ${formatBytes(maxFileBytes)} each · max ${maxFiles}`
            : "We'll attach them to this dive log on publish."}
        </Text>
        {/* Hidden file input — under RN Web the Pressable is a real DOM
            element so we can nest a raw <input>. The picker is opened
            via inputRef.click() in openPicker(). */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            startUpload(files);
            // Reset value so picking the same file twice still fires onChange.
            e.target.value = '';
          }}
        />
      </Pressable>

      {rejected ? <Text style={styles.rejected}>{rejected}</Text> : null}

      {items.length > 0 ? (
        <View style={styles.thumbStrip}>
          {items.map((item) => (
            <View key={item.id} style={styles.thumb}>
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <View style={styles.thumbFallback}><Text style={styles.thumbFallbackText}>📷</Text></View>
              )}
              {item.status === 'uploading' ? (
                <View style={styles.progressOverlay}>
                  <View style={[styles.progressBar, { width: `${Math.round(item.progress * 100)}%` }]} />
                </View>
              ) : null}
              {item.status === 'error' ? (
                <View style={styles.errorOverlay}>
                  <Text style={styles.errorText}>!</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => handleRemove(item.id)}
                style={styles.removeBtn}
                hitSlop={6}
                accessibilityLabel={`Remove ${item.name}`}
              >
                <Text style={styles.removeBtnText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    minHeight: 120,
    padding: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.hairline,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dropzoneActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  dropzoneDisabled: {
    opacity: 0.6,
  },
  icon: {
    fontSize: 22,
    color: colors.text2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
    textAlign: 'center',
  },
  rejected: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.fair,
  },
  thumbStrip: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.hairline,
    position: 'relative',
  },
  thumbFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  thumbFallbackText: {
    fontSize: 22, color: colors.text2,
  },
  progressOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 3, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.accent,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,89,89,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  errorText: {
    fontFamily: fonts.display, fontWeight: '700', fontSize: 22, color: '#fff',
  },
  removeBtn: {
    position: 'absolute', top: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: {
    color: '#fff', fontSize: 14, lineHeight: 14, fontWeight: '600',
  },
});

export default PhotoUpload;
