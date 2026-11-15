// Keyboard and mouse, and the pointer lock that turns the mouse into look. Plain browser
// APIs only. Two extras over the usual pattern: a drag-to-look fallback (pointer lock can be
// refused or unavailable, and the game must still play), and an edge-triggered `pressed` set
// so one key tap fires one action (buy keys, grenade throw, plant) instead of repeating.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = new Set();
  const state = { keys, pressed, locked: false, firing: false, triggerEdge: false, lookX: 0, lookY: 0 };
  let dragging = false;

  function setKey(event, down) {
    if (event.code === 'Space') event.preventDefault();
    if (down) {
      if (!keys.has(event.code)) pressed.add(event.code);
      keys.add(event.code);
    } else {
      keys.delete(event.code);
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    setKey(event, true);
  });
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('blur', () => {
    keys.clear();
    state.firing = false;
    dragging = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (state.locked) {
      state.lookX += event.movementX;
      state.lookY += event.movementY;
    } else if (dragging) {
      state.lookX += event.movementX;
      state.lookY += event.movementY;
    }
  });
  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (state.locked) {
      state.firing = true;
      state.triggerEdge = true;
    } else dragging = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      state.firing = false;
      dragging = false;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      state.firing = false;
      dragging = false;
    }
    onLockChange(state.locked);
  });
  document.addEventListener('pointerlockerror', () => {
    state.locked = false;
    onLockChange(false);
  });

  return {
    state,
    requestLock() {
      try {
        const promise = canvas.requestPointerLock();
        if (promise && promise.catch) promise.catch(() => onLockChange(false));
      } catch (error) {
        onLockChange(false);
      }
    },
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    peekTriggerEdge() {
      return state.triggerEdge;
    },
    clearTriggerEdge() {
      state.triggerEdge = false;
    },
  };
}
