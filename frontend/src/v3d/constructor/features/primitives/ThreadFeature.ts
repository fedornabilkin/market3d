import { LeafFeature } from '../LeafFeature';
import type { FeatureType } from '../types';
import type { FeatureVisitor } from '../FeatureVisitor';
import type { ThreadParams } from '../../entities/ThreadEntity';

export interface ThreadFeatureParams extends ThreadParams {
  color?: string;
}

export class ThreadFeature extends LeafFeature<ThreadFeatureParams> {
  readonly type: FeatureType = 'thread';
  accept<R>(v: FeatureVisitor<R>): R { return v.visitThread(this); }
}
