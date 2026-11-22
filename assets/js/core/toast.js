/** Toast: a short message at the bottom of the page that screen readers read. */

import { el, icon, qs } from "./dom.js";

const TOAST_DURATION_MS = 2000;

/**
 * Return the toast region; make it if it does not exist.
 *
 * Call it once when the page starts: a screen reader reads a live region
 * only if the region exists before its text changes.
 */
export function prepareToasts() {
    const region = qs(".toast-region");
    if (region) {
        return region;
    }
    const made = el("div", {
        className: "toast-region",
        attrs: { role: "status", "aria-live": "polite" },
    });
    document.body.append(made);
    return made;
}

/** Show a short message for a few seconds. */
export function showToast(message, { iconName = "check" } = {}) {
    const region = prepareToasts();
    const toast = el("span", { className: "toast" }, [icon(iconName), message]);
    region.replaceChildren(toast);
    window.setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}
