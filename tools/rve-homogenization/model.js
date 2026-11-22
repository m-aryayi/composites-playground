/**
 * RVE homogenization: fiber and matrix constants, four models, bars, inputs.
 *
 * A port of python/rve_homogenization.py: the same functions, in the same
 * order of operations, with camelCase names. Pure functions only. All moduli
 * in GPa. A fiber is { e1, e2, nu12, nu23, g12 } (axis 1 along the fiber).
 */

import { solve } from "../../assets/js/core/linalg.js";
import {
    BAR_WHOLE_FROM,
    DENSITY_KEYS,
    DIGITS,
    INPUTS,
    MODULUS_KEYS,
    MODULUS_UNIT,
    DENSITY_UNIT,
    POISSON_KEYS,
    REFERENCE_METALS,
    VF_POINTS,
} from "./config.js";

// ---------------------------------------------------------------- helpers

/** Return num evenly spaced values from start to stop, as numpy.linspace. */
export function linspace(start, stop, num) {
    const step = (stop - start) / (num - 1);
    const values = Array.from({ length: num }, (_, i) => i * step + start);
    values[num - 1] = stop;
    return values;
}

/**
 * Return value as text with `digits` decimals, rounded as Python does.
 *
 * JavaScript toFixed rounds an exact tie up (0.125 -> "0.13"); Python rounds
 * it to the even digit ("0.12"). Other values give the same text.
 */
export function pyFixed(value, digits) {
    const exact = Math.abs(value).toFixed(100);
    const point = exact.indexOf(".");
    const rest = exact.slice(point + 1 + digits);
    if (/^50*$/.test(rest)) {
        const kept = exact.slice(0, point + 1 + digits).replace(".", "");
        const last = Number(kept.at(-1));
        const scaled = BigInt(kept) + (last % 2 === 1 ? 1n : 0n);
        const text = scaled.toString().padStart(digits + 1, "0");
        const whole = digits > 0 ? `${text.slice(0, -digits)}.${text.slice(-digits)}`
                                 : text;
        return `${value < 0 || Object.is(value, -0) ? "-" : ""}${whole}`;
    }
    return value.toFixed(digits);
}

/** Return value rounded to `digits` decimals, as Python round(value, digits). */
export function pyRound(value, digits) {
    return Number(pyFixed(value, digits));
}

// --------------------------------------------- material constants (GPa)

/** Return the shear modulus of an isotropic material. */
export function shearModulus(e, nu) {
    return e / (2.0 * (1.0 + nu));
}

/** Return the plane-strain bulk modulus of an isotropic material. */
export function planeBulkModulus(e, nu) {
    return e / (2.0 * (1.0 - 2.0 * nu) * (1.0 + nu));
}

/** Return the fiber constants of an isotropic material. */
export function isotropicFiber(e, nu) {
    return { e1: e, e2: e, nu12: nu, nu23: nu, g12: shearModulus(e, nu) };
}

/** Return the transverse shear modulus G23 = E2 / (2 (1 + ν23)). */
export function fiberG23(fiber) {
    return shearModulus(fiber.e2, fiber.nu23);
}

/** Return the fiber plane-strain bulk modulus K23 (Chawla T10.1). */
export function fiberBulkModulus(fiber) {
    return fiber.e2 / (2.0 * (1.0 - fiber.nu23
                              - 2.0 * fiber.nu12 ** 2 * fiber.e2 / fiber.e1));
}

/** Return the 6 x 6 fiber stiffness in the order 11, 22, 33, 23, 13, 12. */
export function stiffnessMatrix(fiber) {
    const compliance = Array.from({ length: 6 }, () => new Array(6).fill(0));
    compliance[0][0] = 1.0 / fiber.e1;
    compliance[1][1] = compliance[2][2] = 1.0 / fiber.e2;
    compliance[0][1] = compliance[0][2] = -fiber.nu12 / fiber.e1;
    compliance[1][0] = compliance[2][0] = -fiber.nu12 / fiber.e1;
    compliance[1][2] = compliance[2][1] = -fiber.nu23 / fiber.e2;
    compliance[3][3] = 1.0 / fiberG23(fiber);
    compliance[4][4] = compliance[5][5] = 1.0 / fiber.g12;
    // The inverse, column by column.
    const columns = compliance.map((_, j) =>
        solve(compliance, compliance.map((__, i) => (i === j ? 1 : 0))));
    return compliance.map((_, i) => columns.map((column) => column[i]));
}

