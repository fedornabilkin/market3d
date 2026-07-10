import type { PrimitiveType } from '@/v3d/constructor';

export type ConstructorShapeButton = {
  type: PrimitiveType;
  title: string;
  icon: string;
};

export const CONSTRUCTOR_SHAPE_BUTTONS: readonly ConstructorShapeButton[] = [
  { type: 'box', title: 'Куб', icon: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm9-2L5.5 8 12 11l6.5-3L12 5zM4 8.5v8l7 3.1v-8L4 8.5zm16 0l-7 3.1v8l7-3.1v-8z' },
  { type: 'cylinder', title: 'Цилиндр', icon: 'M12 2C7.58 2 4 3.79 4 6v12c0 2.21 3.58 4 8 4s8-1.79 8-4V6c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.46 6 2s-2.13 2-6 2-6-1.46-6-2 2.13-2 6-2zM6 8.71C7.6 9.53 9.72 10 12 10s4.4-.47 6-1.29V18c0 .54-2.13 2-6 2s-6-1.46-6-2V8.71z' },
  { type: 'sphere', title: 'Сфера', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-14.5c-3.17.82-5.5 3.69-5.5 7.1h2c0-2.47 1.37-4.63 3.5-5.72v-1.38zm2 0v1.38c2.13 1.09 3.5 3.25 3.5 5.72h2c0-3.41-2.33-6.28-5.5-7.1z' },
  { type: 'cone', title: 'Конус', icon: 'M12 2L3 20h18L12 2zm0 4.5L17.5 18h-11L12 6.5z' },
  { type: 'torus', title: 'Тор', icon: 'M12 4C7.03 4 3 7.13 3 11s4.03 7 9 7 9-3.13 9-7-4.03-7-9-7zm0 2c3.87 0 7 2.24 7 5s-3.13 5-7 5-7-2.24-7-5 3.13-5 7-5zm0 2c-2.76 0-5 1.34-5 3s2.24 3 5 3 5-1.34 5-3-2.24-3-5-3z' },
];
