import React from 'react';
import { create } from 'zustand';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';

interface UserProfile {
  id: string;
  email: string;
  experienceLevel?: string;
  targetRole?: string;
  timelineDays?: number;
}

interface UserStore {
  user: UserProfile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: true,
  isOnboarded: false,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnboarded: (isOnboarded) => set({ isOnboarded }),
}));

/**
 * Initializes the local user store from Clerk and ensures the backend
 * has a corresponding User row by calling /api/users/onboard once per session.
 */
export function useInitializeUser() {
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const { setUser, setLoading, setOnboarded } = useUserStore();

  React.useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setUser(null);
      setOnboarded(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await api.onboard(token);
        if (cancelled) return;
        if (res.data?.user) {
          const u = res.data.user;
          setUser({
            id: u.id,
            email: u.email,
            experienceLevel: u.profile?.experienceLevel,
            targetRole: u.profile?.targetRole,
            timelineDays: u.profile?.timelineDays,
          });
          setOnboarded(true);
        }
      } catch (err) {
        console.error('[userStore] onboard failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, clerkUser, getToken, setUser, setLoading, setOnboarded]);
}
