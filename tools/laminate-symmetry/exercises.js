/** Exercises of the laminate lesson. Every answer comes from the model. */

import { MATERIAL, PLY_THICKNESS, PULL_LOAD } from "./config.js";
import {
    abdMatrix,
    formatAngle,
    isBalanced,
    isCoupled,
    midplaneResponse,
    plateShape,
    reducedStiffness,
} from "./model.js";

const MPA_PER_GPA = 1000;              // the model uses MPa; 1 GPa = 1000 MPa

/** Return the facts of a stack: coupled, balanced, and the plate label. */
function factsOf(plies) {
    const abd = abdMatrix(plies, PLY_THICKNESS);
    return {
        abd,
        coupled: isCoupled(abd, plies.length * PLY_THICKNESS),
        balanced: isBalanced(abd),
        label: plateShape(...midplaneResponse(abd, PULL_LOAD))[3],
    };
}

/** Return a stack as text, for example "[0/+45/90]". */
function stackText(plies) {
    return `[${plies.map((a) => formatAngle(a).replace("°", "")).join("/")}]`;
}

const Q = reducedStiffness(MATERIAL);

export const EXERCISES = Object.freeze([
    {
        id: "predict-cross",
        type: "predict",
        prompt: "<p>A two-ply laminate [0/90] is pulled along x. What does it do?</p>",
        options: [
            { id: "flat", label: "It stays flat" },
            { id: "curls", label: "It curls" },
            { id: "twists", label: "It twists" },
        ],
        setup: { plies: [0, 90] },
        answer: ({ plies }) => {
            const { label } = factsOf(plies);
            if (label.startsWith("stays flat")) {
                return "flat";
            }
            return label.startsWith("twists") ? "twists" : "curls";
        },
        explain: ({ plies }) => `Pulled, ${stackText(plies)} ${factsOf(plies).label}. `
            + "The 90° ply below the mid-plane is not the mirror image of the 0° ply "
            + "above it, so \\([B] \\neq 0\\): the pull also bends the plate.",
    },
    {
        id: "predict-angle-ply",
        type: "predict",
        prompt: "<p>Look at [+45/−45]. Is it symmetric? Is it balanced?</p>",
        options: [
            { id: "both", label: "Symmetric and balanced" },
            { id: "balanced", label: "Balanced, not symmetric" },
            { id: "symmetric", label: "Symmetric, not balanced" },
            { id: "neither", label: "Neither" },
        ],
        setup: { plies: [45, -45] },
        answer: ({ plies }) => {
            const { coupled, balanced } = factsOf(plies);
            if (!coupled) {
                return balanced ? "both" : "symmetric";
            }
            return balanced ? "balanced" : "neither";
        },
        explain: "The +45° and the −45° ply cancel A16 and A26, so the stack is "
            + "balanced. But the −45° ply below the mid-plane is not the mirror "
            + "image "
            + "of the +45° ply above it, so \\([B] \\neq 0\\) and the plate twists.",
    },
    {
        id: "predict-symmetric-unbalanced",
        type: "predict",
        prompt: "<p>[0/+45/90]<sub>s</sub> is pulled along x. What does it do?</p>",
        options: [
            { id: "flat", label: "It stays flat" },
            { id: "shears", label: "It stays flat but shears" },
            { id: "curls", label: "It curls" },
        ],
        setup: { plies: [0, 45, 90, 90, 45, 0] },
        answer: ({ plies }) => {
            const { label } = factsOf(plies);
            if (label === "stays flat") {
                return "flat";
            }
            return label === "stays flat but shears" ? "shears" : "curls";
        },
        explain: "The stack is symmetric, so \\([B] = 0\\) and it does not bend. "
            + "But it has +45° plies and no −45° plies, so \\(A_{16} \\neq 0\\): "
            + "the square becomes a slanted shape.",
    },
    {
        id: "numeric-q11",
        type: "numeric",
        prompt: "<p>Calculate \\(Q_{11}\\) of one graphite/epoxy ply: "
            + "\\(E_1 = 181\\) GPa, \\(E_2 = 10.3\\) GPa, \\(\\nu_{12} = 0.28\\). "
            + "Give 4 digits.</p>",
        answer: Q[0][0] / MPA_PER_GPA,
        unit: "GPa",
        tolerance: 0.002,
        solution: "<p>\\(\\nu_{21} = \\nu_{12} E_2 / E_1 = 0.28 \\cdot 10.3 / 181 "
            + "= 0.01593\\)</p>"
            + "<p>\\(Q_{11} = \\dfrac{E_1}{1 - \\nu_{12}\\nu_{21}} = "
            + "\\dfrac{181}{1 - 0.00446} = 181.8\\) GPa</p>"
            + "<p>\\(Q_{11}\\) is a little more than \\(E_1\\): the ply cannot "
            + "contract freely across the fibers.</p>",
    },
    {
        id: "numeric-a11",
        type: "numeric",
        prompt: "<p>Calculate \\(A_{11}\\) of [0/90]<sub>s</sub> with plies of "
            + "0.125 mm. Use \\(Q_{11} = 181\\,811\\) MPa and "
            + "\\(Q_{22} = 10\\,346\\) MPa.</p>",
        answer: abdMatrix([0, 90, 90, 0], PLY_THICKNESS)[0][0],
        unit: "N/mm",
        solution: "<p>\\(A_{11} = \\sum_k (\\bar{Q}_{11})_k\\,t_k\\). A 0° ply has "
            + "\\(\\bar{Q}_{11} = Q_{11}\\); a 90° ply has "
            + "\\(\\bar{Q}_{11} = Q_{22}\\).</p>"
            + "<p>\\(A_{11} = 2 \\cdot 0.125 \\cdot 181\\,811 + 2 \\cdot 0.125 "
            + "\\cdot 10\\,346 = 48\\,039\\) N/mm</p>",
    },
    {
        id: "numeric-b11",
        type: "numeric",
        prompt: "<p>Calculate \\(B_{11}\\) of [0/90], with its sign. The 0° ply is "
            + "on top, each ply is 0.125 mm thick, and the values of \\(Q\\) are "
            + "the same as above.</p>",
        answer: abdMatrix([0, 90], PLY_THICKNESS)[0][3],
        unit: "N",
        solution: "<p>The ply surfaces are at \\(h_0 = -0.125\\), \\(h_1 = 0\\), "
            + "\\(h_2 = 0.125\\) mm.</p>"
            + "<p>\\(B_{11} = \\tfrac{1}{2}\\left[Q_{11}(h_1^2 - h_0^2) + "
            + "Q_{22}(h_2^2 - h_1^2)\\right] = \\tfrac{1}{2} \\cdot 0.015625 \\cdot "
            + "(10\\,346 - 181\\,811) = -1340\\) N</p>"
            + "<p>In a symmetric stack the two halves give the same terms with "
            + "opposite signs, so they cancel.</p>",
    },
    {
        id: "choice-b-zero",
        type: "choice",
        prompt: "<p>Which condition makes \\([B] = 0\\)?</p>",
        options: [
            { label: "The stack is the same above and below the mid-plane",
              correct: true,
              why: "Then each ply has a mirror ply. Their terms "
                  + "\\((h_k^2 - h_{k-1}^2)\\) have opposite signs and cancel." },
            { label: "Each +θ ply has a −θ ply", correct: false,
              why: "That makes the stack balanced (\\(A_{16} = A_{26} = 0\\)), "
                  + "not symmetric. [+45/−45] is balanced, but \\([B] \\neq 0\\)." },
            { label: "All plies have the same thickness", correct: false,
              why: "Plies of the same thickness can still be in an order that is "
                  + "not a mirror image, for example [0/90]." },
        ],
    },
    {
        id: "choice-balanced",
        type: "choice",
        prompt: "<p>Which stack is balanced?</p>",
        options: [
            { label: "[+30]", correct: false,
              why: "A single +30° ply has \\(\\bar{Q}_{16} \\neq 0\\), and nothing "
                  + "cancels it." },
            { label: "[+30/−30]", correct: true,
              why: "\\(\\bar{Q}_{16}(-30°) = -\\bar{Q}_{16}(+30°)\\), so the two "
                  + "plies cancel \\(A_{16}\\) and \\(A_{26}\\)." },
            { label: "[+30/0]", correct: false,
              why: "The 0° ply has \\(\\bar{Q}_{16} = 0\\), so it cannot cancel the "
                  + "+30° ply." },
        ],
    },
    {
        id: "challenge-balanced-unsymmetric",
        type: "challenge",
        prompt: "<p>Build a <strong>4-ply</strong> laminate that is "
            + "<strong>balanced</strong> but <strong>not symmetric</strong>.</p>",
        check: ({ plies }) => {
            const { coupled, balanced } = factsOf(plies);
            return plies.length === 4 && balanced && coupled;
        },
        hint: "<p>Use +45° and −45° plies, in an order that is not a mirror image. "
            + "Select a ply and type its angle.</p>",
        done: ({ plies }) => `${stackText(plies)} has a −θ ply for each +θ ply, `
            + "but the order is not a mirror image, so a pull also bends or twists it.",
    },
    {
        id: "challenge-flat-shear",
        type: "challenge",
        prompt: "<p>Build a laminate that <strong>stays flat but shears</strong> "
            + "when it is pulled.</p>",
        check: ({ plies }) => factsOf(plies).label === "stays flat but shears",
        hint: "<p>It must be symmetric (no bend) and not balanced (shear). "
            + "Try three plies with a +45° ply in the middle.</p>",
        done: ({ plies }) => `${stackText(plies)} is symmetric, so it stays flat, `
            + "and not balanced, so it shears.",
    },
]);
