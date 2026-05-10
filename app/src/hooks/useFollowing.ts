// Live subscription to a user's follower / following lists.
//
// Subscribes to both subcollections via Firestore onSnapshot when
// configured; in stub mode returns empty lists (the social graph is
// Firebase-only). Returns the materialized lists, counts, an
// `isFollowing(uid)` helper, and `follow`/`unfollow` actions that
// route through the api layer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import {
  followUser,
  unfollowUser,
  type FollowEdge,
  type FollowProfile,
} from '@/api/follows';

type State = {
  following: FollowEdge[];
  followers: FollowEdge[];
  loading: boolean;
};

const EMPTY_STATE: State = { following: [], followers: [], loading: false };

export function useFollowing(uid: string | undefined) {
  const [state, setState] = useState<State>(() => ({
    following: [],
    followers: [],
    loading: !!uid,
  }));

  useEffect(() => {
    if (!uid || !firebaseConfigured || !db) {
      setState(EMPTY_STATE);
      return;
    }
    let followingLoaded = false;
    let followersLoaded = false;
    const markLoaded = () => {
      if (followingLoaded && followersLoaded) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    // Order by addedAt desc so most-recent follows surface first in the list.
    const followingQ = query(
      collection(db, 'users', uid, 'following'),
      orderBy('addedAt', 'desc'),
    );
    const followersQ = query(
      collection(db, 'users', uid, 'followers'),
      orderBy('addedAt', 'desc'),
    );

    const unsubFollowing = onSnapshot(
      followingQ,
      (snap) => {
        const list: FollowEdge[] = snap.docs.map((d) => normalizeEdge(d.data() as Record<string, unknown>));
        followingLoaded = true;
        setState((prev) => ({ ...prev, following: list }));
        markLoaded();
      },
      () => { followingLoaded = true; markLoaded(); },
    );
    const unsubFollowers = onSnapshot(
      followersQ,
      (snap) => {
        const list: FollowEdge[] = snap.docs.map((d) => normalizeEdge(d.data() as Record<string, unknown>));
        followersLoaded = true;
        setState((prev) => ({ ...prev, followers: list }));
        markLoaded();
      },
      () => { followersLoaded = true; markLoaded(); },
    );

    return () => {
      unsubFollowing();
      unsubFollowers();
    };
  }, [uid]);

  const followingIds = useMemo(
    () => new Set(state.following.map((e) => e.uid)),
    [state.following],
  );

  const isFollowing = useCallback(
    (otherUid: string) => followingIds.has(otherUid),
    [followingIds],
  );

  const follow = useCallback(
    async (me: FollowProfile, other: FollowProfile) => {
      await followUser(me, other);
    },
    [],
  );

  const unfollow = useCallback(
    async (myUid: string, otherUid: string) => {
      await unfollowUser(myUid, otherUid);
    },
    [],
  );

  return {
    following: state.following,
    followers: state.followers,
    loading:   state.loading,
    counts: {
      following: state.following.length,
      followers: state.followers.length,
    },
    isFollowing,
    follow,
    unfollow,
  };
}

function normalizeEdge(data: Record<string, unknown>): FollowEdge {
  const ts = data.addedAt as { toMillis?: () => number } | number | undefined;
  const addedAt =
    typeof ts === 'number'
      ? ts
      : ts && typeof ts.toMillis === 'function'
        ? ts.toMillis()
        : undefined;
  return {
    uid:      String(data.uid ?? ''),
    name:     String(data.name ?? ''),
    handle:   String(data.handle ?? ''),
    photoUrl: (data.photoUrl as string | null | undefined) ?? null,
    homeSpot: (data.homeSpot as string | null | undefined) ?? null,
    addedAt,
  };
}
