/**
 * Laminate physics (classical lamination theory) and drawing helpers.
 *
 * A port of python/laminate_symmetry.py: the same functions, in the same
 * order of operations, with camelCase names. Pure functions only.
 * Reference: Kaw, A. K. (2005). Mechanics of Composite Materials, 2nd ed.
 */

import {
    add,
    block,
    mapMatrix,
    matMul,
    maxAbs,
    solve,
    transpose,
    zeros,
} from "../../assets/js/core/linalg.js";
import {
    COUPLING_TOLERANCE,
    FIBER_SPACING,
    MATERIAL,
    MATERIAL_NAME,
    MIN_ROWS,
    PLATE_COUPLING_RATIO,
    PLATE_GRID_POINTS,
    PLATE_HIGH,
    PLATE_LOW,
    PLATE_OUT_OF_PLANE_SCALE,
    PLATE_SHEAR_SCALE,
    PLATE_SIZE_MM,
    PLY_SLAB_FRACTION,
    PLY_THICKNESS,
    PULL_LOAD,
    STACK_HEIGHT,
} from "./config.js";

const DEG_TO_RAD = Math.PI / 180;      // the same factor as numpy.radians
const TINY = 1.0e-30;
const LINE_TOLERANCE = 1.0e-12;
const ISCLOSE_RTOL = 1.0e-5;           // numpy.isclose defaults
const ISCLOSE_ATOL = 1.0e-8;
const GENERAL_DIGITS = 6;              // Python format "g"

// ---------------------------------------------------------------- helpers

/** Return a % b with the sign of b, as the Python % operator does. */
export function pyMod(a, b) {
    let result = a % b;
    if (result !== 0 && (b < 0) !== (result < 0)) {
        result += b;
    }
    return result;
}

/** Return true if a is close to b, as numpy.isclose(a, b) does. */
function isClose(a, b) {
    return Math.abs(a - b) <= ISCLOSE_ATOL + ISCLOSE_RTOL * Math.abs(b);
}

/** Return x rounded to a whole number, a tie to the even number (as Python). */
function roundHalfEven(x) {
    if (Math.abs(x - Math.trunc(x)) === 0.5) {
        return 2 * Math.round(x / 2);
    }
    return Math.round(x);
}

/** Return a number as Python format "g" does for these values (6 digits). */
function formatG(value) {
    return String(Number(value.toPrecision(GENERAL_DIGITS)));
}

/** Return num evenly spaced values from start to stop, as numpy.linspace. */
function linspace(start, stop, num) {
    const step = (stop - start) / (num - 1);
    const values = Array.from({ length: num }, (_, i) => i * step + start);
    values[num - 1] = stop;
    return values;
}

/** Return a grid of a function of the grid indexes (rows i, columns j). */
function grid(rows, cols, fn) {
    return Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (__, j) => fn(i, j)));
}

// ------------------------------------------- laminate mechanics (CLT)

/** Return the 3x3 stiffness matrix Q of one ply in its fiber axes (Kaw Eq. 2.93). */
export function reducedStiffness(material) {
    const { E1: e1, E2: e2, nu12, G12: g12 } = material;
    const nu21 = nu12 * e2 / e1;
    const denom = 1.0 - nu12 * nu21;
    return [
        [e1 / denom, nu12 * e2 / denom, 0.0],
        [nu12 * e2 / denom, e2 / denom, 0.0],
        [0.0, 0.0, g12],
    ];
}

/** Return the matrix that turns global strains into fiber-axis strains. */
export function strainTransform(thetaDeg) {
    const c = Math.cos(thetaDeg * DEG_TO_RAD);
    const s = Math.sin(thetaDeg * DEG_TO_RAD);
    return [
        [c * c, s * s, c * s],
        [s * s, c * c, -c * s],
        [-2.0 * c * s, 2.0 * c * s, c * c - s * s],
    ];
}

/** Return the 6x6 ABD matrix. Ply 1 is the top ply (z = -h/2), Kaw Eq. 4.28. */
export function abdMatrix(angles, thickness, material = MATERIAL) {
    const nPlies = angles.length;
    const z = Array.from({ length: nPlies + 1 },
                         (_, k) => thickness * (k - nPlies / 2.0));
    const q = reducedStiffness(material);
    let a = zeros(3, 3);
    let b = zeros(3, 3);
    let d = zeros(3, 3);
    for (let k = 0; k < nPlies; k += 1) {
        const te = strainTransform(angles[k]);
        const qbar = matMul(matMul(transpose(te), q), te);
        const dz = z[k + 1] - z[k];
        const dz2 = z[k + 1] ** 2 - z[k] ** 2;
        const dz3 = z[k + 1] ** 3 - z[k] ** 3;
        a = add(a, mapMatrix(qbar, (v) => v * dz));
        b = add(b, mapMatrix(qbar, (v) => v * dz2 / 2.0));
        d = add(d, mapMatrix(qbar, (v) => v * dz3 / 3.0));
    }
    return [
        ...a.map((row, i) => [...row, ...b[i]]),
        ...b.map((row, i) => [...row, ...d[i]]),
    ];
}