/** Return [K23, G23] from the stiffness matrix (Chawla T10.1). */
export function stiffnessModuli(fiber) {
    const c = stiffnessMatrix(fiber);
    return [(c[1][1] + c[1][2]) / 2.0, (c[1][1] - c[1][2]) / 2.0];
}

/** Return K23 from E1, E2, ν12, and G23 of a transversely isotropic material. */
export function bulkFromConstants(e1, e2, nu12, g23) {
    return e2 * g23 / (4.0 * g23 - e2 - 4.0 * e2 * g23 * nu12 ** 2 / e1);
}

// --------------------------- homogenization models: [E1, E2, G12, G23, ν12, ν23]

/** Return the properties by the rule of mixtures (Kaw Eqs. 3.55-3.59; E2: Jacquet). */
export function ruleOfMixtures(fiber, em, num, vf) {
    const vm = 1.0 - vf;
    const gm = shearModulus(em, num);
    const root = Math.sqrt(vf);
    const e1 = vf * fiber.e1 + vm * em;
    const e2 = 1.0 / (root / (fiber.e2 * root + em * (1.0 - root)) + (1.0 - root) / em);
    const g12 = fiber.g12 * gm / (gm * vf + fiber.g12 * vm);
    const nu12 = vf * fiber.nu12 + vm * num;
    return [e1, e2, g12, Number.NaN, nu12, Number.NaN];
}

/** Return the properties by Chamis (1983), Chawla T10.2. */
export function chamis(fiber, em, num, vf) {
    const vm = 1.0 - vf;
    const gm = shearModulus(em, num);
    const root = Math.sqrt(vf);
    const e1 = vf * fiber.e1 + vm * em;
    const e2 = em / (1.0 - root * (1.0 - em / fiber.e2));
    const g12 = gm / (1.0 - root * (1.0 - gm / fiber.g12));
    const g23 = gm / (1.0 - root * (1.0 - gm / fiberG23(fiber)));
    const nu12 = vf * fiber.nu12 + vm * num;
    const nu23 = e2 / (2.0 * g23) - 1.0;
    return [e1, e2, g12, g23, nu12, nu23];
}

/** Return the properties by the composite cylinders (Hashin and Rosen; Christensen). */
export function cca(fiber, em, num, vf) {
    const vm = 1.0 - vf;
    const gm = shearModulus(em, num);
    const [gf12, gf23, nuf] = [fiber.g12, fiberG23(fiber), fiber.nu12];
    const [kf, km] = [fiberBulkModulus(fiber), planeBulkModulus(em, num)];
    const mix = vf / km + 1.0 / gm + vm / kf;
    const e1 = vf * fiber.e1 + vm * em + 4.0 * vf * vm * (nuf - num) ** 2 / mix;
    const nu12 = vf * nuf + vm * num
        + vf * vm * (nuf - num) * (1.0 / km - 1.0 / kf) / mix;
    const g12 = gm * (gf12 * (1.0 + vf) + gm * vm) / (gf12 * vm + gm * (1.0 + vf));
    // G23: each phase is an isotropic plane with K23 and G23 (Christensen).
    const [etaM, etaF, mu] = [3.0 - 4.0 * num, 1.0 + 2.0 * gf23 / kf, gf23 / gm];
    const common = 3.0 * vf * vm ** 2 * (mu - 1.0) * (mu + etaF);
    const cube = (mu * etaM - etaF) * vf ** 3;
    const a = (common + (mu * etaM + etaF * etaM - cube)
               * (etaM * vf * (mu - 1.0) - (mu * etaM + 1.0)));
    const b = (-common + 0.5 * (mu * etaM + 1.0 + (mu - 1.0) * vf)
               * ((etaM - 1.0) * (mu + etaF) - 2.0 * cube)
               + 0.5 * (etaM + 1.0) * vf * (mu - 1.0) * (mu + etaF + cube));
    const c = common + (mu * etaM + (mu - 1.0) * vf + 1.0) * (mu + etaF + cube);
    const g23 = gm * (-b - Math.sqrt(b ** 2 - a * c)) / a;
    const k23 = ((km * (kf + gm) * vm + kf * (km + gm) * vf)
                 / ((kf + gm) * vm + (km + gm) * vf));
    const m = 1.0 + 4.0 * k23 * nu12 ** 2 / e1;
    const nu23 = (k23 - m * g23) / (k23 + m * g23);
    const e2 = 2.0 * (1.0 + nu23) * g23;
    return [e1, e2, g12, g23, nu12, nu23];
}

