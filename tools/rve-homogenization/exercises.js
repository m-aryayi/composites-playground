/** Exercises of the RVE lesson. Every answer comes from the model. */

import { FIBER_PRESETS, MATRIX_PRESETS, REFERENCE_METALS } from "./config.js";
import {
    allModels,
    cca,
    compositeDensity,
    isotropicFiber,
    ruleOfMixtures,
} from "./model.js";

const CCA = 2;
const STEEL = REFERENCE_METALS.find((metal) => metal.name === "Steel");
const STEEL_SPECIFIC = STEEL.e / STEEL.rho;        // E/ρ of steel
const SPECIFIC_FACTOR = 4;                          // the challenge target
const E2_TARGET = 20;                               // GPa
const E2_VF_LIMIT = 0.6;
const EPOXY = MATRIX_PRESETS.find((preset) => preset.name === "Epoxy");

/** Return the fiber object of a preset name. */
function fiberOf(name) {
    const [e1, e2, nu12, nu23, g12] = FIBER_PRESETS.find((p) => p.name === name).values;
    return { e1, e2, nu12, nu23, g12 };
}

/** Return the CCA properties of carbon/epoxy (or another matrix) at Vf. */
function carbonWith(matrixName, vf) {
    const [em, num] = MATRIX_PRESETS.find((p) => p.name === matrixName).values;
    return cca(fiberOf("Carbon (graphite)"), em, num, vf);
}

/** Return the fiber object and matrix constants of a stage state. */
function materialsOf(state) {
    const { e1, e2, nu12, nu23, g12, em, num, vf } = state;
    return { fiber: { e1, e2, nu12, nu23, g12 }, em, num, vf };
}

/** Return the ratio of two numbers as short text, for example "1.61". */
function ratioText(value) {
    return value.toFixed(2);
}

const KAW_GLASS = isotropicFiber(85.0, 0.20);      // Kaw
const [KAW_EM, KAW_NUM] = [3.4, 0.30];             // Kaw