/** Return the largest absolute value of [A] (the scale of the round-off limits). */
function aScale(abd) {
    return maxAbs(block(abd, 0, 3, 0, 3));
}

/** Return true if [B] is not zero: pulling the laminate also bends it. */
export function isCoupled(abd, thickness) {
    const bSize = maxAbs(block(abd, 0, 3, 3, 6));
    return bSize > COUPLING_TOLERANCE * aScale(abd) * thickness;
}

/** Return [strains, curvatures] of the mid-plane for a load (Kaw Eq. 4.29). */
export function midplaneResponse(abd, load) {
    const response = solve(abd, [...load, 0.0, 0.0, 0.0]);
    return [response.slice(0, 3), response.slice(3, 6)];
}

/** Return A16 and A26 in N/mm, with round-off values set to zero. */
export function shearValues(abd) {
    const limit = COUPLING_TOLERANCE * aScale(abd);
    return [abd[0][2], abd[1][2]].map((v) => (Math.abs(v) <= limit ? 0.0 : v));
}

/** Return true if A16 = A26 = 0 (a balanced laminate). */
export function isBalanced(abd) {
    return shearValues(abd).every((v) => v === 0.0);
}

/** Return the 3x3 [B] matrix in N, with round-off values set to zero. */
export function couplingValues(abd, thickness) {
    const limit = COUPLING_TOLERANCE * aScale(abd) * thickness;
    return mapMatrix(block(abd, 0, 3, 3, 6), (v) => (Math.abs(v) <= limit ? 0.0 : v));
}

/** Return the fixed inputs of the calculation as [name, value] texts. */
export function inputRows(angles) {
    const stack = angles.map(formatAngle).join("/");
    return [
        ["Material", MATERIAL_NAME],
        ["E1,  E2", `${formatG(MATERIAL.E1 / 1000)} GPa,  `
                    + `${formatG(MATERIAL.E2 / 1000)} GPa`],
        ["ν12,  G12", `${formatG(MATERIAL.nu12)},  `
                      + `${formatG(MATERIAL.G12 / 1000)} GPa`],
        ["Ply thickness", `${formatG(PLY_THICKNESS)} mm`],
        ["Stack, top to bottom", `[${stack}]`],
        ["Total thickness", `${formatG(angles.length * PLY_THICKNESS)} mm`],
        ["Pull (plate shape only)", `Nx = ${formatG(PULL_LOAD[0])} N/mm`],
    ];
}

/** Return each ply and its mirror ply across the mid-plane, outer first. */
export function mirrorPairs(nPlies) {
    return Array.from({ length: Math.floor(nPlies / 2) },
                      (_, k) => [k, nPlies - 1 - k]);
}

/**
 * Return [x, y, w, label]: the plate with an exaggerated bend and a label.
 *
 * The plate does not show its small stretch, so a flat plate lies on its
 * flat outline. It shows the shear (exaggerated) of an unbalanced stack.
 */
export function plateShape(strain, curvature) {
    const [x, y] = flatPlate();
    const n = PLATE_GRID_POINTS;
    const size = PLATE_SIZE_MM;
    const u = grid(n, n, (i, j) =>
        (strain[0] * x[i][j] + 0.5 * strain[2] * y[i][j]) * size);
    const v = grid(n, n, (i, j) =>
        (0.5 * strain[2] * x[i][j] + strain[1] * y[i][j]) * size);
    let w = grid(n, n, (i, j) => -0.5 * (curvature[0] * x[i][j] ** 2
                                         + curvature[1] * y[i][j] ** 2
                                         + curvature[2] * x[i][j] * y[i][j])
                                 * size ** 2);
    const inPlane = Math.max(maxAbs(u), maxAbs(v));
    const outOfPlane = maxAbs(w);
    const stretch = Math.max(Math.abs(strain[0]), Math.abs(strain[1]), TINY);
    const sheared = Math.abs(strain[2]) > PLATE_COUPLING_RATIO * stretch;
    let px = x;
    let py = y;
    if (sheared) {
        // Shear only: the square becomes a slanted shape.
        const sign = Math.sign(strain[2]);
        px = grid(n, n, (i, j) => x[i][j] + PLATE_SHEAR_SCALE * sign * y[i][j]);
        py = grid(n, n, (i, j) => y[i][j] + PLATE_SHEAR_SCALE * sign * x[i][j]);
    }
    if (outOfPlane <= PLATE_COUPLING_RATIO * Math.max(inPlane, TINY)) {
        const flat = zeros(n, n);
        return [px, py, flat, sheared ? "stays flat but shears" : "stays flat"];
    }
    w = mapMatrix(w, (value) => value * PLATE_OUT_OF_PLANE_SCALE / outOfPlane);
    const bend = Math.max(Math.abs(curvature[0]), Math.abs(curvature[1]));
    const twist = Math.abs(curvature[2]) / 2.0;
    let label = "curls and twists";
    if (twist > 2.0 * bend) {
        label = "twists";
    } else if (bend > 2.0 * twist) {
        label = "curls";
    }
    if (sheared && label === "curls and twists") {
        label = "curls, twists, and shears";
    } else if (sheared) {
        label = `${label} and shears`;
    }
    return [px, py, w, label];
}

