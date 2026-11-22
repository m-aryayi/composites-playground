/** Tests of the RVE lesson: the original app checks and the golden values. */

import {
    FIBER_PRESETS,
    INPUTS,
    MATRIX_PRESETS,
} from "../tools/rve-homogenization/config.js";
import {
    blockFaces,
    blockSize,
    blockVf,
    fiberSections,
    fiberSpacing,
    hexCenters,
} from "../tools/rve-homogenization/geometry.js";
import {
    allModels,
    axialAndBulk,
    barDensities,
    barText,
    barValues,
    cca,
    compositeDensity,
    fiberBulkModulus,
    fiberG23,
    inputNumber,
    inputValue,
    isotropicFiber,
    limitedE2,
    modulusCurves,
    moriTanaka,
    parseInput,
    propertyText,
    ruleOfMixtures,
    shearModulus,
    stiffnessModuli,
} from "../tools/rve-homogenization/model.js";
import { expectClose, expectTrue } from "./runner.js";

const GOLDEN_URL = new URL("./golden/rve-homogenization.json", import.meta.url);
const DEFAULT_MODEL = 2;                  // CCA, the bar chart of the golden values
// The --check cases of the original app: glass/epoxy of Kaw T3.1 and T3.2 at
// Vf = 0.70, with the results of Kaw T3.5.
const KAW = Object.freeze({
    glass: [85.0, 0.20], epoxy: [3.4, 0.30], vf: 0.70,
    elasticity: [60.53, 15.51, 0.2238, 6.169],      // E1, E2, ν12, G12 (CCA)
    materials: [60.52, 0.2300, 4.014],              // E1, ν12, G12 (ROM)
    densities: [2.5, 1.2], compositeDensity: 2.110, // Kaw Example 3.1
});
const CHECK_TOLERANCE = 0.002;
const SAME_TOLERANCE = 1.0e-9;
const CHECK_VFS = [0.1, 0.5, 0.9];
const BLOCK_VF_TOLERANCE = 0.02;
const CHECK_MT_VF = 0.6;
const CARBON = FIBER_PRESETS.find((preset) => preset.name === "Carbon (graphite)");

/** Return a fiber object from a preset. */
function presetFiber(preset) {
    const [e1, e2, nu12, nu23, g12] = preset.values;
    return { e1, e2, nu12, nu23, g12 };
}

/** Return true if each value is close to its target (relative; NaN skipped). */
function closeTo(values, targets, tolerance) {
    return values.every((value, i) =>
        Number.isNaN(value) || Math.abs(value / targets[i] - 1.0) <= tolerance);
}