export const EXERCISES = Object.freeze([
    {
        id: "predict-e2-double",
        type: "predict",
        prompt: "<p>Carbon/epoxy: the fiber volume fraction doubles, from 0.3 to 0.6. "
            + "What happens to \\(E_2\\), the stiffness across the fibers (CCA)?</p>",
        options: [
            { id: "less", label: "It grows, but less than 2 times" },
            { id: "double", label: "It doubles" },
            { id: "more", label: "It grows more than 2 times" },
        ],
        setup: { fiber: "Carbon (graphite)", matrix: "Epoxy", vf: 0.6, model: "cca" },
        answer: () => {
            const ratio = carbonWith("Epoxy", 0.6)[1] / carbonWith("Epoxy", 0.3)[1];
            if (Math.abs(ratio - 2) < 0.05) {
                return "double";
            }
            return ratio < 2 ? "less" : "more";
        },
        explain: () => {
            const e1 = carbonWith("Epoxy", 0.6)[0] / carbonWith("Epoxy", 0.3)[0];
            const e2 = carbonWith("Epoxy", 0.6)[1] / carbonWith("Epoxy", 0.3)[1];
            return `\\(E_2\\) grows ${ratioText(e2)} times, but \\(E_1\\) grows `
                + `${ratioText(e1)} times. Along the fibers, fiber and matrix stretch `
                + "together. Across them, the load must pass through the soft matrix.";
        },
    },
    {
        id: "predict-metal-matrix",
        type: "predict",
        prompt: "<p>Carbon fibers at \\(V_f = 0.6\\): the matrix changes from epoxy to "
            + "aluminum. Which property grows more?</p>",
        options: [
            { id: "e1", label: "E1, along the fibers" },
            { id: "e2", label: "E2, across the fibers" },
            { id: "same", label: "Both grow the same" },
        ],
        setup: { fiber: "Carbon (graphite)", matrix: "Aluminum", vf: 0.6,
                 model: "cca" },
        answer: () => {
            const epoxy = carbonWith("Epoxy", 0.6);
            const aluminum = carbonWith("Aluminum", 0.6);
            return aluminum[1] / epoxy[1] > aluminum[0] / epoxy[0] ? "e2" : "e1";
        },
        explain: () => {
            const epoxy = carbonWith("Epoxy", 0.6);
            const aluminum = carbonWith("Aluminum", 0.6);
            return `\\(E_1\\) grows ${ratioText(aluminum[0] / epoxy[0])} times and `
                + `\\(E_2\\) ${ratioText(aluminum[1] / epoxy[1])} times. `
                + "The fibers carry "
                + "\\(E_1\\), so a stiffer matrix adds little there. Across the fibers "
                + "the matrix is the weak link, so a stiffer matrix helps a lot.";
        },
    },
    {
        id: "predict-models",
        type: "predict",
        prompt: "<p>Carbon/epoxy at \\(V_f = 0.6\\). Which model gives the highest "
            + "\\(E_2\\)?</p>",
        options: [
            { id: "rom", label: "Rule of mixtures" },
            { id: "chamis", label: "Chamis" },
            { id: "cca", label: "Composite cylinders" },
            { id: "mt", label: "Mori-Tanaka" },
        ],
        setup: { fiber: "Carbon (graphite)", matrix: "Epoxy", vf: 0.6 },
        answer: (state) => {
            const { fiber, em, num, vf } = materialsOf(state);
            const e2s = allModels(fiber, em, num, vf).map((row) => row[1]);
            return ["rom", "chamis", "cca", "mt"][e2s.indexOf(Math.max(...e2s))];
        },
        explain: "Look at the row E2 in the table. The models differ by about 15 % "
            + "across the fibers, but they agree along them (row E1).",
    },
    {
        id: "numeric-rom-e1",
        type: "numeric",
        prompt: "<p>Glass/epoxy: \\(E_f = 85\\) GPa, "
            + "\\(E_m = 3.4\\) GPa, "
            + "\\(V_f = 0.70\\). Calculate \\(E_1\\) with the rule of mixtures.</p>",
        answer: ruleOfMixtures(KAW_GLASS, KAW_EM, KAW_NUM, 0.70)[0],
        unit: "GPa",
        solution: "<p>\\(E_1 = E_f V_f + E_m V_m = 85 \\cdot 0.70 + 3.4 \\cdot 0.30 "
            + "= 60.52\\) GPa. Kaw gives the same value.</p>",
    },
    {
        id: "numeric-density",
        type: "numeric",
        prompt: "<p>Glass (\\(\\rho_f = 2.5\\) g/cm³) and epoxy (\\(\\rho_m = 1.2\\) "
            + "g/cm³) at \\(V_f = 0.70\\). Calculate the composite density.</p>",
        answer: compositeDensity(2.5, 1.2, 0.70),
        unit: "g/cm³",
        solution: "<p>\\(\\rho_c = \\rho_f V_f + \\rho_m V_m = 2.5 \\cdot 0.70 + "
            + "1.2 \\cdot 0.30 = 2.11\\) g/cm³.</p>",
    },
    {
        id: "numeric-specific",
        type: "numeric",
        prompt: "<p>Carbon/epoxy at \\(V_f = 0.6\\) has \\(E_1 = 139.4\\) GPa (CCA). "
            + "The fiber has \\(\\rho_f = 1.80\\) g/cm³, the epoxy "
            + `\\(\\rho_m = ${EPOXY.rho.toFixed(2)}\\) g/cm³. Calculate the specific `
            + "stiffness \\(E_1/\\rho\\).</p>",
        answer: carbonWith("Epoxy", 0.6)[0] / compositeDensity(1.80, EPOXY.rho, 0.6),
        unit: "GPa per g/cm³",
        solution: "<p>\\(\\rho_c = 1.80 \\cdot 0.6 + 1.20 \\cdot 0.4 = 1.56\\) "
            + "g/cm³</p>"
            + "<p>\\(E_1/\\rho_c = 139.4 / 1.56 = 89.3\\) GPa per g/cm³: about "
            + `${(89.3 / STEEL_SPECIFIC).toFixed(1)} times the value of steel `
            + `(${STEEL_SPECIFIC.toFixed(1)}).</p>`,
    },
    {
        id: "choice-no-g23",
        type: "choice",
        prompt: "<p>Which model gives no \\(G_{23}\\) and no \\(\\nu_{23}\\)?</p>",
        options: [
            { label: "Rule of mixtures", correct: true,
              why: "It treats fiber and matrix as parallel or series springs. That "
                  + "gives E1, E2, G12, and ν12, but nothing in the 2-3 plane." },
            { label: "Chamis", correct: false,
              why: "Chamis gives G23 with the same √Vf form as G12." },
            { label: "Composite cylinders", correct: false,
              why: "The composite cylinders give G23 from the plane problem in the "
                  + "2-3 plane." },
        ],
    },
    {
        id: "choice-e1-agree",
        type: "choice",
        prompt: "<p>Why do all four models give almost the same \\(E_1\\)?</p>",
        options: [
            { label: "Along the fibers, fiber and matrix stretch together",
              correct: true,
              why: "They have the same strain, like parallel springs, so "
                  + "\\(E_1 \\approx E_f V_f + E_m V_m\\) in all models." },
            { label: "The matrix is very stiff", correct: false,
              why: "Epoxy (3.4 GPa) is about 70 times softer than carbon fiber." },
            { label: "The fibers touch each other", correct: false,
              why: "Even at Vf = 0.9 the fibers do not touch, and E1 still follows "
                  + "the rule of mixtures." },
        ],
    },
    {
        id: "challenge-specific",
        type: "challenge",
        prompt: "<p>With an <strong>epoxy</strong> matrix, make \\(E_1/\\rho\\) "
            + "at least "
            + `<strong>${SPECIFIC_FACTOR} times</strong> that of steel `
            + `(${(SPECIFIC_FACTOR * STEEL_SPECIFIC).toFixed(0)} GPa per g/cm³, `
            + "CCA).</p>",
        check: (state) => {
            const { fiber, em, num, vf } = materialsOf(state);
            const epoxy = em === EPOXY.values[0] && num === EPOXY.values[1];
            const rho = compositeDensity(state.rhoF, state.rhoM, vf);
            const specific = cca(fiber, em, num, vf)[0] / rho;
            return epoxy && specific >= SPECIFIC_FACTOR * STEEL_SPECIFIC;
        },
        hint: "<p>Use the bar chart with E/ρ. A light, stiff fiber and a high "
            + "\\(V_f\\) help.</p>",
        done: (state) => {
            const { fiber, em, num, vf } = materialsOf(state);
            const ratio = cca(fiber, em, num, vf)[0]
                / compositeDensity(state.rhoF, state.rhoM, vf) / STEEL_SPECIFIC;
            return `Along the fibers it is ${ratio.toFixed(1)} times as stiff as steel `
                + "for the same weight.";
        },
    },
    {
        id: "challenge-e2",
        type: "challenge",
        prompt: `<p>Make \\(E_2 \\geq ${E2_TARGET}\\) GPa (CCA) with `
            + `\\(V_f \\leq ${E2_VF_LIMIT}\\).</p>`,
        check: (state) => {
            const { fiber, em, num, vf } = materialsOf(state);
            return vf <= E2_VF_LIMIT && cca(fiber, em, num, vf)[1] >= E2_TARGET;
        },
        hint: "<p>Across the fibers, the matrix is the weak link. Look at the matrix "
            + "list.</p>",
        done: "A metal matrix makes the composite stiff across the fibers, too.",
    },
]);
