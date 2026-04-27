import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../features/csg/booleanCsg', () => ({
  booleanCsg: vi.fn((inputs: { geometry: THREE.BufferGeometry }[]) =>
    inputs[0]?.geometry.clone() ?? new THREE.BufferGeometry()),
}));

import { FeatureDocument } from '../features/FeatureDocument';
import { BoxFeature } from '../features/primitives/BoxFeature';
import { SphereFeature } from '../features/primitives/SphereFeature';
import { GroupFeature } from '../features/composite/GroupFeature';
import { BooleanFeature } from '../features/composite/BooleanFeature';
import { GroupingFeatureOperations } from './GroupingFeatureOperations';

describe('GroupingFeatureOperations.merge', () => {
  it('создаёт GroupFeature и переносит участников из rootIds в неё', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.setRootIds(['b1', 's1']);

    const groupId = GroupingFeatureOperations.merge(doc, ['b1', 's1']);
    expect(groupId).not.toBeNull();
    expect(doc.rootIds).toEqual([groupId]);

    const group = doc.graph.get(groupId!);
    expect(group).toBeInstanceOf(GroupFeature);
    expect(group!.getInputs()).toEqual(['b1', 's1']);
  });

  it('возвращает null для <2 участников', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);
    expect(GroupingFeatureOperations.merge(doc, ['b1'])).toBeNull();
    expect(GroupingFeatureOperations.merge(doc, [])).toBeNull();
  });

  it('кладёт новую группу в общего parent, не плодит rootIds', () => {
    // Сценарий: типичная сцена — root scene-group содержит две примитива.
    // merge должен поместить новую группу ВНУТРЬ root, а не рядом.
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('root', {}, ['b1', 's1']));
    doc.setRootIds(['root']);

    const groupId = GroupingFeatureOperations.merge(doc, ['b1', 's1']);
    expect(groupId).not.toBeNull();
    expect(doc.rootIds).toEqual(['root']);
    expect(doc.graph.get('root')!.getInputs()).toEqual([groupId]);
    expect(doc.graph.get(groupId!)!.getInputs()).toEqual(['b1', 's1']);
  });

  it('создаёт BooleanFeature(union) если среди участников есть hole', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5, isHole: true } as never));
    doc.addFeature(new GroupFeature('root', {}, ['b1', 's1']));
    doc.setRootIds(['root']);

    const groupId = GroupingFeatureOperations.merge(doc, ['b1', 's1']);
    expect(groupId).not.toBeNull();
    const merged = doc.graph.get(groupId!);
    expect(merged).toBeInstanceOf(BooleanFeature);
    expect((merged as BooleanFeature).params.operation).toBe('union');
    expect(merged!.getInputs()).toEqual(['b1', 's1']);
  });

  it('переносит участника из inputs другой группы в новую', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('g0', {}, ['b1', 's1']));
    doc.addFeature(new BoxFeature('b2', { width: 5, height: 5, depth: 5 }));
    doc.setRootIds(['g0', 'b2']);

    const groupId = GroupingFeatureOperations.merge(doc, ['b1', 'b2']);
    expect(groupId).not.toBeNull();

    // b1 и b2 ушли из своих parent'ов / rootIds.
    expect(doc.graph.get('g0')!.getInputs()).toEqual(['s1']);
    expect(doc.rootIds).toContain(groupId!);
    expect(doc.rootIds).not.toContain('b2');

    // Новая группа содержит обоих.
    expect(doc.graph.get(groupId!)!.getInputs()).toEqual(['b1', 'b2']);
  });
});

describe('GroupingFeatureOperations.ungroup', () => {
  it('разгруппировывает GroupFeature и промоутирует детей в rootIds', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('g1', {}, ['b1', 's1']));
    doc.setRootIds(['g1']);

    const childIds = GroupingFeatureOperations.ungroup(doc, 'g1');
    expect(childIds).toEqual(['b1', 's1']);
    expect(doc.rootIds).toEqual(['b1', 's1']);
    expect(doc.graph.has('g1')).toBe(false);
  });

  it('разгруппировывает группу внутри другой группы — дети промоутируются в parent', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5 }));
    doc.addFeature(new GroupFeature('inner', {}, ['b1', 's1']));
    doc.addFeature(new BoxFeature('b2', { width: 5, height: 5, depth: 5 }));
    doc.addFeature(new GroupFeature('outer', {}, ['inner', 'b2']));
    doc.setRootIds(['outer']);

    GroupingFeatureOperations.ungroup(doc, 'inner');
    expect(doc.graph.get('outer')!.getInputs()).toEqual(['b1', 's1', 'b2']);
    expect(doc.graph.has('inner')).toBe(false);
  });

  it('возвращает null для не-composite фичи (примитив)', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.setRootIds(['b1']);
    expect(GroupingFeatureOperations.ungroup(doc, 'b1')).toBeNull();
  });

  it('разгруппировывает BooleanFeature симметрично с GroupFeature', () => {
    const doc = new FeatureDocument();
    doc.addFeature(new BoxFeature('b1', { width: 10, height: 10, depth: 10 }));
    doc.addFeature(new SphereFeature('s1', { radius: 5, isHole: true } as never));
    doc.addFeature(new BooleanFeature('bool1', { operation: 'union' }, ['b1', 's1']));
    doc.addFeature(new GroupFeature('root', {}, ['bool1']));
    doc.setRootIds(['root']);

    const childIds = GroupingFeatureOperations.ungroup(doc, 'bool1');
    expect(childIds).toEqual(['b1', 's1']);
    expect(doc.graph.has('bool1')).toBe(false);
    expect(doc.graph.get('root')!.getInputs()).toEqual(['b1', 's1']);
  });
});
