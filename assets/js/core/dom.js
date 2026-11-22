/** Small DOM helpers: make elements and icons, and find elements. */

const SVG_NS = "http://www.w3.org/2000/svg";
const SPRITE_URL = new URL("../../img/icons.svg", import.meta.url).href;

/**
 * Return a new element.
 *
 * props: className, text, attrs (attribute map), dataset (data-* map).
 * children: nodes or strings, added in order.
 */
export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    if (props.className) {
        node.className = props.className;
    }
    if (props.text !== undefined) {
        node.textContent = props.text;
    }
    for (const [name, value] of Object.entries(props.attrs ?? {})) {
        node.setAttribute(name, value);
    }
    Object.assign(node.dataset, props.dataset ?? {});
    node.append(...children);
    return node;
}

/** Return an icon from the sprite, hidden from screen readers. */
export function icon(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `${SPRITE_URL}#${name}`);
    svg.append(use);
    return svg;
}

/** Return the first element that matches a selector, or null. */
export function qs(selector, root = document) {
    return root.querySelector(selector);
}

/** Return all elements that match a selector, as an array. */
export function qsa(selector, root = document) {
    return [...root.querySelectorAll(selector)];
}
