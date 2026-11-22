/** Constants of the RVE lesson, the same as in python/rve_homogenization.py. */

// Short references: Kaw = A. K. Kaw (2005), Mechanics of Composite Materials,
// 2nd ed.; Chawla = K. K. Chawla (2012), Composite Materials, 3rd ed.
// All moduli in GPa, densities in g/cm³.

// The inputs: key, name, range, and step. Axis 1 is along the fibers.
export const INPUTS = Object.freeze({
    e1: Object.freeze({ name: "E1", low: 5.0, high: 500.0, step: 0.1 }),
    e2: Object.freeze({ name: "E2", low: 1.0, high: 500.0, step: 0.1 }),
    nu12: Object.freeze({ name: "ν12", low: 0.10, high: 0.45, step: 0.01 }),
    nu23: Object.freeze({ name: "ν23", low: 0.05, high: 0.49, step: 0.01 }),
    g12: Object.freeze({ name: "G12", low: 1.0, high: 250.0, step: 0.1 }),
    em: Object.freeze({ name: "E", low: 0.5, high: 100.0, step: 0.1 }),
    num: Object.freeze({ name: "ν", low: 0.10, high: 0.45, step: 0.01 }),
    vf: Object.freeze({ name: "Vf", low: 0.05, high: 0.90, step: 0.01 }),
    rhoF: Object.freeze({ name: "ρ", low: 0.5, high: 20.0, step: 0.01 }),
    rhoM: Object.freeze({ name: "ρ", low: 0.5, high: 20.0, step: 0.01 }),
});
export const FIBER_KEYS = Object.freeze(["e1", "e2", "nu12", "nu23", "g12"]);
export const MATRIX_KEYS = Object.freeze(["em", "num"]);
export const MODULUS_KEYS = Object.freeze(["e1", "e2", "g12", "em"]);
export const POISSON_KEYS = Object.freeze(["nu12", "nu23", "num"]);
export const DENSITY_KEYS = Object.freeze(["rhoF", "rhoM"]);
export const DIGITS = Object.freeze({ modulus: 1, poisson: 3, vf: 2, density: 2 });
export const MODULUS_UNIT = "GPa";
export const DENSITY_UNIT = "g/cm³";
export const DEFAULT_VF = 0.60;

// Fiber list: name, E1, E2, ν12, ν23, G12, ρ. An isotropic fiber has
// E1 = E2, ν12 = ν23, and G12 = E / (2 (1 + ν)), rounded to 0.1 GPa.
// Sources: Kaw; the boron density from Chawla.
export const FIBER_PRESETS = Object.freeze([
    Object.freeze({ name: "E-glass", values: [72.4, 72.4, 0.20, 0.20, 30.2],
                    rho: 2.54 }),
    Object.freeze({ name: "S-glass", values: [85.5, 85.5, 0.20, 0.20, 35.6],
                    rho: 2.49 }),
    Object.freeze({ name: "Carbon (graphite)", values: [230.0, 22.0, 0.30, 0.35, 22.0],
                    rho: 1.80 }),                                           // Kaw
    Object.freeze({ name: "Aramid (Kevlar 49)", values: [124.0, 8.0, 0.36, 0.37, 3.0],
                    rho: 1.40 }),                                           // Kaw
    Object.freeze({ name: "Boron", values: [414.0, 414.0, 0.20, 0.20, 172.5],
                    rho: 2.60 }),
]);
// Matrix list: name, E, ν, ρ. The matrix is isotropic.
export const MATRIX_PRESETS = Object.freeze([
    Object.freeze({ name: "Epoxy", values: [3.4, 0.30], rho: 1.20 }),       // Kaw
    Object.freeze({ name: "Polyester", values: [3.0, 0.27], rho: 1.25 }),   // Chawla
    Object.freeze({ name: "Polyamide", values: [3.5, 0.35], rho: 1.20 }),   // Kaw
    Object.freeze({ name: "Aluminum", values: [71.0, 0.30], rho: 2.70 }),   // Kaw
]);
export const DEFAULT_PRESETS = Object.freeze(["Carbon (graphite)", "Epoxy"]);
export const CUSTOM_NAME = "Custom";

export const PROPERTY_NAMES = Object.freeze([
    "E1 (along)", "E2 = E3 (across)", "G12 = G13", "G23", "ν12 = ν13", "ν23",
]);
export const MODEL_NAMES = Object.freeze(["ROM", "Chamis", "CCA", "MT"]);
export const MODEL_LONG_NAMES = Object.freeze(["Rule of mixtures", "Chamis",
                                               "Composite cylinders",
                                               "Mori-Tanaka"]);
export const DEFAULT_MODEL = 2;                // CCA

// The RVE block: fibers of a fixed radius in a hexagonal pattern with one
// fiber in the middle. A higher Vf puts the fibers closer together.
export const BLOCK_WIDTH = 7.0;                // along axis 2
export const BLOCK_HEIGHT = 2.5 * 3.0 ** 0.5;  // along axis 3
export const BLOCK_LENGTH = 6.0;               // along the fibers (axis 1)
export const FIBER_RADIUS = 0.2;               // at Vf 0.90 the fibers almost touch
export const ARC_POINTS = 64;                  // points on a full fiber circle
export const VF_POINTS = 86;                   // points on the E against Vf curves

// The bars: E along and across for the fiber, the composite, the matrix,
// and two reference metals (isotropic: one E for both).
export const REFERENCE_METALS = Object.freeze([
    Object.freeze({ name: "Aluminum", e: 71.0, rho: 2.70 }),    // Kaw
    Object.freeze({ name: "Steel", e: 206.8, rho: 7.80 }),      // Kaw
]);
export const BAR_WHOLE_FROM = 100.0;           // a bar value has no decimals from here
