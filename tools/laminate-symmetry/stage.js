/** Stage of the laminate lesson: state, controls, both views, status, numbers. */

import { el, icon, qs, qsa } from "../../assets/js/core/dom.js";
import { createStore } from "../../assets/js/core/store.js";
import { showToast } from "../../assets/js/core/toast.js";
import {
    bindQuery,
    choiceField,
    numberField,
    numberListField,
    readQuery,
    shareUrl,
} from "../../assets/js/core/url-state.js";
import {
    ANGLE_STEP,
    DEFAULT_ANGLES,
    DEFAULT_MODE,
    MAX_PLIES,
    PLY_THICKNESS,
    TEXTS,
    VIEW_MODES,
} from "./config.js";
import {
    abdMatrix,
    couplingValues,
    inputRows,
    isBalanced,
    isCoupled,
    normalizeAngle,
    shearValues,
} from "./model.js";
import { createPlateView } from "./view-plate.js";
import { createStackView } from "./view-stack.js";

const SHOW_CHOICES = VIEW_MODES.map((mode) => mode.toLowerCase());
// The share link: ?plies=0,45,90&ply=2&show=both (ply counts from 1).
const SCHEMA = Object.freeze({
    plies: numberListField([...DEFAULT_ANGLES], MAX_PLIES),
    ply: numberField(1, 1, MAX_PLIES),
    show: choiceField(DEFAULT_MODE.toLowerCase(), SHOW_CHOICES),
});

/** Return a ply angle for the screen: a true minus sign instead of "-". */
function angleText(angle) {
    return `${String(angle).replace("-", "−")}°`;
}

/** Return the number in a typed angle ("−45°", "30,5"), or NaN. */
function parseAngle(text) {
    const cleaned = text.replace("−", "-").replace("°", "").replace(",", ".").trim();
    return cleaned === "" ? Number.NaN : Number(cleaned);
}

/**
 * Return a clean state change: angles in [-90, 90], at most MAX_PLIES,
 * a ply number inside the stack, and a known view mode.
 */
function cleanChange(change, state) {
    const clean = {};
    if (Array.isArray(change.plies) && change.plies.length > 0) {
        clean.plies = change.plies.slice(0, MAX_PLIES)
            .map((angle) => normalizeAngle(Number(angle)));
    }
    const plies = clean.plies ?? state.plies;
    const ply = change.ply ?? (clean.plies ? 1 : state.ply);
    clean.ply = Math.min(Math.max(Math.round(Number(ply)) || 1, 1), plies.length);
    if (SHOW_CHOICES.includes(change.show)) {
        clean.show = change.show;
    }
    return clean;
}

/** Return the view mode name ("Both") of a share-link value ("both"). */
function modeOf(show) {
    return VIEW_MODES[SHOW_CHOICES.indexOf(show)];
}

/** Return a status pill: icon + word + color. */
function statusPill(yes, text) {
    return el("span", { className: `pill ${yes ? "pill--yes" : "pill--no"}` },
              [icon(yes ? "check" : "cross"), text]);
}

/** Return a matrix table; zero and non-zero cells look different. */
function matrixTable(rows, label) {
    const table = el("table", { attrs: { "aria-label": label } });
    for (const row of rows) {
        const cells = row.map((value) => el("td", {
            className: value === 0 ? "is-zero" : "is-nonzero",
            text: value.toFixed(0),
        }));
        table.append(el("tr", {}, cells));
    }
    return el("div", { className: "matrix" }, [table]);
}

/** Return a result line with an icon: yes (✓) or no (✕). */
function resultLine(yes, text) {
    return el("p", { className: `numbers-result ${yes ? "is-yes" : "is-no"}` },
              [icon(yes ? "check" : "cross"), text]);
}

/**
 * Make the stage of the lesson page and return { store, apply, shareUrl }.
 *
 * apply(change) sets the state from a "Try it" button or an exercise,
 * for example { plies: [0, 90] }. shareUrl() returns the link of the state.
 */
