/** Stage of the RVE lesson: state, controls, block, table, and charts. */

import { createBarChart } from "../../assets/js/charts/bar-chart.js";
import { createLineChart } from "../../assets/js/charts/line-chart.js";
import { el, qs, qsa } from "../../assets/js/core/dom.js";
import { createStore } from "../../assets/js/core/store.js";
import {
    bindQuery,
    choiceField,
    numberField,
    readQuery,
    shareUrl,
} from "../../assets/js/core/url-state.js";
import {
    CUSTOM_NAME,
    DEFAULT_PRESETS,
    DEFAULT_VF,
    FIBER_KEYS,
    FIBER_PRESETS,
    INPUTS,
    MATRIX_PRESETS,
    MODEL_LONG_NAMES,
    MODEL_NAMES,
    PROPERTY_NAMES,
} from "./config.js";
import {
    allModels,
    barDensities,
    barText,
    barValues,
    fiberG23,
    inputNumber,
    inputValue,
    limitedE2,
    matchingPreset,
    modulusCurves,
    parseInput,
    propertyText,
    pyFixed,
    shearModulus,
} from "./model.js";
import { createBlockView } from "./view-block.js";

const MODEL_KEYS = Object.freeze(["rom", "chamis", "cca", "mt"]);
const BAR_VIEWS = Object.freeze(["specific", "modulus"]);
const FIBER_INPUTS = Object.freeze([...FIBER_KEYS, "rhoF"]);
const MATRIX_INPUTS = Object.freeze(["em", "num", "rhoM"]);
const NUMBER_KEYS = Object.freeze([...FIBER_INPUTS, ...MATRIX_INPUTS, "vf"]);
const CURVE_X_STEP = 0.3;
const CURVE_HEADROOM = 1.08;
const BAR_GROUPS = Object.freeze(["E1 along the fibers", "E2 = E3 across the fibers"]);
const BAR_Y_LABELS = Object.freeze({
    specific: "E/ρ (GPa per g/cm³)",
    modulus: "E (GPa)",
});
const COLORS = Object.freeze({
    fiber: "var(--fiber)", composite: "var(--ink)", matrix: "var(--matrix)",
    aluminum: "var(--metal-1)", steel: "var(--metal-2)",
});

/** Return the start values: the default fiber and matrix, and the default Vf. */
function defaultValues() {
    const fiber = FIBER_PRESETS.find((preset) => preset.name === DEFAULT_PRESETS[0]);
    const matrix = MATRIX_PRESETS.find((preset) => preset.name === DEFAULT_PRESETS[1]);
    const values = { vf: DEFAULT_VF };
    const fiberValues = [...fiber.values, fiber.rho];
    const matrixValues = [...matrix.values, matrix.rho];
    FIBER_INPUTS.forEach((key, i) => { values[key] = fiberValues[i]; });
    MATRIX_INPUTS.forEach((key, i) => { values[key] = matrixValues[i]; });
    return values;
}

const DEFAULTS = Object.freeze(defaultValues());
// The share link holds only the values that differ from the defaults.
const SCHEMA = Object.freeze({
    ...Object.fromEntries(NUMBER_KEYS.map((key) => [key,
        numberField(DEFAULTS[key], INPUTS[key].low, INPUTS[key].high)])),
    model: choiceField("cca", MODEL_KEYS),
    bars: choiceField("specific", BAR_VIEWS),
});

/** Return the values of a preset as a state change. */
function presetChange(presets, keys, name) {
    const preset = presets.find((item) => item.name === name);
    if (!preset) {
        return {};
    }
    const values = [...preset.values, preset.rho];
    return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
}

/**
 * Return a clean state change: known keys only, rounded as shown, in range,
 * E2 <= E1. "fiber" and "matrix" may name a preset.
 */
function cleanChange(change, state) {
    let clean = {};
    if (change.fiber) {
        const fiber = presetChange(FIBER_PRESETS, FIBER_INPUTS, change.fiber);
        clean = { ...clean, ...fiber };
    }
    if (change.matrix) {
        const matrix = presetChange(MATRIX_PRESETS, MATRIX_INPUTS, change.matrix);
        clean = { ...clean, ...matrix };
    }
    for (const key of NUMBER_KEYS) {
        const value = Number(change[key]);
        if (key in change && Number.isFinite(value)) {
            const { low, high } = INPUTS[key];
            clean[key] = inputValue(key, Math.min(Math.max(value, low), high));
        }
    }
    for (const [key, choices] of [["model", MODEL_KEYS], ["bars", BAR_VIEWS]]) {
        if (choices.includes(change[key])) {
            clean[key] = change[key];
        }
    }
    const e1 = clean.e1 ?? state.e1;
    clean.e2 = limitedE2(e1, clean.e2 ?? state.e2);
    return clean;
}

