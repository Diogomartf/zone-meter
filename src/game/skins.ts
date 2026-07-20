import type { SkinId } from '@/game/types';

export type SkinDef = {
  id: SkinId;
  name: string;
  cost: number;
  liquid: readonly [string, string, string, string, string];
  shell: string;
  shellDark: string;
};

export const SKINS: Record<SkinId, SkinDef> = {
  toxic: {
    id: 'toxic',
    name: 'Toxic',
    cost: 0,
    // Top → bottom: hot yellow surface → lime → cyan base (matches art)
    liquid: ['#FFE94A', '#B8FF2A', '#2DFF6A', '#00E0D0', '#00A8FF'],
    shell: '#73BF2E',
    shellDark: '#4E9A16',
  },
  lava: {
    id: 'lava',
    name: 'Lava',
    cost: 120,
    liquid: ['#FFE8C8', '#FFB020', '#FF5A1F', '#E11D48', '#7F1D1D'],
    shell: '#F97316',
    shellDark: '#C2410C',
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    cost: 200,
    liquid: ['#F0F9FF', '#BAE6FD', '#38BDF8', '#2563EB', '#1E3A8A'],
    shell: '#38BDF8',
    shellDark: '#0284C7',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    cost: 400,
    liquid: ['#FFFBEB', '#FDE68A', '#FBBF24', '#D97706', '#92400E'],
    shell: '#EAB308',
    shellDark: '#A16207',
  },
};

export const DEFAULT_SKIN: SkinId = 'toxic';