/** Add the 10 checks of the original app (its --check option). */
function registerChecks(suite) {
    const glass = isotropicFiber(...KAW.glass);
    const [em, num] = KAW.epoxy;
    suite.test("Check: CCA = Kaw Table 3.5 (E1, E2, ν12, G12)", () => {
        const [e1, e2, g12, , nu12] = cca(glass, em, num, KAW.vf);
        expectTrue(closeTo([e1, e2, nu12, g12], KAW.elasticity, CHECK_TOLERANCE),
                   `CCA: ${[e1, e2, nu12, g12]}`);
    });
    suite.test("Check: ROM = Kaw Table 3.5 (E1, ν12, G12)", () => {
        const [e1, , g12, , nu12] = ruleOfMixtures(glass, em, num, KAW.vf);
        expectTrue(closeTo([e1, nu12, g12], KAW.materials, CHECK_TOLERANCE),
                   `ROM: ${[e1, nu12, g12]}`);
    });
    suite.test("Check: composite density = Kaw Example 3.1", () => {
        const rho = compositeDensity(...KAW.densities, KAW.vf);
        expectTrue(closeTo([rho], [KAW.compositeDensity], SAME_TOLERANCE),
                   `ρ = ${rho}`);
    });
    const gm = shearModulus(em, num);
    const matrix = [em, em, gm, gm, num, num];
    suite.test("Check: Vf = 0, all four models give the matrix", () => {
        const rows = allModels(presetFiber(CARBON), em, num, 0.0);
        expectTrue(rows.every((row) => closeTo(row, matrix, SAME_TOLERANCE)),
                   JSON.stringify(rows));
    });
    suite.test("Check: fiber = matrix, all four models give that material", () => {
        const rows = allModels(isotropicFiber(em, num), em, num, 0.5);
        expectTrue(rows.every((row) => closeTo(row, matrix, SAME_TOLERANCE)),
                   JSON.stringify(rows));
    });
    suite.test("Check: fiber K23, G23 = the stiffness matrix (all fibers)", () => {
        expectTrue(FIBER_PRESETS.map(presetFiber).every((fiber) =>
            closeTo([fiberBulkModulus(fiber), fiberG23(fiber)], stiffnessModuli(fiber),
                    SAME_TOLERANCE)), "K23 or G23 differ");
    });
    suite.test("Check: Vf = 1, ROM, Chamis, and CCA give back the carbon fiber", () => {
        const fiber = presetFiber(CARBON);
        const values = [fiber.e1, fiber.e2, fiber.g12, fiberG23(fiber), fiber.nu12,
                        fiber.nu23];
        const rows = allModels(fiber, em, num, 1.0).slice(0, 3);
        expectTrue(rows.every((row) => closeTo(row, values, SAME_TOLERANCE)),
                   JSON.stringify(rows));
    });
    suite.test("Check: MT = CCA for E1, ν12, G12, K23 (Benveniste 1987)", () => {
        const fiber = presetFiber(CARBON);
        const mt = axialAndBulk(moriTanaka(fiber, em, num, CHECK_MT_VF));
        const cylinders = axialAndBulk(cca(fiber, em, num, CHECK_MT_VF));
        expectTrue(closeTo(mt, cylinders, SAME_TOLERANCE), `${mt} / ${cylinders}`);
    });
    suite.test("Check: the block Vf is near the asked Vf (0.1, 0.5, 0.9)", () => {
        const reached = CHECK_VFS.map(blockVf);
        expectTrue(reached.every((value, i) =>
            Math.abs(value - CHECK_VFS[i]) <= BLOCK_VF_TOLERANCE), `${reached}`);
    });
    suite.test("Check: the 9 materials fit the ranges, digits, E2 <= E1", () => {
        const fits = (keys, preset) => keys.every((key, i) => {
            const value = [...preset.values, preset.rho][i];
            const { low, high } = INPUTS[key];
            return low <= value && value <= high && inputValue(key, value) === value;
        });
        const fiberKeys = ["e1", "e2", "nu12", "nu23", "g12", "rhoF"];
        const misfits = [
            ...FIBER_PRESETS.filter((p) => !fits(fiberKeys, p)
                || limitedE2(p.values[0], p.values[1]) !== p.values[1]),
            ...MATRIX_PRESETS.filter((p) => !fits(["em", "num", "rhoM"], p)),
        ].map((p) => p.name);
        expectTrue(misfits.length === 0, `misfits: ${misfits}`);
    });
}

