/** Equations: draw the LaTeX of a page part with KaTeX. */

// \( ... \) is an equation in a line; \[ ... \] is an equation block.
const DELIMITERS = [
    { left: "\\[", right: "\\]", display: true },
    { left: "\\(", right: "\\)", display: false },
];

/**
 * Draw all equations in root; return true if KaTeX loaded.
 *
 * KaTeX loads only here, so a CDN failure leaves the equations as text and
 * does not stop the rest of the page.
 */
export async function renderMath(root = document.body) {
    try {
        const { default: renderMathInElement } = await import("katex/auto-render");
        renderMathInElement(root, { delimiters: DELIMITERS, throwOnError: false });
        return true;
    } catch (error) {
        console.warn("KaTeX did not load; the equations stay as text.", error);
        return false;
    }
}
