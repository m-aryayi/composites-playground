/** Tests of the laminate lesson: the original app checks and the golden values. */

import {
    MATERIAL,
    PLY_THICKNESS,
    PULL_LOAD,
} from "../tools/laminate-symmetry/config.js";
import {
    abdMatrix,
    couplingValues,
    fiberLines,
    flatPlate,
    formatAngle,
    inputRows,
    isBalanced,
    isCoupled,
    midplaneResponse,
    mirrorPairs,
    normalizeAngle,
    plateColors,
    plateShape,
    plateView,
    plyLevels,
    reducedStiffness,
    sameDirection,
    shearValues,
    smoothStep,
    strainTransform,
} from "../tools/laminate-symmetry/model.js";
import { expectClose, expectTrue } from "./runner.js";

const GOLDEN_URL = new URL("./golden/laminate-symmetry.json", import.meta.url);
const VIEW_MODES = ["Bend", "Shear", "Both"];
// Kaw (2005), Example 4.2: [0/30/-45] graphite/epoxy, 5 mm plies.
const KAW = Object.freeze({ angles: [0, 30, -45], thickness: 5.0, A11: 1.739e6,
                            B11: -3.129e6, D11: 3.343e7, tolerance: 5.0e-3 });
const ALLCLOSE_RTOL = 1.0e-5;        // numpy.allclose defaults
const ALLCLOSE_ATOL = 1.0e-8;

/** Return true if all numbers of a and b are close, as numpy.allclose. */
function allClose(a, b) {
    const left = a.flat(Infinity);
    const right = b.flat(Infinity);
    return left.every((value, i) => Math.abs(value - right[i])
        <= ALLCLOSE_ATOL + ALLCLOSE_RTOL * Math.abs(right[i]));
}

/** Return the curvatures of a stack under the pull. */
function curvatureOf(angles) {
    return midplaneResponse(abdMatrix(angles, PLY_THICKNESS), PULL_LOAD)[1];
}

/** Return the plate label of a stack under the pull. */
function labelOf(angles) {
    const abd = abdMatrix(angles, PLY_THICKNESS);
    return plateShape(...midplaneResponse(abd, PULL_LOAD))[3];
}

/** Add the 9 checks of the original app (its --check option). */
function registerChecks(suite) {
    const kaw = abdMatrix(KAW.angles, KAW.thickness);
    for (const [name, got, book] of [["A11", kaw[0][0], KAW.A11],
                                     ["B11", kaw[0][3], KAW.B11],
                                     ["D11", kaw[3][3], KAW.D11]]) {
        suite.test(`Check: Kaw Example 4.2, ${name}`, () => {
            expectTrue(Math.abs(got - book) <= KAW.tolerance * Math.abs(book),
                       `${name} = ${got}, book ${book}`);
        });
    }
    suite.test("Check: [0/90]s has [B] = 0 and stays flat", () => {
        const angles = [0, 90, 90, 0];
        expectTrue(!isCoupled(abdMatrix(angles, PLY_THICKNESS), 4 * PLY_THICKNESS)
                   && curvatureOf(angles).every((k) => Math.abs(k) <= ALLCLOSE_ATOL),
                   "[0/90]s is coupled or bends");
    });
    suite.test("Check: [0/90] has [B] ≠ 0 and curls", () => {
        const angles = [0, 90];
        expectTrue(isCoupled(abdMatrix(angles, PLY_THICKNESS), 2 * PLY_THICKNESS)
                   && Math.abs(curvatureOf(angles)[0]) > 0, "[0/90] does not curl");
    });
    suite.test("Check: [+45] is not balanced; [+45/-45] and [0/90] are", () => {
        expectTrue(!isBalanced(abdMatrix([45], PLY_THICKNESS))
                   && isBalanced(abdMatrix([45, -45], PLY_THICKNESS))
                   && isBalanced(abdMatrix([0, 90], PLY_THICKNESS)),
                   "balance is wrong");
    });
    suite.test("Check: [0/45/90]s stays flat but shears; [0/90]s stays flat", () => {
        const labels = [labelOf([0, 45, 90, 90, 45, 0]), labelOf([0, 90, 90, 0])];
        expectClose(labels, ["stays flat but shears", "stays flat"],
                    { label: "labels" });
    });
    suite.test("Check: mirror pairs of 5 plies are (1, 5) and (2, 4)", () => {
        expectClose(mirrorPairs(5), [[0, 4], [1, 3]], { label: "pairs" });
    });
    suite.test("Check: -90° and +90° plies: same direction and stiffness", () => {
        expectTrue(sameDirection(-90, 90) && !sameDirection(-45, 45)
                   && allClose(abdMatrix([-90], PLY_THICKNESS),
                               abdMatrix([90], PLY_THICKNESS)), "±90° differ");
    });
}