/** Add one test per golden material case. */
function registerCases(suite, cases) {
    cases.forEach((record, index) => {
        const { fiber, em, num, vf, rho } = record;
        suite.test(`Case ${index + 1}: E1 ${fiber.e1.toFixed(1)}, Em ${em.toFixed(1)}, `
                   + `Vf ${vf.toFixed(2)}`, () => {
            const models = allModels(fiber, em, num, vf);
            // Each property on its own scale: E is near 100 GPa, ν near 0.3.
            models.forEach((row, m) => row.forEach((value, j) => {
                expectClose(value, record.models[m][j],
                            { label: `models[${m}][${j}]` });
            }));
            expectClose(fiberG23(fiber), record.fiberG23, { label: "fiberG23" });
            expectClose(fiberBulkModulus(fiber), record.fiberBulkModulus,
                        { label: "fiberBulkModulus" });
            const bars = barValues(fiber, em, models[DEFAULT_MODEL]);
            expectClose(bars, record.barValues, { label: "barValues" });
            expectClose(barDensities(...rho, vf), record.barDensities,
                        { label: "barDensities" });
            expectClose(models[DEFAULT_MODEL].map((v, i) => propertyText(i, v)),
                        record.propertyText, { label: "propertyText" });
            expectClose(bars.map((row) => row.map(barText)), record.barText,
                        { label: "barText" });
            models.forEach((row, m) => {
                expectClose(axialAndBulk(row), record.axialAndBulk[m],
                            { label: `axialAndBulk[${m}]` });
            });
        });
    });
}

/** Add the tests of the curves, the geometry, and the input helpers. */
function registerOthers(suite, golden) {
    suite.test("Curves: E1 and E2 against Vf, all presets and models", () => {
        for (const { fiber, em, num, curves } of golden.curves) {
            curves.forEach((expected, model) => {
                expectClose(modulusCurves(model, fiber, em, num), expected,
                            { label: `curves model ${model}` });
            });
        }
    });
    const { geometry } = golden;
    suite.test("Geometry: block size, fiber spacing, centers, block Vf", () => {
        expectClose(blockSize(), geometry.blockSize, { label: "blockSize" });
        for (const { vf, spacing, centers, blockVf: reached } of geometry.grid) {
            expectClose(fiberSpacing(vf), spacing, { label: `spacing(${vf})` });
            expectClose(hexCenters(vf), centers, { label: `centers(${vf})` });
            expectClose(blockVf(vf), reached, { label: `blockVf(${vf})` });
        }
    });
    suite.test("Geometry: fiber sections clipped to the block", () => {
        for (const [vf, sections] of Object.entries(geometry.sections)) {
            expectClose(fiberSections(Number(vf)), sections,
                        { label: `sections(${vf})` });
        }
    });
    suite.test("Geometry: the six block faces", () => {
        for (const [vf, faces] of Object.entries(geometry.faces)) {
            blockFaces(Number(vf)).forEach((face, i) => {
                const expected = faces[i];
                const label = `face ${i} (vf ${vf})`;
                expectClose([face.axis, face.side], [expected.axis, expected.side],
                            { label });
                expectClose(face.rectangle, expected.rectangle, { label });
                expectClose(face.parts.length, expected.partCount, { label });
                if (expected.parts !== null) {
                    expectClose(face.parts, expected.parts, { label });
                }
            });
        }
    });
    const { inputs } = golden;
    suite.test("Inputs: parseInput, inputNumber, inputValue", () => {
        for (const [key, text, value] of inputs.parseInput) {
            expectClose(parseInput(key, text), value,
                        { label: `parse(${key}, "${text}")` });
        }
        for (const [key, value, text] of inputs.inputNumber) {
            expectClose(inputNumber(key, value), text,
                        { label: `number(${key}, ${value})` });
        }
        for (const [key, value, rounded] of inputs.inputValue) {
            expectClose(inputValue(key, value), rounded,
                        { label: `value(${key}, ${value})` });
        }
    });
    suite.test("Fiber: K23 and G23 from the 6 x 6 stiffness matrix", () => {
        for (const [fiber, moduli] of inputs.stiffnessModuli) {
            expectClose(stiffnessModuli(fiber), moduli, { label: "stiffnessModuli" });
        }
    });
}

export default Object.freeze({
    name: "RVE homogenization",
    async register(suite) {
        registerChecks(suite);
        const response = await fetch(GOLDEN_URL);
        if (!response.ok) {
            throw new Error(`Cannot load ${GOLDEN_URL}: HTTP ${response.status}`);
        }
        const golden = await response.json();
        registerCases(suite, golden.cases);
        registerOthers(suite, golden);
    },
});