export function createStage(root = document) {
    const start = readQuery(SCHEMA);
    const store = createStore({ ...start, ...cleanChange(start, start) });
    bindQuery(store, SCHEMA);
    const apply = (change) => store.set(cleanChange(change, store.get()));

    /** Set the angle of ply k (0-based) and select it. */
    function setAngle(k, angle) {
        const plies = [...store.get().plies];
        plies[k] = normalizeAngle(angle);
        store.set({ plies, ply: k + 1 });
    }

    /** Turn ply k by step x 15 degrees. */
    function turn(k, step) {
        setAngle(k, store.get().plies[k] + step * ANGLE_STEP);
    }

    const stack = createStackView(qs("#view-stack", root), {
        onSelect: (k) => store.set({ ply: k + 1 }),
        onTurn: turn,
    });
    const plate = createPlateView(qs("#view-plate", root));
    let plateLabel = "";

    // Controls.
    const input = qs("#angle-input", root);
    const turnSelected = (step) => turn(store.get().ply - 1, step);
    qs("#angle-down", root).addEventListener("click", () => turnSelected(-1));
    qs("#angle-up", root).addEventListener("click", () => turnSelected(1));
    input.addEventListener("change", () => {
        const angle = parseAngle(input.value);
        if (Number.isFinite(angle)) {
            setAngle(store.get().ply - 1, angle);
        } else {
            showToast(TEXTS.notNumber(input.value), { iconName: "info" });
        }
        input.value = String(store.get().plies[store.get().ply - 1]);
    });
    qs("#add-ply", root).addEventListener("click", () => {
        const { plies, ply } = store.get();
        if (plies.length >= MAX_PLIES) {
            showToast(TEXTS.maxPly, { iconName: "info" });
            return;
        }
        store.set({ plies: [...plies, plies[ply - 1]], ply: plies.length + 1 });
    });
    qs("#delete-ply", root).addEventListener("click", () => {
        const { plies, ply } = store.get();
        if (plies.length <= 1) {
            showToast(TEXTS.minPly, { iconName: "info" });
            return;
        }
        const next = plies.filter((_, k) => k !== ply - 1);
        store.set({ plies: next, ply: Math.min(ply, next.length) });
    });
    qs("#mirror", root).addEventListener("click", () => {
        const { plies } = store.get();
        if (2 * plies.length > MAX_PLIES) {
            showToast(TEXTS.mirrorLimit(2 * plies.length), { iconName: "info" });
            return;
        }
        store.set({ plies: [...plies, ...[...plies].reverse()] });
    });
    for (const button of qsa("#modes button", root)) {
        button.addEventListener("click", () => {
            store.set({ show: button.dataset.show });
        });
    }
    // Narrow stage: one view at a time.
    for (const button of qsa("#view-switch button", root)) {
        button.addEventListener("click", () => {
            for (const other of qsa("#view-switch button", root)) {
                other.setAttribute("aria-checked", String(other === button));
            }
            const chosen = button.dataset.view;
            for (const view of qsa(".stage__view", root)) {
                view.classList.toggle("is-shown", view.dataset.view === chosen);
            }
        });
    }

    /** Draw the numbers panel: [B], A16 and A26, and the inputs. */
    function showNumbers(plies, abd, coupled, balanced) {
        const total = plies.length * PLY_THICKNESS;
        qs("#b-matrix", root).replaceChildren(
            matrixTable(couplingValues(abd, total), "[B] in N"),
            resultLine(!coupled, coupled ? TEXTS.bNonZeroResult : TEXTS.bZeroResult));
        qs("#a-matrix", root).replaceChildren(
            matrixTable([shearValues(abd)], "A16 and A26 in N per mm"),
            resultLine(balanced, balanced ? TEXTS.aZeroResult : TEXTS.aNonZeroResult));
        const rows = inputRows(plies).flatMap(([name, value]) =>
            [el("dt", { text: name }), el("dd", { text: value })]);
        qs("#inputs", root).replaceChildren(...rows);
    }

    /** Draw a state: views, status, stepper, switch, and numbers. */
    function show(state, previous) {
        const angles = state.plies;
        const k = state.ply - 1;
        stack.update({ angles, selected: k });
        const shapeChanged = !previous || previous.plies !== state.plies
            || previous.show !== state.show;
        if (shapeChanged) {
            plateLabel = plate.update({ angles, mode: modeOf(state.show) },
                                      { animate: previous !== null });
        }
        const abd = abdMatrix(angles, PLY_THICKNESS);
        const coupled = isCoupled(abd, angles.length * PLY_THICKNESS);
        const balanced = isBalanced(abd);
        qs("#status", root).replaceChildren(
            statusPill(!coupled, coupled ? TEXTS.notSymmetric : TEXTS.symmetric),
            statusPill(balanced, balanced ? TEXTS.balanced : TEXTS.notBalanced));
        qs("#say", root).textContent = `Pulled, it ${plateLabel}.  `
            + `${coupled ? TEXTS.bNonZero : TEXTS.bZero}  ·  `
            + `${balanced ? TEXTS.aZero : TEXTS.aNonZero}`;
        input.value = String(angles[k]);
        qs("#angle-label", root).textContent = `Ply ${state.ply} of ${angles.length}`;
        input.setAttribute("aria-label", `Angle of ply ${state.ply} in degrees, `
                                         + `now ${angleText(angles[k])}`);
        for (const button of qsa("#modes button", root)) {
            const active = button.dataset.show === state.show;
            button.setAttribute("aria-checked", String(active));
        }
        showNumbers(angles, abd, coupled, balanced);
    }

    store.subscribe(show);
    show(store.get(), null);
    return Object.freeze({
        store,
        apply,
        shareUrl: () => shareUrl(SCHEMA, store.get()),
    });
}
