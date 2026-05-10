import { create } from 'zustand';
import type { RoleId } from '../config/types';

interface RoleState {
  currentRoleId: RoleId;
  setRole: (roleId: RoleId) => void;
}

// Role state is sticky on tenant switch (does not reset to tenant.defaultRoleId).
// Initial value is 'site-operator' so the demo arc opens on the floor view —
// the persona closest to "what is happening RIGHT NOW".
export const useRole = create<RoleState>((set) => ({
  currentRoleId: 'site-operator',
  setRole: (roleId) => set({ currentRoleId: roleId }),
}));