/** Return the fiber object, the matrix E and ν, and Vf of a state. */
function materialsOf(state) {
    const fiber = Object.fromEntries(FIBER_KEYS.map((key) => [key, state[key]]));
    return { fiber, em: state.em, num: state.num, vf: state.vf };
}

/** Return the preset name of the fiber or the matrix of a state, or "Custom". */
function presetName(presets, keys, state) {
    return matchingPreset(presets, keys.map((key) => state[key])) ?? CUSTOM_NAME;
}

/** Fill a select box with preset names and the custom choice. */
function fillSelect(select, presets) {
    select.replaceChildren(...presets.map((preset) =>
        el("option", { text: preset.name, attrs: { value: preset.name } })),
        el("option", { text: CUSTOM_NAME,
                       attrs: { value: CUSTOM_NAME, disabled: "" } }));
}

/** Return a neutral pill: a name and a value. */
function valuePill(name, value) {
    return el("span", { className: "pill" }, [`${name} = ${value}`]);
}

/**
 * Make the stage of the RVE page and return { store, apply, shareUrl }.
 *
 * apply(change) sets the state from a "Try it" button or an exercise, for
 * example { vf: 0.3 } or { matrix: "Aluminum" }.
 */
export function createStage(root = document) {
    const start = readQuery(SCHEMA);
    const store = createStore({ ...start, ...cleanChange(start, start) });
    bindQuery(store, SCHEMA);
    const apply = (change) => store.set(cleanChange(change, store.get()));

    const block = createBlockView(qs("#view-block", root));
    const curves = createLineChart(qs("#curves-chart", root), {
        xLabel: "Fiber volume fraction Vf", yLabel: "E (GPa)",
        xMax: INPUTS.vf.high, xStep: CURVE_X_STEP,
    });
    const bars = createBarChart(qs("#bars-chart", root), {
        groups: BAR_GROUPS,
        series: [
            { name: "Fiber", color: COLORS.fiber },
            { name: "Composite", color: COLORS.composite, strong: true },
            { name: "Matrix", color: COLORS.matrix },
            { name: "Aluminum", color: COLORS.aluminum },
            { name: "Steel", color: COLORS.steel },
        ],
    });

    // Material lists.
    const fiberSelect = qs("#fiber-select", root);
    const matrixSelect = qs("#matrix-select", root);
    fillSelect(fiberSelect, FIBER_PRESETS);
    fillSelect(matrixSelect, MATRIX_PRESETS);
    fiberSelect.addEventListener("change", () => apply({ fiber: fiberSelect.value }));
    matrixSelect.addEventListener("change", () => {
        apply({ matrix: matrixSelect.value });
    });

    // Sliders and number boxes: data-key on the range and on the number box.
    for (const range of qsa("input[type='range'][data-key]", root)) {
        const { key } = range.dataset;
        Object.assign(range, { min: INPUTS[key].low, max: INPUTS[key].high,
                               step: INPUTS[key].step });
        range.addEventListener("input", () => apply({ [key]: Number(range.value) }));
    }
    for (const box of qsa("input.input[data-key]", root)) {
        const { key } = box.dataset;
        box.addEventListener("change", () => {
            const value = parseInput(key, box.value);
            if (value !== null) {
                apply({ [key]: value });
            }
            box.value = inputNumber(key, store.get()[key]);
        });
    }
    // Switches: data-model and data-bars.
    for (const key of ["model", "bars"]) {
        for (const button of qsa(`[data-${key}]`, root)) {
            button.addEventListener("click", () => {
                apply({ [key]: button.dataset[key] });
            });
        }
    }

    /** Write the inputs: lists, sliders, number boxes, and the two shear moduli. */
    function showInputs(state) {
        fiberSelect.value = presetName(FIBER_PRESETS, FIBER_INPUTS, state);
        matrixSelect.value = presetName(MATRIX_PRESETS, MATRIX_INPUTS, state);
        for (const range of qsa("input[type='range'][data-key]", root)) {
            const { key } = range.dataset;
            range.value = state[key];
            const { low, high } = INPUTS[key];
            const fill = (100 * (state[key] - low)) / (high - low);
            range.style.setProperty("--fill", `${fill}%`);
        }
        for (const box of qsa("input.input[data-key]", root)) {
            if (box !== document.activeElement) {
                box.value = inputNumber(box.dataset.key, state[box.dataset.key]);
            }
        }
        const g23 = fiberG23(materialsOf(state).fiber);
        qs("#g23-value", root).textContent = pyFixed(g23, 1);
        const gm = shearModulus(state.em, state.num);
        qs("#gm-value", root).textContent = pyFixed(gm, 2);
    }

    /** Write the table of the four models; the selected column is marked. */
    function showTable(models, selected) {
        const corner = el("th", { text: "Property", attrs: { scope: "col" } });
        const head = el("tr", {}, [corner,
            ...MODEL_NAMES.map((name, m) => el("th", {
                text: name,
                className: m === selected ? "is-selected" : "",
                attrs: { scope: "col" },
            }))]);
        const rows = PROPERTY_NAMES.map((name, j) => el("tr", {}, [
            el("th", { text: name, attrs: { scope: "row" } }),
            ...models.map((row, m) => el("td", {
                text: propertyText(j, row[j]),
                className: m === selected ? "is-selected" : "",
            }))]));
        qs("#results-table", root).replaceChildren(el("thead", {}, [head]),
                                                   el("tbody", {}, rows));
    }

    /** Draw the E1 and E2 curves of the selected model, with markers at Vf. */
    function showCurves(state, props, selected) {
        const { fiber, em, num, vf } = materialsOf(state);
        const [vfs, e1s, e2s] = modulusCurves(selected, fiber, em, num);
        curves.update({
            yMax: CURVE_HEADROOM * Math.max(e1s.at(-1), e2s.at(-1)),
            description: `E1 and E2 against Vf, ${MODEL_LONG_NAMES[selected]} model.`,
            lines: [
                { label: "E1", color: "var(--ink)", dash: "",
                  values: vfs.map((v, i) => [v, e1s[i]]), marker: [vf, props[0]] },
                { label: "E2", color: "var(--ink)", dash: "6 4",
                  values: vfs.map((v, i) => [v, e2s[i]]), marker: [vf, props[1]] },
            ],
        });
    }

    /** Draw the bars: E or E/ρ of fiber, composite, matrix, and two metals. */
    function showBars(state, props) {
        const { fiber, em, vf } = materialsOf(state);
        let heights = barValues(fiber, em, props);
        if (state.bars === "specific") {
            const densities = barDensities(state.rhoF, state.rhoM, vf);
            heights = heights.map((row, s) => row.map((value) => value / densities[s]));
        }
        bars.update({
            values: heights,
            texts: heights.map((row) => row.map(barText)),
            yLabel: BAR_Y_LABELS[state.bars],
            description: `${BAR_Y_LABELS[state.bars]} of the fiber, the composite, `
                + "the matrix, aluminum, and steel.",
        });
    }

    /** Draw a state: block, status, table, charts, switches, and inputs. */
    function show(state) {
        const selected = MODEL_KEYS.indexOf(state.model);
        const { fiber, em, num, vf } = materialsOf(state);
        const models = allModels(fiber, em, num, vf);
        const props = models[selected];
        const rho = barDensities(state.rhoF, state.rhoM, vf)[1];
        block.update(vf);
        // The tool bar and the reading card show the same pills.
        for (const status of qsa("[data-status]", root)) {
            status.replaceChildren(
                valuePill("E1", `${pyFixed(props[0], 1)} GPa`),
                valuePill("E2", `${pyFixed(props[1], 2)} GPa`),
                valuePill("ρ", `${pyFixed(rho, 2)} g/cm³`));
        }
        qs("#say", root).textContent = `${MODEL_LONG_NAMES[selected]}: along `
            + `the fibers the composite is ${pyFixed(props[0] / em, 1)} × `
            + "as stiff as the matrix, "
            + `across them ${pyFixed(props[1] / em, 1)} ×.`;
        showTable(models, selected);
        showCurves(state, props, selected);
        showBars(state, props);
        for (const key of ["model", "bars"]) {
            for (const button of qsa(`[data-${key}]`, root)) {
                button.setAttribute("aria-checked",
                                    String(button.dataset[key] === state[key]));
            }
        }
        showInputs(state);
    }

    store.subscribe(show);
    show(store.get());
    return Object.freeze({
        store,
        apply,
        shareUrl: () => shareUrl(SCHEMA, store.get()),
    });
}
