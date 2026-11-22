/** Tool state: one frozen object that the stage reads, changes, and watches. */

/**
 * Return a new store with get(), set(change), and subscribe(listener).
 *
 * set() merges the change and calls each listener with (state, previous),
 * but only when a value changes. subscribe() returns an unsubscribe function.
 */
export function createStore(initial) {
    let state = Object.freeze({ ...initial });
    const listeners = new Set();
    return Object.freeze({
        get() {
            return state;
        },
        set(change) {
            const changed = Object.keys(change)
                .some((key) => !Object.is(state[key], change[key]));
            if (!changed) {
                return;
            }
            const previous = state;
            state = Object.freeze({ ...state, ...change });
            for (const listener of listeners) {
                listener(state, previous);
            }
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    });
}
