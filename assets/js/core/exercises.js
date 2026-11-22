/** Exercise engine: draw and check the 4 exercise types of a lesson. */

import { el, icon } from "./dom.js";
import { renderMath } from "./math-render.js";

const DEFAULT_TOLERANCE = 0.01;     // relative, 1 %
const ANSWER_DIGITS = 4;            // significant digits of a shown answer
const NUMBER_PATTERN = /[-+−]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?/;
const TYPE_NAMES = Object.freeze({
    predict: "Predict",
    numeric: "Numeric answer",
    choice: "Multiple choice",
    challenge: "Challenge",
});

/** Return the first number in a text ("0,75 GPa" gives 0.75), or NaN. */
export function parseNumber(text) {
    const match = NUMBER_PATTERN.exec(text);
    if (!match) {
        return Number.NaN;
    }
    return Number(match[0].replace(",", ".").replace("−", "-"));
}

/** Return true if value is within a relative tolerance of answer. */
export function isClose(value, answer, tolerance = DEFAULT_TOLERANCE) {
    if (answer === 0) {
        return Math.abs(value) <= tolerance;
    }
    return Math.abs(value / answer - 1) <= tolerance;
}

/** Return a number as short text with a few significant digits. */
function numberText(value) {
    return String(Number(value.toPrecision(ANSWER_DIGITS)));
}

/** Return the value of a field that is a constant or a function of the state. */
function resolve(field, state) {
    return typeof field === "function" ? field(state) : field;
}

/** Return an element whose content is trusted lesson HTML (with LaTeX). */
function html(tag, className, content) {
    const node = el(tag, { className });
    node.innerHTML = content;
    return node;
}

/** Return a button. */
function button(text, className = "btn", iconName = null) {
    const children = iconName ? [icon(iconName), text] : [text];
    return el("button", { className, attrs: { type: "button" } }, children);
}

/** Show feedback: kind is "right", "wrong", or "neutral". */
function showFeedback(feedback, kind, content) {
    const words = { right: "Right.", wrong: "Not quite.", neutral: "" };
    const icons = { right: "check", wrong: "cross", neutral: "info" };
    const lead = words[kind] ? `<strong>${words[kind]}</strong> ` : "";
    const text = html("div", "", `${lead}${content}`);
    const box = el("div", { className: `exercise__feedback is-${kind}` },
                   [icon(icons[kind]), text]);
    feedback.replaceChildren(box);
    renderMath(box);
}

/** Return a fieldset of radio options; each option label is lesson HTML. */
function optionGroup(name, options) {
    const legend = el("legend", { className: "visually-hidden", text: "Your answer" });
    const labels = options.map((option, index) => {
        const attrs = { type: "radio", name, value: String(index) };
        const input = el("input", { attrs });
        const mark = el("span", { className: "option__mark" });
        return el("label", { className: "option" },
                  [input, html("span", "option__text", option.label), mark]);
    });
    return el("fieldset", { className: "exercise__options" }, [legend, ...labels]);
}

/** Return the index of the checked option, or -1. */
function checkedIndex(group) {
    const input = group.querySelector("input:checked");
    return input ? Number(input.value) : -1;
}

/** Mark options as right or wrong (with an icon, not only a color). */
function markOptions(group, rightIndexes, chosen) {
    group.querySelectorAll(".option").forEach((option, index) => {
        option.classList.remove("is-right", "is-wrong");
        const mark = option.querySelector(".option__mark");
        mark.replaceChildren();
        if (rightIndexes.includes(index)) {
            option.classList.add("is-right");
            mark.append(icon("check"),
                        el("span", { className: "visually-hidden", text: "right" }));
        } else if (index === chosen) {
            option.classList.add("is-wrong");
            mark.append(icon("cross"),
                        el("span", { className: "visually-hidden", text: "wrong" }));
        }
    });
}

