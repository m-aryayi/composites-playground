/** Constants of the laminate lesson, the same as in python/laminate_symmetry.py. */

// Graphite/epoxy ply in MPa and mm, from Kaw (2005), Table 2.1. All plies
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
