import type { ModelTreeJSON, NodeParams } from '../types';

/**
 * Один раз мигрирует legacy Y-up сохранёнку в Z-up: рекурсивно меняет
 * местами координаты Y↔Z в position и rotation у каждой ноды. Помечает
 * корневой объект `coordsConvention: 'zup'`, чтобы повторная загрузка не
 * мигрировала ещё раз. Мутирует JSON in-place.
 *
 * Извлечено из Serializer.ts, чтобы могло использоваться loader-ом без
 * импорта nodes/* (которые тянут three-bvh-csg).
 */
export function migrateLegacyYupToZupIfNeeded(rootJson: ModelTreeJSON): void {
  const root = rootJson as ModelTreeJSON & { coordsConvention?: string };
  if (root.coordsConvention === 'zup') return;

  const swapYZ = (v?: { x: number; y: number; z: number }): void => {
    if (!v) return;
    const tmp = v.y;
    v.y = v.z;
    v.z = tmp;
  };

  const visit = (node: ModelTreeJSON): void => {
    const np = (node as { nodeParams?: NodeParams }).nodeParams;
    if (np) {
      swapYZ(np.position);
      swapYZ(np.rotation as { x: number; y: number; z: number } | undefined);
    }
    if ((node as { kind: string }).kind === 'group') {
      const children = (node as { children?: ModelTreeJSON[] }).children;
      if (children) for (const c of children) visit(c);
    }
  };

  visit(rootJson);
  root.coordsConvention = 'zup';
}