/** Return a stack as short text, for example "[0/+45/90]". */
function stackName(angles) {
    return `[${angles.map((a) => formatAngle(a).replace("°", "")).join("/")}]`;
}

/** Add one test per golden stack. */
function registerStacks(suite, stacks) {
    stacks.forEach((record, index) => {
        suite.test(`Stack ${index + 1} ${stackName(record.angles)}`, () => {
            const angles = record.angles;
            const total = angles.length * PLY_THICKNESS;
            const abd = abdMatrix(angles, PLY_THICKNESS);
            const [strain, curvature] = midplaneResponse(abd, PULL_LOAD);
            const aScale = Math.max(...abd.slice(0, 3).flatMap((row) =>
                row.slice(0, 3).map(Math.abs)));
            expectClose(abd, record.abd, { label: "abd" });
            expectClose(isCoupled(abd, total), record.isCoupled,
                        { label: "isCoupled" });
            // Strains and curvatures share one scale: curvature round-off of
            // a symmetric stack is far below the strains.
            expectClose([...strain, ...curvature],
                        [...record.strain, ...record.curvature],
                        { label: "response" });
            expectClose(shearValues(abd), record.shearValues,
                        { label: "shearValues", scale: aScale });
            expectClose(isBalanced(abd), record.isBalanced, { label: "isBalanced" });
            expectClose(couplingValues(abd, total), record.couplingValues,
                        { label: "couplingValues", scale: aScale * total });
            expectClose(plateShape(strain, curvature)[3], record.plateLabel,
                        { label: "plateLabel" });
            expectClose(mirrorPairs(angles.length), record.mirrorPairs,
                        { label: "mirrorPairs" });
            expectClose(plyLevels(angles.length), record.plyLevels,
                        { label: "plyLevels" });
            expectClose(inputRows(angles), record.inputRows, { label: "inputRows" });
        });
    });
}

/** Add one test per golden plate (full grids of the shape, views, and colors). */
function registerPlates(suite, plates) {
    for (const record of plates) {
        suite.test(`Plate "${record.shape[3]}" ${stackName(record.angles)}`, () => {
            const abd = abdMatrix(record.angles, PLY_THICKNESS);
            const shape = plateShape(...midplaneResponse(abd, PULL_LOAD));
            expectClose(shape, record.shape, { label: "shape", scale: 1 });
            for (const mode of VIEW_MODES) {
                const view = plateView(shape, mode);
                expectClose(view, record.views[mode],
                            { label: `view ${mode}`, scale: 1 });
                expectClose(plateColors(...view), record.colors[mode],
                            { label: `colors ${mode}`, scale: 1 });
            }
        });
    }
}

/** Add the tests of the angle and drawing helpers. */
function registerHelpers(suite, golden) {
    suite.test("Helper: reducedStiffness", () => {
        expectClose(reducedStiffness(MATERIAL), golden.reducedStiffness,
                    { label: "Q" });
    });
    suite.test("Helper: flatPlate", () => {
        expectClose(flatPlate(), golden.flatPlate, { label: "flatPlate", scale: 1 });
    });
    suite.test("Helper: strainTransform", () => {
        for (const [angle, matrix] of golden.strainTransform) {
            expectClose(strainTransform(angle), matrix,
                        { label: `T(${angle})`, scale: 2 });
        }
    });
    suite.test("Helper: fiberLines", () => {
        for (const [angle, segments] of golden.fiberLines) {
            expectClose(fiberLines(angle, golden.fiberBox), segments,
                        { label: `lines(${angle})`, scale: 1 });
        }
    });
    suite.test("Helper: formatAngle", () => {
        for (const [angle, text] of golden.formatAngle) {
            expectClose(formatAngle(angle), text, { label: `format(${angle})` });
        }
    });
    suite.test("Helper: normalizeAngle", () => {
        for (const [angle, value] of golden.normalizeAngle) {
            expectClose(normalizeAngle(angle), value, { label: `normalize(${angle})`,
                                                        scale: 300 });
        }
    });
    suite.test("Helper: sameDirection", () => {
        for (const [a, b, value] of golden.sameDirection) {
            expectClose(sameDirection(a, b), value, { label: `same(${a}, ${b})` });
        }
    });
    suite.test("Helper: smoothStep", () => {
        for (const [t, value] of golden.smoothStep) {
            expectClose(smoothStep(t), value, { label: `smoothStep(${t})`, scale: 1 });
        }
    });
}

export default Object.freeze({
    name: "Laminate symmetry",
    async register(suite) {
        registerChecks(suite);
        const response = await fetch(GOLDEN_URL);
        if (!response.ok) {
            throw new Error(`Cannot load ${GOLDEN_URL}: HTTP ${response.status}`);
        }
        const golden = await response.json();
        registerStacks(suite, golden.stacks);
        registerPlates(suite, golden.plates);
        registerHelpers(suite, golden);
    },
});
