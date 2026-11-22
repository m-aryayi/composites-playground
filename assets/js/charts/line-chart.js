/** Line chart in SVG: lines with dash styles, labels at the line ends, markers. */

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

const MARGIN = Object.freeze({ top: 14, right: 84, bottom: 42, left: 50 });
const Y_TICK_COUNT = 4;
const MARKER_RADIUS = 5;
const LABEL_GAP = 8;                   // pixels from a line end to its label
const TICK_GAP = 8;                    // pixels from an axis to its tick values
const X_TICK_DROP = 18;                // pixels below the plot for the x values
const NAME_INSET = 6;                  // pixels from the edge to an axis name
const Y_NAME_X = 12;

/** Return the SVG path data of points [x, y] in pixels. */
function pathData(points) {
    return points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},`
                                       + `${py.toFixed(1)}`).join("");
}

/**
 * Make a line chart in container and return { update }.
 *
 * options: xLabel, yLabel, xMax, xStep (the x ticks).
 * update({ lines, yMax, description }): each line is { label, values: [[x, y]],
 * dash ("" or "6 4"), color, marker: [x, y] or null }.
 */
export function createLineChart(container, { xLabel, yLabel, xMax, xStep }) {
    const root = svg("svg", { class: "chart", role: "img" });
    container.append(root);
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
        const yTicks = niceTicks(data.yMax, Y_TICK_COUNT);
        const x = linearScale([0, xMax], [left, right]);
        const y = linearScale([0, yTicks.at(-1)], [bottom, top]);
        const parts = [];
        for (const tick of yTicks) {
            parts.push(line("chart__grid", left, y(tick), right, y(tick)),
                       text("chart__tick", left - TICK_GAP, y(tick), tickText(tick),
                            { "text-anchor": "end", "dominant-baseline": "middle" }));
        }
        for (let tick = 0; tick <= xMax + 1e-9; tick += xStep) {
            parts.push(text("chart__tick", x(tick), bottom + X_TICK_DROP,
                            tickText(tick), { "text-anchor": "middle" }));
        }
        parts.push(line("chart__axis", left, bottom, right, bottom),
                   text("chart__label", (left + right) / 2, height - NAME_INSET, xLabel,
                        { "text-anchor": "middle" }),
                   verticalLabel(yLabel, Y_NAME_X, (top + bottom) / 2));
        for (const item of data.lines) {
            const points = item.values.map(([vx, vy]) => [x(vx), y(vy)]);
            parts.push(svg("path", { class: "chart__line", d: pathData(points),
                                     stroke: item.color,
                                     "stroke-dasharray": item.dash }));
            const [endX, endY] = points.at(-1);
            parts.push(text("chart__end", endX + LABEL_GAP, endY, item.label,
                            { "dominant-baseline": "middle", fill: item.color }));
            if (item.marker) {
                parts.push(svg("circle", { class: "chart__marker", r: MARKER_RADIUS,
                                           cx: x(item.marker[0]), cy: y(item.marker[1]),
                                           stroke: item.color }));
            }
        }
        root.replaceChildren(...parts);
    }

    watchSize(container, (width, height) => {
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