/** Return the properties by Mori-Tanaka, Abaimov (2016). */
export function moriTanaka(fiber, em, num, vf) {
    const vm = 1.0 - vf;
    const { e1: ef1, e2: ef2, nu12: nuf12, nu23: nuf23, g12: gf12 } = fiber;
    const z1 = 1.0 / (-2.0 * vm * nuf12 ** 2 / ef1 + vm * (1.0 - nuf23) / ef2
                      + (1.0 + num) * (1.0 + vf * (1.0 - 2.0 * num)) / em);
    const z2 = ef2 * (3.0 + vf - 4.0 * num) * (1.0 + num) + vm * em * (1.0 + nuf23);
    const e1 = vf * ef1 + vm * em + 2.0 * vf * vm * z1 * (nuf12 - num) ** 2;
    const e2 = e1 / ((1.0 - num ** 2) * (
        1.0 / (1.0 - num ** 2)
        + 2.0 * vf * e1 * (1.0 + nuf23 - ef2 * (1.0 + num) / em) / z2
        + vf * z1 * ef1 * ((1.0 + num) / em - 2.0 / ef1 + (1.0 - nuf23) / ef2)
        / em));
    const nu12 = num + 2.0 * vf * z1 * (nuf12 - num) * (1.0 - num ** 2) / em;
    const inner = 1.0 - 2.0 * z1 * (vf * ef1 * (1.0 - num ** 2)
                                    + vm * em * (1.0 - nuf12 ** 2)) / (ef1 * em);
    const nu23 = 1.0 - e2 * (2.0 + 2.0 * vf * ef1 * (1.0 - num ** 2) / (vm * em) * inner
                             - e1 * (1.0 + num) / em) / e1;
    const g12 = (em * (1.0 + vf - 4.0 * vf
                       / (1.0 + vf + 2.0 * vm * gf12 * (1.0 + num) / em))
                 / (2.0 * vm * (1.0 + num)));
    // The same as vf / (vm / (8 (1 - νm²)) + 1 / d), without 1/0 when Gf = Gm.
    const d = em / fiberG23(fiber) - 2.0 * (1.0 + num);
    const g23 = em / (2.0 * (1.0 + num)
                      + vf * d / (1.0 + vm * d / (8.0 * (1.0 - num ** 2))));
    return [e1, e2, g12, g23, nu12, nu23];
}

export const MODELS = Object.freeze([ruleOfMixtures, chamis, cca, moriTanaka]);

/** Return 4 rows (ROM, Chamis, CCA, MT) of 6 properties. */
export function allModels(fiber, em, num, vf) {
    return MODELS.map((model) => model(fiber, em, num, vf));
}

/** Return [vfs, e1s, e2s]: Vf from 0 to the slider maximum, and E1, E2 at each. */
export function modulusCurves(model, fiber, em, num) {
    const vfs = linspace(0.0, INPUTS.vf.high, VF_POINTS);
    const props = vfs.map((vf) => MODELS[model](fiber, em, num, vf));
    return [vfs, props.map((row) => row[0]), props.map((row) => row[1])];
}

