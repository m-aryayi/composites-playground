/**
 * Geometry of the RVE block: hexagonal fibers, their cut on each block face.
 *
 * Axis 1 is along the fibers (block length), axis 2 across (width), and
 * axis 3 up (height). A port of the block functions of
 * python/rve_homogenization.py, with the same order of operations.
 */

import {
    ARC_POINTS,
    BLOCK_HEIGHT,
    BLOCK_LENGTH,
    BLOCK_WIDTH,
    FIBER_RADIUS,
} from "./config.js";

/** Return [width (axis 2), height (axis 3)] of the block. */
export function blockSize() {
    return [BLOCK_WIDTH, BLOCK_HEIGHT];
}

/** Return the distance between two fiber centers: Vf = 2πr²/(√3 a²). */
export function fiberSpacing(vf) {
    return FIBER_RADIUS * Math.sqrt(2.0 * Math.PI / (Math.sqrt(3.0) * vf));
}

/**
 * Return the centers [axis 2, axis 3] of the fibers that can touch the block.
 *
 * The pattern has one fiber in the middle of the block, so the fibers are
 * symmetric about both block center lines.
 */
export function hexCenters(vf) {
    const [width, height] = blockSize();
    const spacing = fiberSpacing(vf);
    const rowStep = spacing * Math.sqrt(3.0) / 2.0;
    const rows = Math.trunc(Math.ceil((height / 2.0 + FIBER_RADIUS) / rowStep));
    const columns = Math.trunc(Math.ceil((width / 2.0 + FIBER_RADIUS) / spacing)) + 1;
    const centers = [];
    for (let row = -rows; row <= rows; row += 1) {
        // Python: row % 2 is 1 for odd rows, also for negative rows.
        const shift = row % 2 !== 0 ? spacing / 2.0 : 0.0;
        for (let column = -columns; column <= columns; column += 1) {
            const y = width / 2.0 + shift + column * spacing;
            const z = height / 2.0 + row * rowStep;
            if (-FIBER_RADIUS < y && y < width + FIBER_RADIUS
                    && -FIBER_RADIUS < z && z < height + FIBER_RADIUS) {
                centers.push([y, z]);
            }
        }
    }
    return centers;
}

/** Return the outline [axis 2, axis 3] of one full fiber. */
export function fiberCircle(center) {
    const step = 2.0 * Math.PI / ARC_POINTS;      // numpy.linspace, endpoint=False
    return Array.from({ length: ARC_POINTS }, (_, i) => {
        const angle = i * step;
        return [center[0] + FIBER_RADIUS * Math.cos(angle),
                center[1] + FIBER_RADIUS * Math.sin(angle)];
    });
}

/**
 * Return the part of a polygon [axis 2, axis 3] inside the block cross section.
 *
 * Sutherland-Hodgman clipping: cut the polygon at each block edge in turn.
 */
export function clipToBlock(points) {
    const [width, height] = blockSize();
    // [axis, edge value, +1 if the inside is above the value, -1 if below]
    const edges = [[0, 0.0, 1.0], [0, width, -1.0], [1, 0.0, 1.0], [1, height, -1.0]];
    let polygon = points;
    for (const [axis, limit, inside] of edges) {
        const kept = [];
        polygon.forEach((start, i) => {
            const end = polygon[(i + 1) % polygon.length];
            const startIn = inside * (start[axis] - limit) >= 0.0;
            const endIn = inside * (end[axis] - limit) >= 0.0;
            if (startIn) {
                kept.push(start);
            }
            if (startIn !== endIn) {
                const t = (limit - start[axis]) / (end[axis] - start[axis]);
                kept.push([start[0] + t * (end[0] - start[0]),
                           start[1] + t * (end[1] - start[1])]);
            }
        });
        polygon = kept;
    }
    return polygon;
}

/** Return the outline of each fiber part on the block cross section. */
export function fiberSections(vf) {
    return hexCenters(vf).map((center) => clipToBlock(fiberCircle(center)))
        .filter((part) => part.length >= 3);
}

/** Return the area of a polygon (shoelace formula). */
export function polygonArea(points) {
    let sum = 0.0;
    points.forEach(([y, z], i) => {
        const [yNext, zNext] = points[(i + 1) % points.length];
        sum += y * zNext - z * yNext;
    });
    return 0.5 * Math.abs(sum);
}

/** Return the fiber area of the block cross section over its area. */
export function blockVf(vf) {
    const [width, height] = blockSize();
    const fiberArea = fiberSections(vf)
        .reduce((total, part) => total + polygonArea(part), 0.0);
    return fiberArea / (width * height);
}

/** Return a rectangle in the plane axis = value (the other two in order). */
export function planeQuad(axis, value, uRange, vRange) {
    const corners = [[uRange[0], vRange[0]], [uRange[1], vRange[0]],
                     [uRange[1], vRange[1]], [uRange[0], vRange[1]]];
    return corners.map((corner) => {
        const point = [...corner];
        point.splice(axis, 0, value);
        return point;
    });
}

/**
 * Return the six block faces: { axis, side, rectangle, parts }.
 *
 * side is -1 or +1: the direction of the outward normal along the axis.
 * The faces across the fibers show the cut circles; the side faces show a
 * strip for each fiber that crosses them. Points are [axis 1, axis 2, axis 3].
 */
export function blockFaces(vf) {
    const [width, height] = blockSize();
    const size = [BLOCK_LENGTH, width, height];
    const sections = fiberSections(vf);
    const centers = hexCenters(vf);
    const faces = [];
    for (const side of [-1, 1]) {
        const x = side > 0 ? size[0] : 0.0;
        faces.push({
            axis: 0,
            side,
            rectangle: planeQuad(0, x, [0.0, width], [0.0, height]),
            parts: sections.map((part) => part.map(([y, z]) => [x, y, z])),
        });
    }
    for (const [axis, other] of [[1, 2], [2, 1]]) {
        for (const side of [-1, 1]) {
            const value = side > 0 ? size[axis] : 0.0;
            const parts = [];
            for (const center of centers) {
                // A fiber at a distance d from the face plane cuts it in a
                // strip of width 2 √(r² - d²).
                const distance = center[axis - 1] - value;
                if (Math.abs(distance) >= FIBER_RADIUS) {
                    continue;
                }
                const half = Math.sqrt(FIBER_RADIUS ** 2 - distance ** 2);
                const low = Math.max(center[other - 1] - half, 0.0);
                const high = Math.min(center[other - 1] + half, size[other]);
                if (high > low) {
                    parts.push(planeQuad(axis, value, [0.0, size[0]], [low, high]));
                }
            }
            faces.push({
                axis,
                side,
                rectangle: planeQuad(axis, value, [0.0, size[0]],
                                     [0.0, size[3 - axis]]),
                parts,
            });
        }
    }
    return faces;
}
