import { create } from 'zustand';

interface TenantUiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useTenantUi = create<TenantUiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
