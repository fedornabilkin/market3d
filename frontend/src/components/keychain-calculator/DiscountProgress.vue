<script setup lang="ts">
import { computed } from 'vue';

export interface DiscountProgressPoint {
  threshold: number;
  discountLabel: string;
  thresholdLabel: string;
}

const props = defineProps<{
  current: number;
  points: DiscountProgressPoint[];
}>();

const maxThreshold = computed(() => (
  props.points[props.points.length - 1]?.threshold ?? 1
));
const percentage = computed(() => Math.min(
  100,
  Math.max(0, props.current / maxThreshold.value * 100),
));
const pointPosition = (threshold: number) => (
  `${Math.min(100, Math.max(0, threshold / maxThreshold.value * 100))}%`
);
</script>

<template lang="pug">
.discount-progress
  .discount-progress__scale
    .discount-progress__labels.discount-progress__labels--discount
      span.discount-progress__label(
        v-for="point in points"
        :key="`discount-${point.threshold}`"
        :class="{ 'discount-progress__label--reached': current >= point.threshold }"
        :style="{ left: pointPosition(point.threshold) }"
      ) {{ point.discountLabel }}

    .discount-progress__track
      .discount-progress__fill(
        :style="{ width: `${percentage}%` }"
      )
      span.discount-progress__marker(
        v-for="point in points"
        :key="`marker-${point.threshold}`"
        :class="{ 'discount-progress__marker--reached': current >= point.threshold }"
        :style="{ left: pointPosition(point.threshold) }"
      )

    .discount-progress__labels.discount-progress__labels--threshold
      span.discount-progress__label(
        v-for="point in points"
        :key="`threshold-${point.threshold}`"
        :class="{ 'discount-progress__label--reached': current >= point.threshold }"
        :style="{ left: pointPosition(point.threshold) }"
      ) {{ point.thresholdLabel }}
</template>

<style scoped>
.discount-progress__scale {
  padding: 0 1.1rem;
}

.discount-progress__labels {
  position: relative;
  height: 1.25rem;
  color: var(--el-text-color-secondary);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

.discount-progress__labels--discount {
  font-weight: 700;
}

.discount-progress__labels--threshold {
  margin-top: 0.2rem;
}

.discount-progress__label {
  position: absolute;
  white-space: nowrap;
  transform: translateX(-50%);
}

.discount-progress__label:last-child {
  transform: translateX(-100%);
}

.discount-progress__label--reached {
  color: var(--el-color-success);
}

.discount-progress__track {
  position: relative;
  height: 8px;
  overflow: visible;
  border-radius: 999px;
  background: var(--el-border-color-lighter);
}

.discount-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: var(--el-color-success);
  transition: width 0.25s ease;
}

.discount-progress__marker {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border: 2px solid var(--el-bg-color);
  border-radius: 50%;
  background: var(--el-border-color);
  box-shadow: 0 0 0 1px var(--el-border-color);
  transform: translate(-50%, -50%);
}

.discount-progress__marker:last-child {
  transform: translate(-100%, -50%);
}

.discount-progress__marker--reached {
  background: var(--el-color-success);
  box-shadow: 0 0 0 1px var(--el-color-success);
}
</style>
