/** Lesson frame: section bar, "Try it" buttons, share link, and stage fold. */

import { qs, qsa } from "./dom.js";
import { prepareToasts, showToast } from "./toast.js";
import { copyText } from "./url-state.js";

// A section is "current" when it crosses a band at 30-40 % of the screen.
const SECTION_BAND = "-30% 0px -60% 0px";

/** Mark the link of the section that the reader reads now. */
function watchSections(nav) {
    const links = qsa("a[href^='#']", nav);
    const linkOf = new Map(links.map((link) => [link.hash.slice(1), link]));
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) {
                continue;
            }
            for (const link of links) {
                link.removeAttribute("aria-current");
            }
            linkOf.get(entry.target.id)?.setAttribute("aria-current", "true");
        }
    }, { rootMargin: SECTION_BAND });
    for (const id of linkOf.keys()) {
        const section = document.getElementById(id);
        if (section) {
            observer.observe(section);
        }
    }
}

/** Fold or open the stage (only visible on a phone). */
function setFolded(stage, folded) {
    stage.classList.toggle("is-folded", folded);
    const button = qs(".stage__fold", stage);
    if (button) {
        button.setAttribute("aria-expanded", String(!folded));
        button.setAttribute("aria-label", folded ? "Show the model" : "Hide the model");
    }
}

/** Keep --stage-h equal to the stage height, so sections scroll below it. */
function watchStageHeight(stage) {
    const observer = new ResizeObserver(() => {
        document.documentElement.style
            .setProperty("--stage-h", `${stage.offsetHeight}px`);
    });
    observer.observe(stage);
}

/**
 * Start the lesson frame.
 *
 * stage: the stage element.
 * onTry(change): applies the change of a "Try it" button (data-try JSON).
 * getShareUrl(): returns the share link of the current state.
 *
 * Returns { tryChange(change) }: it applies a change and opens the stage,
 * as a "Try it" button does. The exercises use it for "Build it".
 */
export function initLesson({ stage, onTry, getShareUrl }) {
    prepareToasts();
    const nav = qs(".section-nav");
    if (nav) {
        watchSections(nav);
    }
    const tryChange = (change) => {
        onTry(change);
        setFolded(stage, false);
    };
    for (const button of qsa("[data-try]")) {
        button.addEventListener("click", () => {
            tryChange(JSON.parse(button.dataset.try));
        });
    }
    qs(".stage__fold", stage)?.addEventListener("click", () => {
        setFolded(stage, !stage.classList.contains("is-folded"));
    });
    // A tap on the folded bar opens the stage again.
    qs(".stage__bar", stage)?.addEventListener("click", (event) => {
        if (stage.classList.contains("is-folded") && !event.target.closest("button")) {
            setFolded(stage, false);
        }
    });
    for (const button of qsa("[data-action='share']", stage)) {
        button.addEventListener("click", async () => {
            const copied = await copyText(getShareUrl());
            if (copied) {
                showToast("Link copied");
            } else {
                showToast("Copy the link from the address bar", { iconName: "info" });
            }
        });
    }
    watchStageHeight(stage);
    return Object.freeze({ tryChange });
}
