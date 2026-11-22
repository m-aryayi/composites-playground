/** Share link: read the tool state from the URL query and write it back. */

const WRITE_DELAY_MS = 150;

/** Return a query field for a number in [min, max]. */
export function numberField(fallback, min, max) {
    return Object.freeze({
        fallback,
        parse(text) {
            const value = Number(text);
            if (text.trim() === "" || !Number.isFinite(value)
                    || value < min || value > max) {
                return undefined;
            }
            return value;
        },
        format: (value) => String(value),
    });
}

/** Return a query field for a list of 1 to maxCount numbers ("0,45,90"). */
export function numberListField(fallback, maxCount) {
    return Object.freeze({
        fallback,
        parse(text) {
            const values = text.split(",").map((part) => Number(part));
            const valid = text.trim() !== "" && values.length <= maxCount
                && values.every((value) => Number.isFinite(value));
            return valid ? values : undefined;
        },
        format: (values) => values.map(String).join(","),
    });
}

/** Return a query field for one text of a fixed list. */
export function choiceField(fallback, choices) {
    return Object.freeze({
        fallback,
        parse: (text) => (choices.includes(text) ? text : undefined),
        format: (value) => value,
    });
}

/** Return the state in a query; a missing or wrong value gives its fallback. */
export function readQuery(schema, search = window.location.search) {
    const params = new URLSearchParams(search);
    const state = {};
    for (const [key, field] of Object.entries(schema)) {
        const text = params.get(key);
        const value = text === null ? undefined : field.parse(text);
        state[key] = value === undefined ? field.fallback : value;
    }
    return state;
}

/** Return the query text of a state ("?a=1&b=2"), without default values. */
export function queryText(schema, state) {
    const params = new URLSearchParams();
    for (const [key, field] of Object.entries(schema)) {
        const text = field.format(state[key]);
        if (text !== field.format(field.fallback)) {
            params.set(key, text);
        }
    }
    const query = params.toString();
    return query ? `?${query}` : "";
}

/** Return the full share link of a state. */
export function shareUrl(schema, state) {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}${queryText(schema, state)}`;
}

/**
 * Keep the URL query equal to the store state, with no new history entry.
 *
 * Returns the unsubscribe function.
 */
export function bindQuery(store, schema) {
    let timer = 0;
    return store.subscribe((state) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            const { pathname, hash } = window.location;
            const url = `${pathname}${queryText(schema, state)}${hash}`;
            window.history.replaceState(window.history.state, "", url);
        }, WRITE_DELAY_MS);
    });
}

/** Copy a text to the clipboard; return true if it worked. */
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Older browsers: copy from a hidden text box.
        const box = document.createElement("textarea");
        box.value = text;
        box.setAttribute("readonly", "");
        box.style.position = "fixed";
        box.style.opacity = "0";
        document.body.append(box);
        box.select();
        const copied = document.execCommand("copy");
        box.remove();
        return copied;
    }
}
