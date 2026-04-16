import { ref, onMounted, onBeforeUnmount } from 'vue';

const MOBILE_BP = 768;

export function useTourPlacement() {
  const isMobile = ref(window.innerWidth <= MOBILE_BP);

  const update = () => { isMobile.value = window.innerWidth <= MOBILE_BP; };

  onMounted(() => window.addEventListener('resize', update));
  onBeforeUnmount(() => window.removeEventListener('resize', update));

  /** На мобильном left/right → bottom, остальное без изменений */
  const tp = (placement: string): string => {
    if (!isMobile.value) return placement;
    if (placement === 'left' || placement === 'right') return 'bottom';
    return placement;
  };

  return { isMobile, tp };
}
