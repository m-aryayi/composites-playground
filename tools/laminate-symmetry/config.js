/** Constants of the laminate lesson, the same as in python/laminate_symmetry.py. */

// Graphite/epoxy ply in MPa and mm, from Kaw (2005). All plies
// have the same material and thickness, so only the angles matter.
// Units: MPa and mm give [A] in N/mm, [B] in N, and [D] in N·mm.
export const MATERIAL = Object.freeze({ E1: 181000.0, E2: 10300.0, nu12: 0.28,
                                        G12: 7170.0 });
export const MATERIAL_NAME = "Graphite/epoxy (carbon fiber)";
export const PLY_THICKNESS = 0.125;                    // mm
export const PULL_LOAD = Object.freeze([100.0, 0.0, 0.0]);   // Nx, Ny, Nxy in N/mm

export const DEFAULT_ANGLES = Object.freeze([0.0, 45.0, 90.0]);
export const MAX_PLIES = 12;
export const ANGLE_LIMITS = Object.freeze([-90.0, 90.0]);
export const ANGLE_STEP = 15.0;
export const COUPLING_TOLERANCE = 1.0e-8;

// Deformed plate: a square plate, drawn with exaggerated displacements.
export const PLATE_SIZE_MM = 100.0;
export const PLATE_GRID_POINTS = 21;
export const PLATE_OUT_OF_PLANE_SCALE = 0.35;
export const PLATE_SHEAR_SCALE = 0.12;
export const PLATE_COUPLING_RATIO = 1.0e-6;

// Plate colors of the Python app (RGB 0 to 1): light = no move, dark = most.
export const PLATE_LOW = Object.freeze([0.741, 0.902, 0.816]);
export const PLATE_HIGH = Object.freeze([0.059, 0.541, 0.373]);

// Exploded ply stack: unit-square plies, drawn apart so that each ply shows.
export const STACK_HEIGHT = 1.9;
export const PLY_SLAB_FRACTION = 0.3;
export const MIN_ROWS = 6;
export const FIBER_SPACING = 0.07;

// ------------------------------------------------ web view of the ply stack

// The start view of the Python app. The view center moves to the right of
// the stack (centerShift), so the labels and the brackets fit.
export const STACK_VIEW = Object.freeze({
    elevation: 24.0,
    azimuth: -58.0,
    viewSize: 2.5,                  // world units that always fit up and down
    viewWidth: 2.6,                 // and across: the labels and the brackets
    centerShift: 0.2,
});
export const STACK_STYLE = Object.freeze({
    labelGap: 0.12,                 // label to ply corner
    bracketStart: 0.05,             // first bracket to ply corner
    bracketStep: 0.06,              // between two brackets
    lineWidth: 2.5,                 // brackets and mid-plane edge, in pixels
    dashSize: 0.035,                // dashed lines, in world units
    gapSize: 0.025,
    midPlaneSize: 0.8,              // half the side of the mid-plane square
    midPlaneOpacity: 0.25,
    fiberInset: 0.03,               // fiber lines stop this far from the edge
    fiberLift: 0.002,               // fiber lines just above the top face
    fiberOpacity: 0.8,
    plyColors: Object.freeze(["#3B4A44", "#26302B", "#1D2622"]),    // top, front, right
    selectedColors: Object.freeze(["#00785A", "#00604A", "#004D3B"]),
    hiddenColor: "#1D2622",
    fiberColor: "#B9CCC3",
    selectedFiberColor: "#E1F2EB",
    midPlaneColor: "#0072B2",
    sameColor: "#00785A",           // mirror pair with the same direction: solid
    differColor: "#D55E00",         // mirror pair that differs: dashed
});
export const CLICK_TOLERANCE_PX = 5;    // a shorter move is a click, not a drag

// ------------------------------------------------- web view of the plate

export const VIEW_MODES = Object.freeze(["Bend", "Shear", "Both"]);
export const DEFAULT_MODE = "Both";
export const PLATE_VIEW = Object.freeze({
    elevation: 24.0,
    azimuth: -58.0,
    viewSize: 1.6,                  // world units that fit up and down
    viewWidth: 2.0,                 // and across: the plate and the arrows
});
// The Python app draws z with the matplotlib box aspect (1, 1, 0.55) over
// the limits x: ±0.75 and z: ±0.45, so a plate height shows 0.917 times.
export const PLATE_Z_SCALE = (0.55 * 1.5) / 0.9;
export const PLATE_STYLE = Object.freeze({
    // One-hue ramp (safe for color blindness), as sRGB 0 to 1:
    // #E1F2EB (no move) to #00785A (largest move).
    low: Object.freeze([225 / 255, 242 / 255, 235 / 255]),
    high: Object.freeze([0 / 255, 120 / 255, 90 / 255]),
    gridColor: "#FFFFFF",
    gridOpacity: 0.75,
    outlineColor: "#56635C",
    outlineWidth: 1.5,              // pixels
    dashSize: 0.04,
    gapSize: 0.03,
    arrowColor: "#00785A",
    arrowLength: 0.24,              // as in the Python app
    arrowGap: 0.1,
    arrowHeadRatio: 0.4,
    arrowRadius: 0.012,
    arrowHeadRadius: 0.035,
});
export const SHAPE_CHANGE_MS = 350;     // 14 frames of 25 ms in the Python app

// ------------------------------------------------------- texts of the stage

export const TEXTS = Object.freeze({
    symmetric: "Symmetric",
    notSymmetric: "Not symmetric",
    balanced: "Balanced",
    notBalanced: "Not balanced",
    bZero: "[B] = 0",
    bNonZero: "[B] ≠ 0",
    aZero: "A16 = A26 = 0",
    aNonZero: "A16, A26 ≠ 0",
    bZeroResult: "[B] = 0: a pull does not bend or twist it.",
    bNonZeroResult: "[B] ≠ 0: a pull also bends or twists it.",
    aZeroResult: "A16 = A26 = 0: balanced. No shear if [B] = 0 too.",
    aNonZeroResult: "A16, A26 ≠ 0: not balanced, a pull also shears it.",
    minPly: "A laminate needs at least one ply.",
    maxPly: `This lesson allows up to ${MAX_PLIES} plies.`,
    mirrorLimit: (count) => `Mirror needs ${count} plies. `
        + `This lesson allows up to ${MAX_PLIES} plies.`,
    notNumber: (text) => `"${text}" is not a number.`,
});