/** Clear the marks and the choice of an option group. */
function resetOptions(group, disabled = false) {
    markOptions(group, [], -1);
    for (const input of group.querySelectorAll("input")) {
        input.checked = false;
        input.disabled = disabled;
    }
}

/** Predict: choose, lock, build it in the model, compare. */
function mountPredict(parts, exercise, context) {
    const group = optionGroup(parts.id, exercise.options);
    const lock = button("Lock my answer", "btn btn--primary");
    const build = button("Build it in the model", "btn btn--primary", "play");
    const retry = button("Try again", "btn btn--quiet push");
    lock.disabled = true;
    build.hidden = true;
    retry.hidden = true;
    group.addEventListener("change", () => {
        lock.disabled = false;
    });
    lock.addEventListener("click", () => {
        for (const input of group.querySelectorAll("input")) {
            input.disabled = true;
        }
        lock.hidden = true;
        build.hidden = false;
        build.focus();
    });
    build.addEventListener("click", () => {
        context.apply(exercise.setup);
        const state = context.store.get();
        const answer = exercise.answer(state);
        const right = exercise.options.findIndex((option) => option.id === answer);
        const chosen = checkedIndex(group);
        markOptions(group, [right], chosen);
        showFeedback(parts.feedback, chosen === right ? "right" : "wrong",
                     resolve(exercise.explain, state));
        build.hidden = true;
        retry.hidden = false;
        retry.focus();
    });
    retry.addEventListener("click", () => {
        resetOptions(group);
        parts.feedback.replaceChildren();
        lock.hidden = false;
        lock.disabled = true;
        retry.hidden = true;
    });
    const actions = el("div", { className: "exercise__actions" }, [lock, build, retry]);
    parts.body.append(group, actions);
}

/** Numeric: type a value, check it with a tolerance, then see the solution. */
function mountNumeric(parts, exercise, context) {
    const inputId = `${parts.id}-value`;
    const unit = exercise.unit ? ` (${exercise.unit})` : "";
    const label = el("label", {
        className: "field__label",
        text: `Your answer${unit}`,
        attrs: { for: inputId },
    });
    const input = el("input", {
        className: "input exercise__value",
        attrs: { id: inputId, inputmode: "decimal", autocomplete: "off" },
    });
    const check = button("Check", "btn btn--primary");
    const show = button("Show the solution", "btn btn--quiet push", "chevron");
    const solution = el("div", { className: "exercise__solution" });
    show.disabled = true;
    show.setAttribute("aria-expanded", "false");
    solution.hidden = true;

    const run = () => {
        const value = parseNumber(input.value);
        const state = context.store.get();
        show.disabled = false;
        if (Number.isNaN(value)) {
            input.setAttribute("aria-invalid", "true");
            showFeedback(parts.feedback, "neutral", "Type a number, for example 0.75.");
            return;
        }
        input.removeAttribute("aria-invalid");
        const answer = resolve(exercise.answer, state);
        const tolerance = exercise.tolerance ?? DEFAULT_TOLERANCE;
        const unitText = exercise.unit ? ` ${exercise.unit}` : "";
        if (isClose(value, answer, tolerance)) {
            showFeedback(parts.feedback, "right",
                         `The answer is ${numberText(answer)}${unitText}.`);
        } else {
            const side = value > answer ? "high" : "low";
            showFeedback(parts.feedback, "wrong",
                         `Your value is too ${side}. Try again, or open the solution.`);
        }
    };
    check.addEventListener("click", run);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            run();
        }
    });
    show.addEventListener("click", () => {
        const open = solution.hidden;
        if (open) {
            solution.innerHTML = resolve(exercise.solution, context.store.get());
            renderMath(solution);
        }
        solution.hidden = !open;
        show.setAttribute("aria-expanded", String(open));
    });
    const answerRow = el("div", { className: "exercise__answer" }, [input, check]);
    parts.body.append(el("div", { className: "field" }, [label, answerRow]),
                      el("div", { className: "exercise__actions" }, [show]), solution);
}