// --------------------------------------------------------- angle helpers

/** Return the same fiber angle in the range [-90, 90] degrees. */
export function normalizeAngle(angle) {
    if (angle >= -90.0 && angle <= 90.0) {
        return angle;
    }
    return pyMod(angle + 90.0, 180.0) - 90.0;
}

/** Return a ply angle as text, with a sign for all angles except 0 and 90. */
export function formatAngle(angle) {
    if (angle === 0.0 || angle === 90.0) {
        // Python prints -0.0 as "-0".
        return `${Object.is(angle, -0) ? "-0" : roundHalfEven(angle)}°`;
    }
    const rounded = roundHalfEven(angle);
    const negative = angle < 0 || Object.is(angle, -0);
    return `${negative ? "-" : "+"}${Math.abs(rounded)}°`;
}

/** Return true if two ply angles give the same fiber direction (-90 = 90). */
export function sameDirection(angle1, angle2) {
    const difference = pyMod(angle1 - angle2, 180.0);
    return isClose(difference, 0.0) || isClose(difference, 180.0);
}

// ------------------------------------------------------- drawing helpers

/** Return [centers, half]: the drawn z center of each ply (top first), half height. */
export function plyLevels(nPlies) {
    const pitch = STACK_HEIGHT / Math.max(nPlies, MIN_ROWS);
    const centers = Array.from({ length: nPlies },
                               (_, k) => ((nPlies - 1) / 2.0 - k) * pitch);
    return [centers, PLY_SLAB_FRACTION * pitch / 2.0];
}

/**
 * Return 2x2 line segments that show the fiber direction inside a box.
 *
 * box is [xMin, yMin, xMax, yMax]. The rows of a segment are x and y.
 */
export function fiberLines(angle, box) {
    const direction = [Math.cos(angle * DEG_TO_RAD), Math.sin(angle * DEG_TO_RAD)];
    const normal = [-direction[1], direction[0]];
    const center = [(box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0];
    const reach = Math.hypot(box[2] - box[0], box[3] - box[1]) / 2.0;
    const count = Math.ceil(reach / FIBER_SPACING);
    const segments = [];
    for (let j = -count; j <= count; j += 1) {
        const offset = j * FIBER_SPACING;
        const point = [center[0] + offset * normal[0], center[1] + offset * normal[1]];
        let tLow = -Infinity;
        let tHigh = Infinity;
        let inside = true;
        for (let i = 0; i < 2; i += 1) {
            if (Math.abs(direction[i]) < LINE_TOLERANCE) {
                inside = inside && box[i] <= point[i] && point[i] <= box[i + 2];
            } else {
                const t1 = (box[i] - point[i]) / direction[i];
                const t2 = (box[i + 2] - point[i]) / direction[i];
                tLow = Math.max(tLow, Math.min(t1, t2));
                tHigh = Math.min(tHigh, Math.max(t1, t2));
            }
        }
        if (inside && tLow < tHigh) {
            const start = [point[0] + tLow * direction[0],
                           point[1] + tLow * direction[1]];
            const end = [point[0] + tHigh * direction[0],
                         point[1] + tHigh * direction[1]];
            segments.push([[start[0], end[0]], [start[1], end[1]]]);
        }
    }
    return segments;
}

/** Return [x, y]: the grids of the flat, unloaded plate (as numpy.meshgrid). */
export function flatPlate() {
    const side = linspace(-0.5, 0.5, PLATE_GRID_POINTS);
    const n = side.length;
    return [grid(n, n, (i, j) => side[j]), grid(n, n, (i) => side[i])];
}

/** Return [x, y, w] with only the effect that the switch shows. */
export function plateView(shape, mode) {
    let [x, y, w] = shape;
    if (mode === "Bend") {
        [x, y] = flatPlate();
    } else if (mode === "Shear") {
        w = zeros(w.length, w[0].length);
    }
    return [x, y, w];
}

/**
 * Return an RGB color per plate point: deeper color = the point moves more.
 *
 * The move includes the bend and the shear, so a plate that only shears
 * also gets darker corners. low and high are RGB colors from 0 to 1.
 */
export function plateColors(x, y, w, low = PLATE_LOW, high = PLATE_HIGH) {
    const [x0, y0] = flatPlate();
    const move = grid(x.length, x[0].length, (i, j) => Math.sqrt(
        (x[i][j] - x0[i][j]) ** 2 + (y[i][j] - y0[i][j]) ** 2 + w[i][j] ** 2));
    const largest = Math.max(maxAbs(move), TINY);
    return move.map((row) => row.map((value) => {
        const blend = value / largest;
        return low.map((channel, c) => channel + (high[c] - channel) * blend);
    }));
}

/** Return an eased fraction (slow start, slow end) for t in [0, 1]. */
export function smoothStep(t) {
    return t * t * (3.0 - 2.0 * t);
}
