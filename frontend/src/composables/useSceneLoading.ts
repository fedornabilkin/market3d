import { ref } from 'vue';

/** Keeps scene loading feedback visible after synchronous scene work has finished. */
export function useSceneLoading(hideDelayMs = 1000) {
  const visible = ref(false);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function start(): void {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    visible.value = true;
  }

  function finish(): void {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      visible.value = false;
      hideTimer = null;
    }, hideDelayMs);
  }

  function dispose(): void {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  return { visible, start, finish, dispose };
}
