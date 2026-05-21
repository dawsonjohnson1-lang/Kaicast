import kaicast from './kaicast.png';

export const logos = {
  kaicast,
} as const;

export type LogoKey = keyof typeof logos;
