import type { FeatureDocument } from '@/v3d/constructor/features/FeatureDocument';
import type { FeatureId } from '@/v3d/constructor/features/types';
import { ThreadFeature } from '@/v3d/constructor/features/primitives/ThreadFeature';
import { KnurlFeature } from '@/v3d/constructor/features/primitives/KnurlFeature';
import { nextP2FeatureId } from '@/v3d/constructor/features/utils/dagMutations';
import type { GeneratorSettings } from '@/v3d/constructor/generators/GeneratorMode';

/** Creates procedural features and attaches them to the scene document. */
export class GeneratedFeatureService {
  createAndAttach(
    document: FeatureDocument,
    settings: GeneratorSettings,
    name: string,
  ): FeatureId | null {
    if (document.rootIds.length !== 1) return null;
    const root = document.graph.get(document.rootIds[0]);
    if (!root) return null;

    const id = nextP2FeatureId(settings.type);
    const feature = settings.type === 'thread'
      ? new ThreadFeature(id, { ...settings.thread })
      : new KnurlFeature(id, { ...settings.knurl });
    feature.name = name;
    document.addFeature(feature);

    if (root.type === 'group' || root.type === 'boolean') {
      document.updateInputs(root.id, [...root.getInputs(), id]);
    } else {
      document.setRootIds([...document.rootIds, id]);
    }
    return id;
  }
}