/** Multiple choice: choose, check, read why. */
function mountChoice(parts, exercise) {
    const group = optionGroup(parts.id, exercise.options);
    const check = button("Check", "btn btn--primary");
    const rightIndexes = exercise.options
        .map((option, index) => (option.correct ? index : -1))
        .filter((index) => index >= 0);
    group.addEventListener("change", () => {
        markOptions(group, [], -1);
        parts.feedback.replaceChildren();
    });
    check.addEventListener("click", () => {
        const chosen = checkedIndex(group);
        if (chosen < 0) {
            showFeedback(parts.feedback, "neutral", "Choose an answer first.");
            return;
        }
        markOptions(group, rightIndexes, chosen);
        const option = exercise.options[chosen];
        showFeedback(parts.feedback, option.correct ? "right" : "wrong", option.why);
    });
    parts.body.append(group, el("div", { className: "exercise__actions" }, [check]));
}

/**
 * Challenge: reach a goal in the model.
 *
 * The card checks the goal only when the state changes, so the start state
 * never solves it.
 */
function mountChallenge(parts, exercise, context) {
    const status = el("span", { className: "pill" });
    const hintButton = button("Hint", "btn btn--quiet", "info");
    const restart = button("Start again", "btn btn--quiet push");
    const hint = html("div", "note exercise__hint", exercise.hint);
    hint.hidden = true;
    hintButton.setAttribute("aria-expanded", "false");
    restart.hidden = true;
    let reached = false;

    const showStatus = () => {
        status.className = reached ? "pill pill--yes" : "pill";
        const content = reached ? [icon("check"), "Goal reached"] : ["Not yet"];
        status.replaceChildren(...content);
    };
    context.store.subscribe((state) => {
        if (!reached && exercise.check(state)) {
            reached = true;
            showStatus();
            showFeedback(parts.feedback, "right", resolve(exercise.done, state));
            restart.hidden = false;
        }
    });
    // The hint button opens and closes the hint.
    const hintLabel = hintButton.lastChild;
    hintButton.addEventListener("click", () => {
        const open = hint.hidden;
        hint.hidden = !open;
        hintButton.setAttribute("aria-expanded", String(open));
        hintLabel.textContent = open ? "Hide hint" : "Hint";
        if (open) {
            renderMath(hint);
        }
    });
    restart.addEventListener("click", () => {
        reached = false;
        showStatus();
        parts.feedback.replaceChildren();
        restart.hidden = true;
    });
    showStatus();
    const actions = el("div", { className: "exercise__actions" },
                       [status, hintButton, restart]);
    parts.body.append(actions, hint);
}

const MOUNTERS = Object.freeze({
    predict: mountPredict,
    numeric: mountNumeric,
    choice: mountChoice,
    challenge: mountChallenge,
});

/**
 * Draw the exercises of a lesson in container.
 *
 * context.store: the tool store. context.apply(change): sets the stage
 * (use the tryChange of initLesson, so the stage also opens on a phone).
 */
export function mountExercises(container, exercises, context) {
    const cards = [];
    exercises.forEach((exercise, index) => {
        const mount = MOUNTERS[exercise.type];
        if (!mount) {
            console.warn(`Unknown exercise type: ${exercise.type}`);
            return;
        }
        const id = `exercise-${exercise.id}`;
        const head = el("p", {
            className: "exercise__head tag",
            text: `${index + 1} · ${TYPE_NAMES[exercise.type]}`,
        });
        const prompt = html("div", "exercise__prompt", exercise.prompt);
        const body = el("div", { className: "exercise__body" });
        const feedback = el("div", { attrs: { "aria-live": "polite" } });
        const card = el("article", { className: "card exercise", attrs: { id } },
                        [head, prompt, body, feedback]);
        mount({ id, body, feedback }, exercise, context);
        cards.push(card);
    });
    container.replaceChildren(...cards);
    renderMath(container);
}
