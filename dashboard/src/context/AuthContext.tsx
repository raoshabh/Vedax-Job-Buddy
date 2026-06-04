import { create } from 'zustand';
import * as api from '../api/client';

interface AuthState {
  user: api.User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('jt_token'),
  isAuthenticated: !!localStorage.getItem('jt_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    const data = await api.login(email, password);
    localStorage.setItem('jt_token', data.token);
    set({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    });
  },

  register: async (name: string, email: string, password: string) => {
    const data = await api.register(name, email, password);
    localStorage.setItem('jt_token', data.token);
    set({
      user: data.user,
      token: data.token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('jt_token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  loadUser: async () => {
    const { token } = get();
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('jt_token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