/** Return the bar heights: rows fiber, composite, matrix, metals; columns E1, E2. */
export function barValues(fiber, em, props) {
    return [[fiber.e1, fiber.e2], [props[0], props[1]], [em, em],
            ...REFERENCE_METALS.map((metal) => [metal.e, metal.e])];
}

/** Return the composite density ρf Vf + ρm Vm (Kaw Eq. 3.8). */
export function compositeDensity(rhoF, rhoM, vf) {
    return rhoF * vf + rhoM * (1.0 - vf);
}

/** Return the densities in the bar order: fiber, composite, matrix, metals. */
export function barDensities(rhoF, rhoM, vf) {
    return [rhoF, compositeDensity(rhoF, rhoM, vf), rhoM,
            ...REFERENCE_METALS.map((metal) => metal.rho)];
}

/** Return [E1, ν12, G12, K23] of one model result. */
export function axialAndBulk(props) {
    const [e1, e2, g12, g23, nu12] = props;
    return [e1, nu12, g12, bulkFromConstants(e1, e2, nu12, g23)];
}

// ------------------------------------------------- inputs and material lists

/** Return E2, no larger than E1: then the fiber constants stay valid. */
export function limitedE2(e1, e2) {
    return Math.min(e1, e2);
}

/** Return the number of decimals of an input key. */
export function inputDigits(key) {
    if (MODULUS_KEYS.includes(key)) {
        return DIGITS.modulus;
    }
    if (POISSON_KEYS.includes(key)) {
        return DIGITS.poisson;
    }
    return DENSITY_KEYS.includes(key) ? DIGITS.density : DIGITS.vf;
}

/** Return the unit of an input key: GPa, g/cm³, or "". */
export function inputUnit(key) {
    if (MODULUS_KEYS.includes(key)) {
        return MODULUS_UNIT;
    }
    return DENSITY_KEYS.includes(key) ? DENSITY_UNIT : "";
}

/** Return an input rounded as it is shown, for all the calculations. */
export function inputValue(key, value) {
    return pyRound(value, inputDigits(key));
}

/** Return an input as text, rounded as shown; a ν with a third decimal 0 shows 2. */
export function inputNumber(key, value) {
    let text = pyFixed(value, inputDigits(key));
    if (POISSON_KEYS.includes(key) && text.endsWith("0")) {
        text = text.slice(0, -1);
    }
    return text;
}

/** Return a typed input, rounded and in its range; null if it is no number. */
export function parseInput(key, text) {
    let cleaned = text;
    const unit = inputUnit(key);
    if (unit) {
        cleaned = cleaned.replaceAll(unit, "");
    }
    cleaned = cleaned.replaceAll(",", ".").trim();
    // Python float() accepts these texts; JavaScript Number() needs help.
    const value = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)
        ? Number(cleaned) : Number.NaN;
    if (!Number.isFinite(value)) {
        return null;
    }
    const { low, high } = INPUTS[key];
    return inputValue(key, Math.min(Math.max(value, low), high));
}

/** Return the values of a named material, or null (custom). */
export function presetValues(presets, name) {
    const preset = presets.find((item) => item.name === name);
    return preset ? [...preset.values, preset.rho] : null;
}

/** Return the name of the material with these values, or null (custom). */
export function matchingPreset(presets, values) {
    const preset = presets.find((item) =>
        [...item.values, item.rho].every((value, i) => value === values[i]));
    return preset ? preset.name : null;
}

/** Return one table value: moduli with 2 decimals, ν with 3, NaN as "–". */
export function propertyText(index, value) {
    if (Number.isNaN(value)) {
        return "–";
    }
    return index < 4 ? pyFixed(value, 2) : pyFixed(value, 3);
}

/** Return one bar value: no decimals from 100, 1 below, NaN as "–". */
export function barText(value) {
    if (Number.isNaN(value)) {
        return "–";
    }
    return value >= BAR_WHOLE_FROM ? pyFixed(value, 0) : pyFixed(value, 1);
}
