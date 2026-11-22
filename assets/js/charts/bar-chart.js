/** Grouped bar chart in SVG: round top corners, values on top, one bar stands out. */

import { el } from "../core/dom.js";
import {
    line,
    linearScale,
    niceTicks,
    svg,
    text,
    tickText,
    verticalLabel,
    watchSize,
} from "./svg.js";

const MARGIN = Object.freeze({ top: 24, right: 8, bottom: 30, left: 50 });
const Y_TICK_COUNT = 4;
const HEADROOM = 1.18;                 // room above the highest bar for its value
const BAR_WIDTH = 0.145;               // in group units (the group step is 1)
const BAR_STEP = 0.16;
const BAND_HALF = 0.46;
const CORNER = 3;                      // pixels
const VALUE_GAP = 4;                   // pixels from a bar top to its value
const TICK_GAP = 8;                    // pixels from the axis to its tick values
const GROUP_DROP = 20;                 // pixels below the plot for the group names
const Y_NAME_X = 12;

/** Return the SVG path of a bar with round top corners and a square base. */
function barPath(left, width, top, base) {
    const r = Math.min(CORNER, width / 2, Math.max(base - top, 0));
    const right = left + width;
    return `M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}`
        + `H${right - r}Q${right},${top} ${right},${top + r}V${base}Z`;
}

/** Return the legend items: a color swatch and a name for each series. */
function legendItems(series) {
    return series.map((item) => {
        const swatch = el("span", { className: "chart-legend__swatch",
                                    attrs: { style: `background: ${item.color}` } });
        const className = `chart-legend__item${item.strong ? " is-strong" : ""}`;
        return el("span", { className }, [swatch, item.name]);
    });
}

/**
 * Make a grouped bar chart in container and return { update }.
 *
 * options: groups (names along x), series ([{ name, color, strong }]).
 * update({ values, texts, yLabel, description }): values[series][group];
 * texts[series][group] is the text on top of each bar.
 */
export function createBarChart(container, { groups, series }) {
    const legend = el("div", { className: "chart-legend" }, legendItems(series));
    const box = el("div", { className: "chart-box" });
    const root = svg("svg", { class: "chart", role: "img" });
    box.append(root);
    container.append(legend, box);
    let data = null;
    let size = null;

    function draw() {
        if (!data || !size) {
            return;
        }
        const [width, height] = size;
        root.setAttribute("viewBox", `0 0 ${width} ${height}`);
        root.setAttribute("width", width);
        root.setAttribute("height", height);
        root.setAttribute("aria-label", data.description ?? "");
        const left = MARGIN.left;
        const right = width - MARGIN.right;
        const top = MARGIN.top;
        const bottom = height - MARGIN.bottom;
        const highest = Math.max(...data.values.flat().filter(Number.isFinite), 0);
        const ticks = niceTicks(HEADROOM * highest, Y_TICK_COUNT);
        const y = linearScale([0, ticks.at(-1)], [bottom, top]);
        const x = linearScale([-0.5, groups.length - 0.5], [left, right]);
        const unit = x(1) - x(0);
        const parts = [];
        groups.forEach((name, g) => {
            const band = { class: "chart__band", x: x(g - BAND_HALF), y: top,
                           width: 2 * BAND_HALF * unit, height: bottom - top };
            parts.push(svg("rect", band),
                       text("chart__group", x(g), bottom + GROUP_DROP, name,
                            { "text-anchor": "middle" }));
        });
        for (const tick of ticks) {
            parts.push(line("chart__grid", left, y(tick), right, y(tick)),
                       text("chart__tick", left - TICK_GAP, y(tick), tickText(tick),
                            { "text-anchor": "end", "dominant-baseline": "middle" }));
        }
        const middle = (series.length - 1) / 2;
        const barWidth = BAR_WIDTH * unit;
        series.forEach((item, s) => {
            groups.forEach((_, g) => {
                const value = data.values[s][g];
                const center = x(g + (s - middle) * BAR_STEP);
                const barTop = Number.isFinite(value) ? y(value) : bottom;
                const path = barPath(center - barWidth / 2, barWidth, barTop, bottom);
                const valueClass = `chart__value${item.strong ? " is-strong" : ""}`;
                parts.push(svg("path", { d: path, fill: item.color }),
                           text(valueClass, center, barTop - VALUE_GAP,
                                data.texts[s][g], { "text-anchor": "middle" }));
            });
        });
        parts.push(line("chart__axis", left, bottom, right, bottom),
                   verticalLabel(data.yLabel, Y_NAME_X, (top + bottom) / 2));
        root.replaceChildren(...parts);
    }

    watchSize(box, (width, height) => {
        size = [width, height];
        draw();
    });
    return Object.freeze({
        update(next) {
            data = next;
            draw();
        },
    });
}
