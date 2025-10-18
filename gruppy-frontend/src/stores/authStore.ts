import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define the shape of the store's state
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearTokens: () => void;
}

// Create the store
export const useAuthStore = create<AuthState>()(
  // Use the 'persist' middleware to save the state to localStorage
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      // Action to set tokens and update authentication status
      setTokens: (tokens) => set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isAuthenticated: true,
      }),
      // Action to clear tokens and log the user out
      clearTokens: () => set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      }),
    }),
    {
      name: 'gruppy-auth-storage', // Name for the localStorage item
    }
  )
);