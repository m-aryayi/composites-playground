/** SVG helpers for the charts: elements, scales, nice ticks, and size watch. */

const SVG_NS = "http://www.w3.org/2000/svg";
const NICE_STEPS = [1, 2, 2.5, 5, 10];

/** Return a new SVG element with attributes and children. */
export function svg(tag, attrs = {}, children = []) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
        node.setAttribute(name, String(value));
    }
    node.append(...children);
    return node;
}

/** Return an SVG text element with a class at (x, y). */
export function text(className, x, y, content, attrs = {}) {
    return svg("text", { class: className, x, y, ...attrs }, [content]);
}

/** Return an SVG line element with a class from (x1, y1) to (x2, y2). */
export function line(className, x1, y1, x2, y2) {
    return svg("line", { class: className, x1, y1, x2, y2 });
}

/** Return a vertical axis name, turned by 90 degrees, centered at (x, y). */
export function verticalLabel(content, x, y) {
    return text("chart__label", x, y, content,
                { "text-anchor": "middle", transform: `rotate(-90 ${x} ${y})` });
}

/** Return a function that maps [d0, d1] linearly onto [r0, r1]. */
export function linearScale([d0, d1], [r0, r1]) {
    const factor = (r1 - r0) / (d1 - d0 || 1);
    return (value) => r0 + (value - d0) * factor;
}

/** Return ticks from 0 to at least max, with a nice step, at most count steps. */
export function niceTicks(max, count) {
    if (!(max > 0)) {
        return [0, 1];
    }
    const rough = max / count;
    const power = 10 ** Math.floor(Math.log10(rough));
    const step = power * NICE_STEPS.find((nice) => nice * power >= rough);
    const ticks = [];
    for (let value = 0; value < max + step * 0.999; value += step) {
        ticks.push(Number(value.toPrecision(12)));
    }
    return ticks;
}

/** Return a tick value as short text (no trailing zeros). */
export function tickText(value) {
    return String(Number(value.toPrecision(6)));
}

/**
 * Call draw(width, height) now and after each size change of element.
 *
 * Charts draw at their real pixel size, so the text keeps its size on a
 * phone and on a wide screen.
 */
export function watchSize(element, draw) {
    let last = "";
    const observer = new ResizeObserver(() => {
        const width = Math.round(element.clientWidth);
        const height = Math.round(element.clientHeight);
        const key = `${width}x${height}`;
        if (width > 0 && height > 0 && key !== last) {
            last = key;
            draw(width, height);
        }
    });
    observer.observe(element);
    return () => observer.disconnect();
}
