export const SALOONS = Object.freeze([
  {
    id: 'dusty-spur',
    name: 'Dusty Spur',
    room: 'Frontier Table',
    description: 'A forgiving table for learning the streets.',
    minimumBankroll: 100,
    quickBets: [5, 10, 20],
    accent: 'copper',
  },
  {
    id: 'copper-canyon',
    name: 'Copper Canyon',
    room: 'Railroad Room',
    description: 'Steady action with room to build a stack.',
    minimumBankroll: 500,
    quickBets: [10, 25, 50],
    accent: 'amber',
  },
  {
    id: 'silver-creek',
    name: 'Silver Creek',
    room: 'Riverboat Hall',
    description: 'Sharper opponents and meaningful pots.',
    minimumBankroll: 1500,
    quickBets: [25, 50, 100],
    accent: 'silver',
  },
  {
    id: 'golden-mesa',
    name: 'Golden Mesa',
    room: 'High Stakes Floor',
    description: 'Premium tables for established bankrolls.',
    minimumBankroll: 5000,
    quickBets: [50, 100, 250],
    accent: 'gold',
  },
  {
    id: 'black-diamond',
    name: 'Black Diamond',
    room: 'Invitation Room',
    description: 'The final stop on the saloon map.',
    minimumBankroll: 25000,
    quickBets: [250, 500, 1000],
    accent: 'violet',
  },
]);

export function findSaloon(saloonId) {
  return SALOONS.find(saloon => saloon.id === saloonId) || SALOONS[0];
}
