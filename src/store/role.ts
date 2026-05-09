import { create } from 'zustand';
import type { RoleId } from '../config/types';

interface RoleState {
  currentRoleId: RoleId;
  setRole: (roleId: RoleId) => void;
}

// Role state is sticky on tenant switch (does not reset to tenant.defaultRoleId).
// Initial value is 'plant-manager' to match the existing dashboard demo flow.
export const useRole = create<RoleState>((set) => ({
  currentRoleId: 'plant-manager',
  setRole: (roleId) => set({ currentRoleId: roleId }),
}));
