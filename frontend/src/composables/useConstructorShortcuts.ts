export type MoveDirection = 'left' | 'right' | 'forward' | 'backward' | 'up' | 'down';

export type ConstructorShortcutActions = {
  hasSelection: () => boolean;
  selectionCount: () => number;
  canDelete: () => boolean;
  canMerge: () => boolean;
  canUngroup: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  hasSceneObjects: () => boolean;
  delete: () => void;
  duplicate: (shrink: boolean) => void;
  move: (direction: MoveDirection, multiplier: number) => void;
  mirror: () => void;
  toggleSnap: () => void;
  alignment: () => void;
  chamfer: () => void;
  undo: () => void;
  redo: () => void;
  merge: () => void;
  ungroup: () => void;
};

/** Keyboard routing isolated from constructor state and command implementations. */
export function useConstructorShortcuts(actions: ConstructorShortcutActions) {
  function handleKeydown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) return;
    const hasCtrl = event.ctrlKey || event.metaKey;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (actions.canDelete()) run(event, actions.delete);
      return;
    }

    const direction = arrowDirection(event.key, hasCtrl);
    if (direction && actions.hasSelection()) {
      run(event, () => actions.move(direction, event.shiftKey ? 5 : 1));
      return;
    }

    if (!hasCtrl) {
      if (event.code === 'KeyM') run(event, actions.mirror);
      else if (event.code === 'KeyC') run(event, actions.toggleSnap);
      else if (event.code === 'KeyL' && actions.selectionCount() >= 2) run(event, actions.alignment);
      else if (event.code === 'KeyF' && actions.hasSceneObjects()) run(event, actions.chamfer);
      return;
    }

    if (event.code === 'KeyZ') {
      if (event.shiftKey && actions.canRedo()) run(event, actions.redo);
      else if (!event.shiftKey && actions.canUndo()) run(event, actions.undo);
    } else if (event.code === 'KeyD' && actions.canDelete()) {
      run(event, () => actions.duplicate(event.shiftKey));
    } else if (event.code === 'KeyM') {
      run(event, actions.mirror);
    } else if (event.code === 'KeyG') {
      if (event.shiftKey && actions.canUngroup()) run(event, actions.ungroup);
      else if (!event.shiftKey && actions.canMerge()) run(event, actions.merge);
    }
  }

  return { handleKeydown };
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (
    ['input', 'textarea', 'select'].includes(element.tagName.toLowerCase())
    || element.isContentEditable
  );
}

function arrowDirection(key: string, vertical: boolean): MoveDirection | null {
  if (vertical) {
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    return null;
  }
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'ArrowUp') return 'forward';
  if (key === 'ArrowDown') return 'backward';
  return null;
}

function run(event: KeyboardEvent, action: () => void): void {
  event.preventDefault();
  action();
}
