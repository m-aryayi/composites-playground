"""Fibers and matrix act as one material: the stiffness of a composite RVE."""

import tkinter as tk
from tkinter import ttk
from typing import NamedTuple

import numpy as np
from matplotlib import font_manager, rcParams
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.colors import to_rgb
from matplotlib.figure import Figure
from matplotlib.patches import FancyBboxPatch, Patch, PathPatch, Rectangle
from matplotlib.path import Path
from matplotlib.ticker import MaxNLocator
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

# Short references in the comments:
#   Kaw:    A. K. Kaw (2005), Mechanics of Composite Materials, 2nd ed., CRC.
#   Chawla: K. K. Chawla (2012), Composite Materials: Science and
#           Engineering, 3rd ed., Springer.
#   T3.1 = Table 3.1, Fig. = Figure.


class InputSpec(NamedTuple):
    """One input: its name, its lowered letters, its range, and its step."""

    name: str
    subscript: str
    low: float
    high: float
    step: float


class Fiber(NamedTuple):
    """Elastic constants of a transversely isotropic fiber; axis 1 is along it.

    Five constants are independent. G23 follows from E2 and ν23 because the
    2-3 plane is isotropic (Chawla T10.1).
    """

    e1: float
    e2: float
    nu12: float
    nu23: float
    g12: float


# =============================================================================
# Configuration
# =============================================================================

APP_TITLE = "Composite RVE: two materials act as one"
# V with a lowered f, in the normal font (matplotlib text).
VF_TEXT = r"V$_\mathregular{f}$"
APP_HINT = (f"Pick a fiber and a matrix, or set your own values. Move "
            f"{VF_TEXT}. See the stiffness of the mix.")
INPUTS_CAPTION = "FIBER AND MATRIX"
BLOCK_CAPTION = "THE RVE"
TABLE_CAPTION = "HOMOGENIZED PROPERTIES (GPa)"
VF_CAPTION = f"E1 AND E2 AGAINST {VF_TEXT}"
BARS_CAPTION = "YOUNG'S MODULUS: FIBER, COMPOSITE, MATRIX, METALS"
MODEL_LABEL = "Charts use:"
BLOCK_NOTE = (f"Hexagonal packing (E2 = E3). Fixed fiber size: a higher "
              f"{VF_TEXT} packs more fibers.")
MODEL_NOTE = ("ROM: rule of mixtures    CCA: composite cylinders    "
              "MT: Mori-Tanaka")
G23_NOTE = "from E2, ν23"         # G23 is calculated, not an input
DENSITY_NOTE = "density"

# Inputs: fiber E1, E2 (GPa), ν12, ν23, G12 (GPa); matrix E (GPa), ν; fiber
# volume fraction; fiber and matrix density (g/cm³). Axis 1 is along the
# fibers. The densities have a typed box only, no slider.
INPUTS = (InputSpec("E", "1", 5.0, 500.0, 0.1),
          InputSpec("E", "2", 1.0, 500.0, 0.1),
          InputSpec("ν", "12", 0.10, 0.45, 0.01),
          InputSpec("ν", "23", 0.05, 0.49, 0.01),
          InputSpec("G", "12", 1.0, 250.0, 0.1),
          InputSpec("E", "", 0.5, 100.0, 0.1),
          InputSpec("ν", "", 0.10, 0.45, 0.01),
          InputSpec("Fiber volume fraction V", "f", 0.05, 0.90, 0.01),
          InputSpec("ρ", "", 0.5, 20.0, 0.01),
          InputSpec("ρ", "", 0.5, 20.0, 0.01))
FIBER_E1 = 0
FIBER_E2 = 1
VF_INDEX = 7
FIBER_CONSTANTS = (0, 1, 2, 3, 4)   # in the order of the Fiber fields
MATRIX_CONSTANTS = (5, 6)           # E, ν
DENSITY_INDICES = (8, 9)            # fiber, matrix
MODULUS_INDICES = (0, 1, 4, 5)      # in GPa
POISSON_INDICES = (2, 3, 6)
MODULUS_DIGITS = 1
POISSON_DIGITS = 3              # shown with 2 when the third is 0
VF_DIGITS = 2
DENSITY_DIGITS = 2
MODULUS_UNIT = "GPa"
DENSITY_UNIT = "g/cm³"
ENTRY_WIDTH = 5                 # characters in a typed value box
DEFAULT_VF = 0.60

# Fiber list: (name, E1, E2, ν12, ν23, G12, ρ), moduli in GPa, ρ in g/cm³.
# An isotropic fiber has E1 = E2, ν12 = ν23, and G12 = E / (2 (1 + ν)),
# here rounded to 0.1 GPa. Sources: glass E and ρ Kaw T1.6, ν Kaw T3.1;
# boron E and ν Kaw Fig. 3.10, ρ Chawla T2.11.
FIBER_PRESETS = (
    ("E-glass", 72.4, 72.4, 0.20, 0.20, 30.2, 2.54),              # Kaw
    ("S-glass", 85.5, 85.5, 0.20, 0.20, 35.6, 2.49),              # Kaw
    ("Carbon (graphite)", 230.0, 22.0, 0.30, 0.35, 22.0, 1.80),   # Kaw T3.1
    ("Aramid (Kevlar 49)", 124.0, 8.0, 0.36, 0.37, 3.0, 1.40),    # Kaw T3.1
    ("Boron", 414.0, 414.0, 0.20, 0.20, 172.5, 2.60))         # Kaw, Chawla
# Matrix list: (name, E in GPa, ν, ρ in g/cm³). The matrix is isotropic.
MATRIX_PRESETS = (("Epoxy", 3.4, 0.30, 1.20),               # Kaw T3.2
                  ("Polyester", 3.0, 0.27, 1.25),           # Chawla T3.2, mid
                  ("Polyamide", 3.5, 0.35, 1.20),           # Kaw T3.2
                  ("Aluminum", 71.0, 0.30, 2.70))           # Kaw T3.2
MATERIAL_NAMES = ("Fiber", "Matrix")
PRESETS = (FIBER_PRESETS, MATRIX_PRESETS)
# The inputs of each material, in the order of its list values.
MATERIAL_INPUTS = (FIBER_CONSTANTS + DENSITY_INDICES[:1],
                   MATRIX_CONSTANTS + DENSITY_INDICES[1:])
DEFAULT_PRESETS = ("Carbon (graphite)", "Epoxy")
CUSTOM_NAME = "Custom"
COMBO_WIDTH = 20                # characters in a material list box
COMBO_THEME = "clam"            # a ttk theme that lets the list box be flat
COMBO_PADDING = (4, 1)

PROPERTY_NAMES = ("E1  (along)", "E2 = E3  (across)", "G12 = G13", "G23",
                  "ν12 = ν13", "ν23")
# Short names in the buttons and the table headers; MODEL_NOTE explains them.
MODEL_NAMES = ("ROM", "Chamis", "CCA", "MT")
DEFAULT_MODEL = 2

# The RVE block: fibers of a fixed radius in a hexagonal pattern with one
# fiber in the middle. A higher Vf puts the fibers closer together.
BLOCK_WIDTH = 7.0               # along axis 2
BLOCK_HEIGHT = 2.5 * 3.0 ** 0.5  # along axis 3
BLOCK_LENGTH = 6.0              # along the fibers (axis 1): short, so the
                                # cross section is large in the view
FIBER_RADIUS = 0.2              # at Vf 0.90 the fibers almost touch
ARC_POINTS = 64                 # points on a full fiber circle
VIEW = (25.0, -36.0)            # elevation and azimuth in degrees
BLOCK_ZOOM = 1.0
FACE_SHADES = (1.0, 0.86, 0.94)  # light on faces normal to axis 1, 2, 3
VF_POINTS = 86                  # points on the E1 against Vf curve
VF_TICK = 0.3                   # step of the Vf ticks

# The bar chart: E along and across for the fiber, the composite, the
# matrix, and two reference metals. A metal is isotropic: one E for both.
# The buttons show E, or the specific modulus E/ρ (Kaw T1.1).
BAR_GROUPS = (r"E$_\mathregular{1}$  along the fibers",
              r"E$_\mathregular{2}$ = E$_\mathregular{3}$  across the fibers")
REFERENCE_METALS = (("Aluminum", 71.0, 2.70),   # E (GPa), ρ (g/cm³): Kaw T3.2
                    ("Steel", 206.8, 7.80))     # Kaw T1.5
BAR_VIEWS = ("E/ρ", "E")
SPECIFIC_VIEW = 0               # the start view
BAR_VIEW_LABEL = "Show:"
# E/ρ in GPa per g/cm³ (= MJ/kg); Kaw T1.1 uses GPa·m³/kg, 1000 times less.
BAR_Y_LABELS = ("E/ρ (GPa per g/cm³)", "E (GPa)")
BAR_WIDTH = 0.145               # the step between two groups is 1
BAR_STEP = 0.16                 # a small gap between two bars of one group
BAR_HEADROOM = 1.18             # room above the highest bar for its value
BAR_LABEL_GAP = 2.0             # points between a bar top and its value
BAR_WHOLE_FROM = 100.0          # GPa: a bar value has no decimals from here
BAR_CORNER = 3.0                # pixels: the round of the free bar end
BAND_HALF = 0.46                # half width of a group band (group step 1)
BAR_TICKS = 4                   # at most this many value grid lines
BAR_VALUE_SIZE = 8.5            # values of fiber, matrix, and metals
COMPOSITE_VALUE_SIZE = 10.0     # the composite value stands out

# Colors: a cool gray page, white cards, glass fibers in an amber epoxy.
BG_COLOR = "#F2F5F9"
CARD_COLOR = "#FFFFFF"
SHADOW_COLOR = "#1E3A5F"
SHADOW_ALPHA = 0.08
INK_COLOR = "#1B2430"
MUTED_COLOR = "#5B6676"
TROUGH_COLOR = "#DCE6F2"
FIBER_COLOR = "#DCE3EA"         # silver-gray glass
FIBER_RIM = "#9AA7B4"           # thin ring around each fiber
FIBER_TEXT = "#2F6FB5"          # fiber labels and bars
MATRIX_COLOR = "#C8913A"        # honey-amber epoxy
MATRIX_TEXT = "#9A5B12"
EDGE_COLOR = "#5A3E17"
HIGHLIGHT_COLOR = "#E7EEF8"
GRID_COLOR = "#E4E9F0"
BAND_COLOR = "#F5F8FC"          # a very light band behind each bar group
BASELINE_COLOR = "#C5CFDB"      # the zero line under the bars
# The composite is a mix of both parts, so it has a neutral color.
COMPOSITE_COLOR = "#1B2430"
INPUT_COLORS = ((FIBER_TEXT,) * 5 + (MATRIX_TEXT,) * 2 + (INK_COLOR,)
                + (FIBER_TEXT, MATRIX_TEXT))
MATERIAL_COLORS = (FIBER_TEXT, MATRIX_TEXT)
# Reference metals in grays, so they stay behind the three materials.
ALUMINUM_COLOR = "#B8C0CB"
STEEL_COLOR = "#7A8594"
BAR_COLORS = (FIBER_TEXT, COMPOSITE_COLOR, MATRIX_COLOR, ALUMINUM_COLOR,
              STEEL_COLOR)

# Window, fonts, and figure layout (figure fractions: left, bottom, w, h).
# The window is a part of the screen, at most WINDOW_MAX pixels. The fonts
# have the same size on every screen.
WINDOW_FRACTION = (0.9, 0.8)
WINDOW_MAX = (1120, 600)
UI_SCALE = 0.89                  # size factor of fonts and widgets
POINT_PIXELS = 96 / 72           # pixels per point when UI_SCALE is 1
FIGURE_DPI = 100
PAD = 12
SLIDER_PAD = 4                   # pixels above and below a slider
HEADER_PAD = 3                   # pixels below a material list box
HEADER_GAP = 6                   # pixels above the matrix list box
PLOT_FONTS = ("Segoe UI", "Arial", "DejaVu Sans")
UI_FONT_NAME = "Segoe UI"
UI_FONT = (UI_FONT_NAME, 11)
UI_BOLD = (UI_FONT_NAME, 11, "bold")
SUBSCRIPT_FONT = (UI_FONT_NAME, 8, "bold")
TITLE_SIZE = 24.0
NOTE_SIZE = 12.0
TABLE_SIZE = 11.5
SMALL_SIZE = 10.0
INPUTS_CARD = (0.02, 0.55, 0.42, 0.30)
BLOCK_CARD = (0.02, 0.03, 0.42, 0.50)
PROPS_CARD = (0.46, 0.40, 0.52, 0.45)
BARS_CARD = (0.46, 0.03, 0.52, 0.35)
INPUTS_PLACE = (0.03, 0.56, 0.40, 0.255)
MODEL_PLACE = (0.47, 0.765, 0.50, 0.04)
BLOCK_PLACE = (0.03, 0.165, 0.40, 0.32)
VF_PLACE = (0.03, 0.095, 0.40, 0.065)   # the Vf slider, below the block
PROPS_PLACE = (0.47, 0.41, 0.50, 0.35)
BARS_PLACE = (0.47, 0.04, 0.50, 0.295)
BAR_VIEW_PLACE = (0.78, 0.336, 0.19, 0.036)   # E/ρ | E, in the caption row
# Grid places (row, column) in the FIBER AND MATRIX card. The fiber rows
# have "along" on the left and "across" on the right: E1 | E2, ν12 | ν23,
# G12 | G23. The matrix row has E | ν. Columns: name, slider, value box;
# column 3 is a gap. A list row has the list in columns 0-3 and the density
# in columns 4-6.
HEADER_ROWS = (0, 4)
INPUT_GRID = ((1, 0), (1, 4), (2, 0), (2, 4), (3, 0), (5, 0), (5, 4))
G23_GRID = (3, 4)
HEADER_SPAN = 4
DENSITY_COLUMN = 4
CAPTION_DROP = 0.03             # caption line below the card top
CARD_ROUNDING = 0.012
CARD_SHADOW = 0.006
TITLE_POSITION = (0.025, 0.935)
HINT_POSITION = (0.025, 0.893)
BLOCK_NOTE_POSITION = (0.035, 0.05)
# The table and the E1 and E2 against Vf chart in the properties figure.
TABLE_NAME_X = 0.01
TABLE_COLUMNS_X = (0.275, 0.36, 0.445, 0.545)
TABLE_COLUMN_WIDTH = 0.08
TABLE_TOP = 0.93
TABLE_ROW = 0.108
MODEL_NOTE_POSITION = (0.01, 0.04)
VF_TITLE_POSITION = (0.635, 0.93)
VF_AXES = (0.71, 0.2, 0.26, 0.54)
VF_LEGEND_ANCHOR = (-0.02, 1.04)
BARS_AXES = (0.09, 0.14, 0.89, 0.71)
BAR_LEGEND_ANCHOR = (0.0, 1.03)    # one row, left, above the bars
# Axis names on three block edges: (text, place as a part of the block size,
# direction out of the block). The name stands LABEL_GAP from the edge.
AXIS_LABELS = (("axis 1 (fibers)", (0.5, 0.0, 0.0), (0, -1, -1)),
               ("axis 2", (1.0, 0.5, 0.0), (1, 0, -1)),
               ("axis 3", (1.0, 1.0, 0.5), (1, 1, 0)))
LABEL_GAP = 0.9


# =============================================================================
# Material constants (all moduli in GPa)
# =============================================================================


def shear_modulus(e: float, nu: float) -> float:
    """Return the shear modulus of an isotropic material."""
    return e / (2.0 * (1.0 + nu))


def plane_bulk_modulus(e: float, nu: float) -> float:
    """Return the plane-strain bulk modulus of an isotropic material."""
    return e / (2.0 * (1.0 - 2.0 * nu) * (1.0 + nu))


def isotropic_fiber(e: float, nu: float) -> Fiber:
    """Return the fiber constants of an isotropic material."""
    return Fiber(e, e, nu, nu, shear_modulus(e, nu))


def fiber_g23(fiber: Fiber) -> float:
    """Return the transverse shear modulus G23 = E2 / (2 (1 + ν23))."""
    return shear_modulus(fiber.e2, fiber.nu23)


def fiber_bulk_modulus(fiber: Fiber) -> float:
    """Return the fiber plane-strain bulk modulus K23 (no strain along axis 1).

    K23 = (C22 + C23) / 2 (Chawla T10.1), so
    K23 = E2 / (2 (1 - ν23 - 2 ν12² E2 / E1)).
    An isotropic fiber gives E / (2 (1 - 2ν)(1 + ν)) (Kaw Eq. 3.108).
    """
    return fiber.e2 / (2.0 * (1.0 - fiber.nu23
                              - 2.0 * fiber.nu12 ** 2 * fiber.e2 / fiber.e1))


def stiffness_matrix(fiber: Fiber) -> np.ndarray:
    """Return the 6 x 6 fiber stiffness in the order 11, 22, 33, 23, 13, 12."""
    compliance = np.zeros((6, 6))
    compliance[0, 0] = 1.0 / fiber.e1
    compliance[1, 1] = compliance[2, 2] = 1.0 / fiber.e2
    compliance[0, 1:3] = compliance[1:3, 0] = -fiber.nu12 / fiber.e1
    compliance[1, 2] = compliance[2, 1] = -fiber.nu23 / fiber.e2
    compliance[3, 3] = 1.0 / fiber_g23(fiber)
    compliance[4, 4] = compliance[5, 5] = 1.0 / fiber.g12
    return np.linalg.inv(compliance)


def stiffness_moduli(fiber: Fiber) -> tuple[float, float]:
    """Return K23 and G23 from the stiffness matrix (Chawla T10.1)."""
    c = stiffness_matrix(fiber)
    return (c[1, 1] + c[1, 2]) / 2.0, (c[1, 1] - c[1, 2]) / 2.0


def bulk_from_constants(e1: float, e2: float, nu12: float, g23: float) -> float:
    """Return K23 from E1, E2, ν12, and G23 of a transversely isotropic material.

    Chawla T10.1: E2 = 4 G23 K23 / (K23 + φ G23), φ = 1 + 4 K23 ν12² / E1,
    solved for K23.
    """
    return e2 * g23 / (4.0 * g23 - e2 - 4.0 * e2 * g23 * nu12 ** 2 / e1)


# =============================================================================
# Homogenization models: a transversely isotropic fiber in an isotropic
# matrix. Each returns E1, E2, G12, G23, ν12, ν23.
# =============================================================================


def rule_of_mixtures(fiber: Fiber, em: float, num: float,
                     vf: float) -> tuple[float, ...]:
    """Return the properties by the rule of mixtures.

    Kaw (2005), Eqs. 3.55-3.59; E2: Jacquet (2000).
    This approach gives no G23 and no ν23: they are NaN ("–" in the table).
    """
    vm = 1.0 - vf
    gm = shear_modulus(em, num)
    root = np.sqrt(vf)
    e1 = vf * fiber.e1 + vm * em
    e2 = 1.0 / (root / (fiber.e2 * root + em * (1.0 - root)) + (1.0 - root) / em)
    g12 = fiber.g12 * gm / (gm * vf + fiber.g12 * vm)
    nu12 = vf * fiber.nu12 + vm * num
    return e1, e2, g12, np.nan, nu12, np.nan


def chamis(fiber: Fiber, em: float, num: float,
           vf: float) -> tuple[float, ...]:
    """Return the properties by Chamis (1983), Chawla T10.2."""
    vm = 1.0 - vf
    gm = shear_modulus(em, num)
    root = np.sqrt(vf)
    e1 = vf * fiber.e1 + vm * em
    e2 = em / (1.0 - root * (1.0 - em / fiber.e2))
    g12 = gm / (1.0 - root * (1.0 - gm / fiber.g12))
    g23 = gm / (1.0 - root * (1.0 - gm / fiber_g23(fiber)))
    nu12 = vf * fiber.nu12 + vm * num
    nu23 = e2 / (2.0 * g23) - 1.0
    return e1, e2, g12, g23, nu12, nu23


def cca(fiber: Fiber, em: float, num: float,
        vf: float) -> tuple[float, ...]:
    """Return the properties by the composite cylinder assemblage.

    Hashin and Rosen (1964); G23: Christensen (1979); Kaw Eqs. 3.104-3.112.
    The fiber Kf is the transversely isotropic K23, not the isotropic form.
    Only then CCA gives back the fiber at Vf = 1 and agrees with MT.
    """
    vm = 1.0 - vf
    gm = shear_modulus(em, num)
    gf12, gf23, nuf = fiber.g12, fiber_g23(fiber), fiber.nu12
    kf, km = fiber_bulk_modulus(fiber), plane_bulk_modulus(em, num)
    mix = vf / km + 1.0 / gm + vm / kf
    e1 = vf * fiber.e1 + vm * em + 4.0 * vf * vm * (nuf - num) ** 2 / mix
    nu12 = vf * nuf + vm * num + vf * vm * (nuf - num) * (1.0 / km - 1.0 / kf) / mix
    g12 = gm * (gf12 * (1.0 + vf) + gm * vm) / (gf12 * vm + gm * (1.0 + vf))
    # G23 is a plane problem in the 2-3 plane. There each phase is an
    # isotropic plane with K23 and G23, so η = 1 + 2 G23 / K23 (= 3 - 4ν for
    # an isotropic phase, Kaw Eq. 3.112).
    eta_m, eta_f, mu = 3.0 - 4.0 * num, 1.0 + 2.0 * gf23 / kf, gf23 / gm
    common = 3.0 * vf * vm ** 2 * (mu - 1.0) * (mu + eta_f)
    cube = (mu * eta_m - eta_f) * vf ** 3
    a = (common + (mu * eta_m + eta_f * eta_m - cube)
         * (eta_m * vf * (mu - 1.0) - (mu * eta_m + 1.0)))
    b = (-common + 0.5 * (mu * eta_m + 1.0 + (mu - 1.0) * vf)
         * ((eta_m - 1.0) * (mu + eta_f) - 2.0 * cube)
         + 0.5 * (eta_m + 1.0) * vf * (mu - 1.0) * (mu + eta_f + cube))
    c = common + (mu * eta_m + (mu - 1.0) * vf + 1.0) * (mu + eta_f + cube)
    g23 = gm * (-b - np.sqrt(b ** 2 - a * c)) / a
    k23 = ((km * (kf + gm) * vm + kf * (km + gm) * vf)
           / ((kf + gm) * vm + (km + gm) * vf))
    m = 1.0 + 4.0 * k23 * nu12 ** 2 / e1
    nu23 = (k23 - m * g23) / (k23 + m * g23)
    e2 = 2.0 * (1.0 + nu23) * g23
    return e1, e2, g12, g23, nu12, nu23


def mori_tanaka(fiber: Fiber, em: float, num: float,
                vf: float) -> tuple[float, ...]:
    """Return the properties by Mori-Tanaka, Abaimov (2016)."""
    vm = 1.0 - vf
    ef1, ef2, nuf12, nuf23, gf12 = fiber
    z1 = 1.0 / (-2.0 * vm * nuf12 ** 2 / ef1 + vm * (1.0 - nuf23) / ef2
                + (1.0 + num) * (1.0 + vf * (1.0 - 2.0 * num)) / em)
    z2 = ef2 * (3.0 + vf - 4.0 * num) * (1.0 + num) + vm * em * (1.0 + nuf23)
    e1 = vf * ef1 + vm * em + 2.0 * vf * vm * z1 * (nuf12 - num) ** 2
    e2 = e1 / ((1.0 - num ** 2) * (
        1.0 / (1.0 - num ** 2)
        + 2.0 * vf * e1 * (1.0 + nuf23 - ef2 * (1.0 + num) / em) / z2
        + vf * z1 * ef1 * ((1.0 + num) / em - 2.0 / ef1 + (1.0 - nuf23) / ef2)
        / em))
    nu12 = num + 2.0 * vf * z1 * (nuf12 - num) * (1.0 - num ** 2) / em
    inner = 1.0 - 2.0 * z1 * (vf * ef1 * (1.0 - num ** 2)
                              + vm * em * (1.0 - nuf12 ** 2)) / (ef1 * em)
    nu23 = 1.0 - e2 * (2.0 + 2.0 * vf * ef1 * (1.0 - num ** 2) / (vm * em) * inner
                       - e1 * (1.0 + num) / em) / e1
    g12 = (em * (1.0 + vf - 4.0 * vf / (1.0 + vf + 2.0 * vm * gf12 * (1.0 + num) / em))
           / (2.0 * vm * (1.0 + num)))
    # The same as vf / (vm / (8 (1 - νm²)) + 1 / d), without 1/0 when Gf = Gm.
    d = em / fiber_g23(fiber) - 2.0 * (1.0 + num)
    g23 = em / (2.0 * (1.0 + num) + vf * d / (1.0 + vm * d / (8.0 * (1.0 - num ** 2))))
    return e1, e2, g12, g23, nu12, nu23


MODELS = (rule_of_mixtures, chamis, cca, mori_tanaka)


def all_models(fiber: Fiber, em: float, num: float, vf: float) -> np.ndarray:
    """Return a 4 x 6 array: one row of properties for each model."""
    return np.array([model(fiber, em, num, vf) for model in MODELS])


def modulus_curves(model: int, fiber: Fiber, em: float, num: float
                   ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return Vf from 0 to the slider maximum, and E1 and E2 at each Vf."""
    vfs = np.linspace(0.0, INPUTS[VF_INDEX].high, VF_POINTS)
    props = np.array([MODELS[model](fiber, em, num, vf) for vf in vfs])
    return vfs, props[:, 0], props[:, 1]


def bar_values(fiber: Fiber, em: float, props: np.ndarray) -> np.ndarray:
    """Return the bar heights: rows fiber, composite, matrix, metals; E1, E2.

    The matrix and the metals are isotropic: E1 = E2 = E.
    """
    rows = [(fiber.e1, fiber.e2), tuple(props[:2]), (em, em)]
    rows += [(modulus, modulus) for _, modulus, _ in REFERENCE_METALS]
    return np.array(rows, dtype=float)


def composite_density(rho_f: float, rho_m: float, vf: float) -> float:
    """Return the composite density ρf Vf + ρm Vm (Kaw Eq. 3.8)."""
    return rho_f * vf + rho_m * (1.0 - vf)


def bar_densities(rho_f: float, rho_m: float, vf: float) -> np.ndarray:
    """Return the densities in the bar order: fiber, composite, matrix, metals."""
    metals = [rho for _, _, rho in REFERENCE_METALS]
    return np.array([rho_f, composite_density(rho_f, rho_m, vf), rho_m, *metals])


def axial_and_bulk(props: np.ndarray) -> tuple[float, ...]:
    """Return E1, ν12, G12, and K23 of one model result."""
    e1, e2, g12, g23, nu12, _ = props
    return e1, nu12, g12, bulk_from_constants(e1, e2, nu12, g23)


# =============================================================================
# Inputs and material lists
# =============================================================================


def split_inputs(values: list[float]) -> tuple[Fiber, float, float, float]:
    """Return the fiber, the matrix E and ν, and Vf from the input values."""
    fiber = Fiber(*(values[index] for index in FIBER_CONSTANTS))
    em, num = (values[index] for index in MATRIX_CONSTANTS)
    return fiber, em, num, values[VF_INDEX]


def input_densities(values: list[float]) -> tuple[float, float]:
    """Return the fiber and the matrix density from the input values."""
    rho_f, rho_m = (values[index] for index in DENSITY_INDICES)
    return rho_f, rho_m


def preset_fiber(name: str) -> Fiber:
    """Return the elastic constants of a fiber in the list (no density)."""
    values = preset_values(FIBER_PRESETS, name)
    return Fiber(*values[:len(FIBER_CONSTANTS)])


def material_of(index: int) -> int | None:
    """Return the material (0 fiber, 1 matrix) of an input; None for Vf."""
    for material, indices in enumerate(MATERIAL_INPUTS):
        if index in indices:
            return material
    return None


def limited_e2(e1: float, e2: float) -> float:
    """Return E2, no larger than E1: then the fiber constants stay valid."""
    return min(e1, e2)


def preset_names(presets: tuple[tuple, ...]) -> tuple[str, ...]:
    """Return the names in a material list, with the custom choice last."""
    return (*(preset[0] for preset in presets), CUSTOM_NAME)


def preset_values(presets: tuple[tuple, ...],
                  name: str) -> tuple[float, ...] | None:
    """Return the values of a named material; None for the custom choice."""
    for preset in presets:
        if preset[0] == name:
            return preset[1:]
    return None


def matching_preset(presets: tuple[tuple, ...],
                    values: tuple[float, ...]) -> str:
    """Return the name of the material with these values, or the custom name."""
    for preset in presets:
        if preset[1:] == tuple(values):
            return preset[0]
    return CUSTOM_NAME


def default_inputs() -> list[float]:
    """Return the start inputs: the default fiber and matrix, and Vf."""
    values = [0.0] * len(INPUTS)
    for material, name in enumerate(DEFAULT_PRESETS):
        preset = preset_values(PRESETS[material], name)
        for index, value in zip(MATERIAL_INPUTS[material], preset):
            values[index] = value
    values[VF_INDEX] = DEFAULT_VF
    return values


def input_digits(index: int) -> int:
    """Return the decimals of an input: moduli 1, ν 3, Vf 2, densities 2."""
    if index in MODULUS_INDICES:
        return MODULUS_DIGITS
    if index in POISSON_INDICES:
        return POISSON_DIGITS
    if index in DENSITY_INDICES:
        return DENSITY_DIGITS
    return VF_DIGITS


def input_unit(index: int) -> str:
    """Return the unit of an input: GPa, g/cm³, or no unit."""
    if index in MODULUS_INDICES:
        return MODULUS_UNIT
    if index in DENSITY_INDICES:
        return DENSITY_UNIT
    return ""


def input_value(index: int, value: float) -> float:
    """Return an input rounded as it is shown, for all the calculations."""
    return round(value, input_digits(index))


def input_number(index: int, value: float) -> str:
    """Return an input as a number text, rounded as it is shown, with no unit.

    A ν with a zero third decimal shows 2 decimals: 0.30, but 0.279.
    """
    text = f"{value:.{input_digits(index)}f}"
    if index in POISSON_INDICES and text.endswith("0"):
        text = text[:-1]
    return text


def parse_input(index: int, text: str) -> float | None:
    """Return a typed input, rounded and in its range; None if it is no number."""
    unit = input_unit(index)
    if unit:
        text = text.replace(unit, "")
    try:
        value = float(text.replace(",", ".").strip())
    except ValueError:
        return None
    if not np.isfinite(value):
        return None
    spec = INPUTS[index]
    return input_value(index, min(max(value, spec.low), spec.high))


def preset_fits(material: int, values: tuple[float, ...]) -> bool:
    """Return True if listed values fit the sliders, keep digits, and E2 <= E1."""
    for index, value in zip(MATERIAL_INPUTS[material], values):
        spec = INPUTS[index]
        if not spec.low <= value <= spec.high or input_value(index, value) != value:
            return False
    if material == 0:
        return limited_e2(values[FIBER_E1], values[FIBER_E2]) == values[FIBER_E2]
    return True


def property_text(index: int, value: float) -> str:
    """Return one table value: moduli with 2 decimals, ν with 3, NaN as –."""
    if np.isnan(value):
        return "–"
    return f"{value:.2f}" if index < 4 else f"{value:.3f}"


def bar_text(value: float) -> str:
    """Return one bar value: no decimals from 100 GPa, 1 below, NaN as –."""
    if np.isnan(value):
        return "–"
    return f"{value:.0f}" if value >= BAR_WHOLE_FROM else f"{value:.1f}"


def installed_fonts(names: tuple[str, ...]) -> list[str]:
    """Return the fonts of names that the computer has, in the same order."""
    installed = {entry.name for entry in font_manager.fontManager.ttflist}
    return [name for name in names if name in installed]


def style_axes(ax: object, grid_axis: str = "both") -> None:
    """Give a chart light grid lines and no top or right border."""
    ax.grid(axis=grid_axis, color=GRID_COLOR, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(colors=MUTED_COLOR, labelsize=SMALL_SIZE)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID_COLOR)


def style_bar_axes(ax: object) -> None:
    """Give the bar chart quiet axes: value grid lines and a zero line only."""
    ax.grid(axis="y", color=GRID_COLOR, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.yaxis.set_major_locator(MaxNLocator(BAR_TICKS))
    ax.tick_params(axis="y", length=0, colors=MUTED_COLOR,
                   labelsize=SMALL_SIZE - 1)
    ax.tick_params(axis="x", length=0, labelcolor=INK_COLOR,
                   labelsize=SMALL_SIZE, pad=6)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(BASELINE_COLOR)


def data_per_pixel(ax: object) -> tuple[float, float]:
    """Return the data units of one pixel along x and along y of a chart."""
    box = ax.get_window_extent()
    (x0, x1), (y0, y1) = ax.get_xlim(), ax.get_ylim()
    return (x1 - x0) / box.width, (y1 - y0) / box.height


def rounded_bar(left: float, width: float, height: float, rx: float,
                ry: float) -> Path:
    """Return a bar outline with round top corners and a square base.

    rx and ry are the corner sizes in data units. A corner with the same
    size in pixels needs two data sizes, because x and y have two scales.
    """
    rx, ry = min(rx, width / 2.0), min(ry, height)
    right = left + width
    vertices = [(left, 0.0), (left, height - ry), (left, height),
                (left + rx, height), (right - rx, height), (right, height),
                (right, height - ry), (right, 0.0), (left, 0.0)]
    codes = [Path.MOVETO, Path.LINETO, Path.CURVE3, Path.CURVE3, Path.LINETO,
             Path.CURVE3, Path.CURVE3, Path.LINETO, Path.CLOSEPOLY]
    return Path(vertices, codes)


# =============================================================================
# The RVE block (axis 1: fibers, axis 2: width, axis 3: height)
# =============================================================================


def block_size() -> tuple[float, float]:
    """Return the width (axis 2) and the height (axis 3) of the block."""
    return BLOCK_WIDTH, BLOCK_HEIGHT


def fiber_spacing(vf: float) -> float:
    """Return the distance a between two fiber centers.

    A hexagonal cell of a x a√3 holds two fibers, so Vf = 2πr²/(√3a²).
    """
    return FIBER_RADIUS * np.sqrt(2.0 * np.pi / (np.sqrt(3.0) * vf))


def hex_centers(vf: float) -> np.ndarray:
    """Return the centers (axis 2, axis 3) of the fibers that can touch the block.

    The hexagonal pattern has one fiber in the middle of the block, so the
    fibers are symmetric about both block center lines.
    """
    width, height = block_size()
    spacing = fiber_spacing(vf)
    row_step = spacing * np.sqrt(3.0) / 2.0
    rows = int(np.ceil((height / 2.0 + FIBER_RADIUS) / row_step))
    columns = int(np.ceil((width / 2.0 + FIBER_RADIUS) / spacing)) + 1
    centers = []
    for row in range(-rows, rows + 1):
        shift = spacing / 2.0 if row % 2 else 0.0
        for column in range(-columns, columns + 1):
            y = width / 2.0 + shift + column * spacing
            z = height / 2.0 + row * row_step
            if (-FIBER_RADIUS < y < width + FIBER_RADIUS
                    and -FIBER_RADIUS < z < height + FIBER_RADIUS):
                centers.append((y, z))
    return np.array(centers)


def fiber_circle(center: np.ndarray) -> np.ndarray:
    """Return the outline (axis 2, axis 3) of one full fiber."""
    angles = np.linspace(0.0, 2.0 * np.pi, ARC_POINTS, endpoint=False)
    return np.column_stack([center[0] + FIBER_RADIUS * np.cos(angles),
                            center[1] + FIBER_RADIUS * np.sin(angles)])


def clip_to_block(points: np.ndarray) -> np.ndarray:
    """Return the part of a polygon (axis 2, axis 3) in the block cross section.

    Sutherland and Hodgman (1974), "Reentrant polygon clipping",
    Communications of the ACM 17(1): cut the polygon at each block edge in
    turn. Keep the points inside; add a point where a side crosses the edge.
    """
    width, height = block_size()
    # (axis, edge value, +1 if the inside is above the value, -1 if below)
    edges = ((0, 0.0, 1.0), (0, width, -1.0), (1, 0.0, 1.0), (1, height, -1.0))
    for axis, limit, inside in edges:
        kept = []
        for start, end in zip(points, np.roll(points, -1, axis=0)):
            start_in = inside * (start[axis] - limit) >= 0.0
            end_in = inside * (end[axis] - limit) >= 0.0
            if start_in:
                kept.append(start)
            if start_in != end_in:
                t = (limit - start[axis]) / (end[axis] - start[axis])
                kept.append(start + t * (end - start))
        points = np.array(kept).reshape(-1, 2)
    return points


def fiber_sections(vf: float) -> list[np.ndarray]:
    """Return the outline of each fiber part on the block cross section."""
    parts = [clip_to_block(fiber_circle(center)) for center in hex_centers(vf)]
    return [part for part in parts if len(part) >= 3]


def polygon_area(points: np.ndarray) -> float:
    """Return the area of a polygon (Wikipedia, "Shoelace formula")."""
    y, z = points[:, 0], points[:, 1]
    return 0.5 * abs(float(np.dot(y, np.roll(z, -1)) - np.dot(z, np.roll(y, -1))))


def block_vf(vf: float) -> float:
    """Return the fiber area of the block cross section over its area."""
    width, height = block_size()
    return sum(polygon_area(part) for part in fiber_sections(vf)) / (width * height)


def plane_quad(axis: int, value: float, u_range: tuple[float, float],
               v_range: tuple[float, float]) -> np.ndarray:
    """Return a rectangle in the plane axis = value (the other two in order)."""
    corners = np.array([(u_range[0], v_range[0]), (u_range[1], v_range[0]),
                        (u_range[1], v_range[1]), (u_range[0], v_range[1])])
    return np.insert(corners, axis, value, axis=1)


def block_faces(vf: float) -> list[tuple]:
    """Return the six block faces: (axis, side, matrix rectangle, fiber parts).

    side is -1 or +1: the direction of the outward normal along the axis.
    The faces across the fibers show the cut circles. The side faces show
    a strip for each fiber that crosses them.
    """
    width, height = block_size()
    size = (BLOCK_LENGTH, width, height)
    sections = fiber_sections(vf)
    centers = hex_centers(vf)
    faces = []
    for side in (-1, 1):
        x = size[0] if side > 0 else 0.0
        parts = [np.insert(part, 0, x, axis=1) for part in sections]
        faces.append((0, side, plane_quad(0, x, (0.0, width), (0.0, height)),
                      parts))
    for axis, other in ((1, 2), (2, 1)):
        for side in (-1, 1):
            value = size[axis] if side > 0 else 0.0
            parts = []
            for center in centers:
                # A fiber at a distance d from the face plane cuts it in a
                # strip of width 2√(r² - d²).
                distance = center[axis - 1] - value
                if abs(distance) >= FIBER_RADIUS:
                    continue
                half = np.sqrt(FIBER_RADIUS ** 2 - distance ** 2)
                low = max(center[other - 1] - half, 0.0)
                high = min(center[other - 1] + half, size[other])
                if high > low:
                    parts.append(plane_quad(axis, value, (0.0, size[0]),
                                            (low, high)))
            faces.append((axis, side, plane_quad(
                axis, value, (0.0, size[0]), (0.0, size[3 - axis])), parts))
    return faces


def view_direction(elevation: float, azimuth: float) -> np.ndarray:
    """Return the unit vector from the block to the eye (angles in degrees)."""
    el, az = np.radians(elevation), np.radians(azimuth)
    return np.array([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)])


def shaded(color: str, factor: float) -> tuple[float, float, float]:
    """Return a color made darker by factor (1: the same color)."""
    return tuple(factor * channel for channel in to_rgb(color))


# =============================================================================
# Interactive application
# =============================================================================


class RveApp:
    """One window: inputs and the 3D RVE on the left, the results on the right."""

    def __init__(self, root: tk.Tk,
                 screen: tuple[int, int] | None = None) -> None:
        """Create the window, the widgets, and the first drawing.

        screen is the screen size in pixels. None uses the real screen.
        """
        self.root = root
        self.values = default_inputs()
        self.input_values = [tk.DoubleVar(value=value) for value in self.values]
        self.entry_texts = [tk.StringVar() for _ in self.values]
        self.choices = [tk.StringVar(value=name) for name in DEFAULT_PRESETS]
        self.g23_text = tk.StringVar()
        self.model = tk.IntVar(value=DEFAULT_MODEL)
        self.bar_view = tk.IntVar(value=SPECIFIC_VIEW)
        self.results = np.zeros((len(MODEL_NAMES), len(PROPERTY_NAMES)))
        self.faces = []
        self.drawn_vf = None
        if screen is None:
            screen = (root.winfo_screenwidth(), root.winfo_screenheight())
        self.scale = UI_SCALE
        width = min(WINDOW_MAX[0], int(WINDOW_FRACTION[0] * screen[0]))
        height = min(WINDOW_MAX[1], int(WINDOW_FRACTION[1] * screen[1]))
        # A fixed value, not the value of the screen: the fonts keep their size.
        root.tk.call("tk", "scaling", UI_SCALE * POINT_PIXELS)
        root.title(APP_TITLE)
        root.geometry(f"{width}x{height}+{(screen[0] - width) // 2}+0")
        root.configure(background=BG_COLOR)
        rcParams["font.family"] = installed_fonts(PLOT_FONTS)
        self._create_styles()
        self._create_figure()
        self._create_inputs()
        self._create_vf_input()
        self._create_model_choice()
        self._create_bar_view()
        self._update()

    # ----------------------------------------------------------------- setup

    def _create_styles(self) -> None:
        """Give the material list boxes a flat look that fits the white cards."""
        style = ttk.Style(self.root)
        style.theme_use(COMBO_THEME)
        for option, value in (("font", UI_FONT), ("background", CARD_COLOR),
                              ("foreground", INK_COLOR),
                              ("selectBackground", HIGHLIGHT_COLOR),
                              ("selectForeground", INK_COLOR)):
            self.root.option_add(f"*TCombobox*Listbox.{option}", value)
        for name, color in zip(MATERIAL_NAMES, MATERIAL_COLORS):
            style_name = f"{name}.TCombobox"
            style.configure(style_name, foreground=color, background=CARD_COLOR,
                            fieldbackground=CARD_COLOR, arrowcolor=color,
                            bordercolor=TROUGH_COLOR, lightcolor=CARD_COLOR,
                            darkcolor=CARD_COLOR, padding=COMBO_PADDING)
            style.map(style_name,
                      fieldbackground=[("readonly", CARD_COLOR)],
                      foreground=[("readonly", color)],
                      selectbackground=[("readonly", CARD_COLOR)],
                      selectforeground=[("readonly", color)],
                      background=[("active", HIGHLIGHT_COLOR)],
                      bordercolor=[("focus", color)])

    def _create_figure(self) -> None:
        """Create the page figure with the cards and one figure per chart."""
        self.fig = Figure(dpi=self.scale * FIGURE_DPI, facecolor=BG_COLOR)
        self.cards = []
        cards = ((INPUTS_CARD, INPUTS_CAPTION), (BLOCK_CARD, BLOCK_CAPTION),
                 (PROPS_CARD, TABLE_CAPTION), (BARS_CARD, BARS_CAPTION))
        for box, caption in cards:
            self._add_card(box)
            self.fig.text(box[0] + 0.012, box[1] + box[3] - CAPTION_DROP, caption,
                          fontsize=SMALL_SIZE, fontweight="bold", va="center",
                          color=MUTED_COLOR)
        self.fig.text(*TITLE_POSITION, APP_TITLE, fontsize=TITLE_SIZE,
                      fontweight="bold", color=INK_COLOR)
        self.fig.text(*HINT_POSITION, APP_HINT, fontsize=NOTE_SIZE,
                      color=MUTED_COLOR)
        self.fig.text(*BLOCK_NOTE_POSITION, BLOCK_NOTE, fontsize=SMALL_SIZE,
                      color=MUTED_COLOR, wrap=True)
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.root)
        self.canvas.get_tk_widget().configure(background=BG_COLOR,
                                              highlightthickness=0)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        self.canvas.mpl_connect("resize_event", self._on_resize)
        self.block_fig, self.block_canvas = self._chart(BLOCK_PLACE)
        self.ax_block = self.block_fig.add_axes((0.0, 0.0, 1.0, 1.0),
                                                projection="3d")
        self.props_fig, self.props_canvas = self._chart(PROPS_PLACE)
        self.ax_vf = self.props_fig.add_axes(VF_AXES)
        self.bars_fig, self.bars_canvas = self._chart(BARS_PLACE)
        self.ax_bars = self.bars_fig.add_axes(BARS_AXES)
        self.bars_canvas.mpl_connect("resize_event", self._on_bars_resize)
        self._create_block()
        self._create_table()

    def _chart(self, place: tuple[float, ...]) -> tuple[Figure, FigureCanvasTkAgg]:
        """Create a small figure on top of the page figure."""
        fig = Figure(dpi=self.scale * FIGURE_DPI, facecolor=CARD_COLOR)
        canvas = FigureCanvasTkAgg(fig, master=self.canvas.get_tk_widget())
        canvas.get_tk_widget().configure(background=CARD_COLOR,
                                         highlightthickness=0)
        self._place(canvas.get_tk_widget(), place)
        return fig, canvas

    def _place(self, widget: tk.Widget, place: tuple[float, ...]) -> None:
        """Place a widget on the page at figure fractions (left, bottom, w, h)."""
        widget.place(relx=place[0], rely=1.0 - place[1] - place[3],
                     relwidth=place[2], relheight=place[3])

    def _frame(self, place: tuple[float, ...]) -> tk.Frame:
        """Create a white frame on a card for tkinter widgets."""
        frame = tk.Frame(self.canvas.get_tk_widget(), background=CARD_COLOR)
        self._place(frame, place)
        return frame

    def _create_inputs(self) -> None:
        """Create the material lists, the sliders, and the G23 value."""
        frame = self._frame(INPUTS_PLACE)
        frame.columnconfigure((1, 5), weight=1, uniform="slider")
        frame.columnconfigure(3, minsize=2 * PAD)
        for material in range(len(MATERIAL_NAMES)):
            self._create_material_list(frame, material)
        for index, (row, column) in enumerate(INPUT_GRID):
            self._create_slider(frame, index, row, column)
        self._create_g23(frame)

    def _create_g23(self, frame: tk.Frame) -> None:
        """Create the G23 row: its name, a fixed note, and its value.

        The value has the fixed width of a value box in the value column, so
        no column moves when the value changes.
        """
        row, column = G23_GRID
        self._name_label(frame, "G", "23", FIBER_TEXT).grid(
            row=row, column=column, sticky=tk.W, padx=(0, 4))
        tk.Label(frame, text=G23_NOTE, font=UI_FONT, foreground=MUTED_COLOR,
                 background=CARD_COLOR).grid(row=row, column=column + 1,
                                             sticky=tk.W)
        box = tk.Frame(frame, background=CARD_COLOR)
        tk.Label(box, textvariable=self.g23_text, width=ENTRY_WIDTH,
                 font=UI_FONT, anchor=tk.E, foreground=FIBER_TEXT,
                 background=CARD_COLOR).pack(side=tk.LEFT)
        tk.Label(box, text=MODULUS_UNIT, font=UI_FONT, foreground=FIBER_TEXT,
                 background=CARD_COLOR).pack(side=tk.LEFT, padx=(3, 0))
        box.grid(row=row, column=column + 2, sticky=tk.W, padx=(6, 0))

    def _create_material_list(self, frame: tk.Frame, material: int) -> None:
        """Create one material row: its name and list box, then its density.

        The density sits in the name, slider, and value columns of the right
        half, as the G23 row does.
        """
        name, color = MATERIAL_NAMES[material], MATERIAL_COLORS[material]
        row = HEADER_ROWS[material]
        pady = (HEADER_GAP if material else 0, HEADER_PAD)
        header = tk.Frame(frame, background=CARD_COLOR)
        header.grid(row=row, column=0, columnspan=HEADER_SPAN, sticky=tk.W,
                    pady=pady)
        tk.Label(header, text=name, font=UI_BOLD, foreground=color,
                 background=CARD_COLOR).pack(side=tk.LEFT, padx=(0, 8))
        box = ttk.Combobox(header, textvariable=self.choices[material],
                           values=preset_names(PRESETS[material]),
                           state="readonly", width=COMBO_WIDTH, font=UI_FONT,
                           style=f"{name}.TCombobox", cursor="hand2")
        box.pack(side=tk.LEFT)
        box.bind("<<ComboboxSelected>>",
                 lambda _event, k=material, b=box: self._on_material(k, b))
        index = DENSITY_INDICES[material]
        spec = INPUTS[index]
        self._name_label(frame, spec.name, spec.subscript, color).grid(
            row=row, column=DENSITY_COLUMN, sticky=tk.W, padx=(0, 4), pady=pady)
        tk.Label(frame, text=DENSITY_NOTE, font=UI_FONT, foreground=MUTED_COLOR,
                 background=CARD_COLOR).grid(row=row, column=DENSITY_COLUMN + 1,
                                             sticky=tk.W, pady=pady)
        self._create_entry(frame, index).grid(row=row, column=DENSITY_COLUMN + 2,
                                              sticky=tk.W, padx=(6, 0), pady=pady)

    def _create_vf_input(self) -> None:
        """Create the Vf slider below the RVE block."""
        frame = self._frame(VF_PLACE)
        frame.columnconfigure(1, weight=1)
        self._create_slider(frame, VF_INDEX, 0, 0)

    def _create_slider(self, frame: tk.Frame, index: int, row: int,
                       column: int) -> None:
        """Create the name, the slider, and the value box of one input."""
        spec = INPUTS[index]
        color = INPUT_COLORS[index]
        self._name_label(frame, spec.name, spec.subscript, color).grid(
            row=row, column=column, sticky=tk.W, padx=(0, 4))
        tk.Scale(frame, from_=spec.low, to=spec.high, resolution=spec.step,
                 orient=tk.HORIZONTAL, showvalue=False,
                 variable=self.input_values[index],
                 command=lambda text, k=index: self._on_input(k, float(text)),
                 background=color, troughcolor=TROUGH_COLOR,
                 highlightthickness=0, borderwidth=0, sliderrelief=tk.FLAT,
                 sliderlength=16, width=12, cursor="hand2").grid(
            row=row, column=column + 1, sticky=tk.EW, pady=SLIDER_PAD)
        self._create_entry(frame, index).grid(row=row, column=column + 2,
                                              sticky=tk.W, padx=(6, 0))

    def _create_entry(self, parent: tk.Frame, index: int) -> tk.Frame:
        """Create the typed value box of one input, with its unit if it has one."""
        box = tk.Frame(parent, background=CARD_COLOR)
        color = INPUT_COLORS[index]
        entry = tk.Entry(box, textvariable=self.entry_texts[index],
                         width=ENTRY_WIDTH, font=UI_FONT, justify=tk.RIGHT,
                         foreground=color, background=CARD_COLOR,
                         insertbackground=color, relief=tk.FLAT,
                         highlightthickness=1, highlightbackground=TROUGH_COLOR,
                         highlightcolor=color)
        entry.pack(side=tk.LEFT)
        for event in ("<Return>", "<KP_Enter>", "<FocusOut>"):
            entry.bind(event, lambda _event, k=index: self._on_entry(k))
        unit = input_unit(index)
        if unit:
            tk.Label(box, text=unit, font=UI_FONT, foreground=color,
                     background=CARD_COLOR).pack(side=tk.LEFT, padx=(3, 0))
        return box

    def _name_label(self, parent: tk.Frame, name: str, subscript: str,
                    color: str) -> tk.Frame:
        """Create a bold name with optional small lowered letters after it."""
        box = tk.Frame(parent, background=CARD_COLOR)
        for text, font in ((name, UI_BOLD), (subscript, SUBSCRIPT_FONT)):
            if text:
                tk.Label(box, text=text, font=font, foreground=color,
                         background=CARD_COLOR, padx=0, borderwidth=0).pack(
                    side=tk.LEFT, anchor=tk.S)
        return box

    def _create_model_choice(self) -> None:
        """Create the radio buttons that select the model for the charts."""
        frame = self._frame(MODEL_PLACE)
        tk.Label(frame, text=MODEL_LABEL, font=UI_FONT, foreground=MUTED_COLOR,
                 background=CARD_COLOR).pack(side=tk.LEFT, padx=(4, PAD))
        for i, name in enumerate(MODEL_NAMES):
            tk.Radiobutton(frame, text=name, value=i, variable=self.model,
                           command=self._update, font=UI_FONT,
                           foreground=INK_COLOR, background=CARD_COLOR,
                           activebackground=CARD_COLOR, selectcolor=CARD_COLOR,
                           cursor="hand2").pack(side=tk.LEFT, padx=(0, PAD))

    def _create_bar_view(self) -> None:
        """Create the radio buttons that switch the bar chart: E/ρ or E."""
        frame = self._frame(BAR_VIEW_PLACE)
        tk.Label(frame, text=BAR_VIEW_LABEL, font=UI_FONT, foreground=MUTED_COLOR,
                 background=CARD_COLOR).pack(side=tk.LEFT, padx=(0, PAD // 2))
        for i, name in enumerate(BAR_VIEWS):
            tk.Radiobutton(frame, text=name, value=i, variable=self.bar_view,
                           command=self._update, font=UI_FONT,
                           foreground=INK_COLOR, background=CARD_COLOR,
                           activebackground=CARD_COLOR, selectcolor=CARD_COLOR,
                           cursor="hand2").pack(side=tk.LEFT, padx=(0, PAD // 2))

    def _create_block(self) -> None:
        """Set the fixed view of the 3D block and write the axis names."""
        ax = self.ax_block
        width, height = block_size()
        ax.set_proj_type("ortho")
        ax.computed_zorder = False
        ax.view_init(*VIEW)
        size = np.array([BLOCK_LENGTH, width, height])
        ax.set_xlim(0.0, size[0])
        ax.set_ylim(0.0, size[1])
        ax.set_zlim(0.0, size[2])
        # set_box_aspect scales its argument in place, so give it a copy.
        ax.set_box_aspect(size.copy(), zoom=BLOCK_ZOOM)
        ax.set_axis_off()
        ax.disable_mouse_rotation()
        for label, place, direction in AXIS_LABELS:
            point = np.array(place) * size + LABEL_GAP * np.array(direction)
            ax.text(*point, label, ha="center", va="center", color=MUTED_COLOR,
                    fontsize=SMALL_SIZE, fontweight="bold", zorder=5)

    def _create_table(self) -> None:
        """Create the table texts and the highlight of the selected model."""
        fig = self.props_fig
        rows = len(PROPERTY_NAMES)
        self.highlight = Rectangle(
            (0.0, TABLE_TOP - (rows + 0.5) * TABLE_ROW), TABLE_COLUMN_WIDTH,
            (rows + 1) * TABLE_ROW, transform=fig.transFigure,
            facecolor=HIGHLIGHT_COLOR, edgecolor="none", zorder=-1)
        fig.add_artist(self.highlight)
        self.headers = [fig.text(x, TABLE_TOP, name, ha="center", va="center",
                                 fontsize=TABLE_SIZE, color=MUTED_COLOR)
                        for x, name in zip(TABLE_COLUMNS_X, MODEL_NAMES)]
        self.cells = []
        for row, name in enumerate(PROPERTY_NAMES):
            y = TABLE_TOP - (row + 1) * TABLE_ROW
            fig.text(TABLE_NAME_X, y, name, va="center", fontsize=TABLE_SIZE,
                     fontweight="bold", color=INK_COLOR)
            self.cells.append([fig.text(x, y, "", ha="center", va="center",
                                        fontsize=TABLE_SIZE, color=INK_COLOR)
                               for x in TABLE_COLUMNS_X])
        fig.text(*MODEL_NOTE_POSITION, MODEL_NOTE, fontsize=SMALL_SIZE - 1,
                 color=MUTED_COLOR, va="bottom")
        fig.text(*VF_TITLE_POSITION, VF_CAPTION, fontsize=SMALL_SIZE,
                 fontweight="bold", color=MUTED_COLOR, va="center")

    def _add_card(self, box: tuple[float, ...]) -> None:
        """Add a white card with rounded corners and a soft shadow."""
        for shift, color, alpha in ((CARD_SHADOW, SHADOW_COLOR, SHADOW_ALPHA),
                                    (0.0, CARD_COLOR, 1.0)):
            card = FancyBboxPatch(
                (box[0], box[1] - shift), box[2], box[3],
                boxstyle=f"round,pad=0,rounding_size={CARD_ROUNDING}",
                transform=self.fig.transFigure, facecolor=color, alpha=alpha,
                edgecolor="none", zorder=-1)
            self.fig.add_artist(card)
            self.cards.append(card)

    # ------------------------------------------------------------- callbacks

    def _on_resize(self, _event: object) -> None:
        """Keep the card corners round when the window changes its shape."""
        width, height = self.fig.get_size_inches()
        for card in self.cards:
            card.set_mutation_aspect(width / height)

    def _on_bars_resize(self, _event: object) -> None:
        """Draw the bars again: their round corners have a size in pixels."""
        self._draw_bars(self.results[self.model.get()])

    def _on_entry(self, index: int) -> None:
        """Set one input from its typed box, and move the slider to it."""
        value = parse_input(index, self.entry_texts[index].get())
        if value is None or value == self.values[index]:
            # No number, or no change: show the present value again.
            self.entry_texts[index].set(input_number(index, self.values[index]))
            return
        self.input_values[index].set(value)
        self._on_input(index, value)

    def _on_input(self, index: int, value: float) -> None:
        """Set one input from its slider (rounded as shown) and compute again."""
        self.values[index] = input_value(index, value)
        if index in (FIBER_E1, FIBER_E2):
            self._limit_e2()
        material = material_of(index)
        if material is not None:
            self._match_material(material)
        self._update()

    def _limit_e2(self) -> None:
        """Keep the fiber E2 at or below E1, and move the E2 slider with it."""
        e2 = limited_e2(self.values[FIBER_E1], self.values[FIBER_E2])
        if e2 != self.values[FIBER_E2]:
            self.values[FIBER_E2] = e2
            self.input_values[FIBER_E2].set(e2)

    def _on_material(self, material: int, box: ttk.Combobox) -> None:
        """Set the material values from its list.

        "Custom" keeps the present values, so the user changes them from
        the material on the screen.
        """
        box.selection_clear()
        values = preset_values(PRESETS[material], self.choices[material].get())
        if values is None:
            return
        for index, value in zip(MATERIAL_INPUTS[material], values):
            self.values[index] = value
            self.input_values[index].set(value)
        self._update()

    def _match_material(self, material: int) -> None:
        """Show the listed material that has the present values, or "Custom"."""
        values = tuple(self.values[index] for index in MATERIAL_INPUTS[material])
        self.choices[material].set(matching_preset(PRESETS[material], values))

    # ---------------------------------------------------------------- update

    def _update(self) -> None:
        """Compute all models again and redraw the texts and the charts."""
        fiber, em, num, vf = split_inputs(self.values)
        self.results = all_models(fiber, em, num, vf)
        for i, value in enumerate(self.values):
            self.entry_texts[i].set(input_number(i, value))
        self.g23_text.set(f"{fiber_g23(fiber):.{MODULUS_DIGITS}f}")
        props = self.results[self.model.get()]
        self.canvas.draw_idle()
        if vf != self.drawn_vf:
            self._draw_block()
        self._fill_table()
        self._draw_vf(props)
        self._draw_bars(props)

    def _draw_block(self) -> None:
        """Draw the three block faces that face the eye, for the present Vf.

        They never overlap, so the drawing order does not matter.
        """
        for artist in self.faces:
            artist.remove()
        self.faces = []
        eye = view_direction(*VIEW)
        for axis, side, rectangle, parts in block_faces(self.values[VF_INDEX]):
            if side * eye[axis] <= 0.0:
                continue
            shade = FACE_SHADES[axis]
            matrix = Poly3DCollection([rectangle], facecolor=shaded(MATRIX_COLOR,
                                                                    shade),
                                      edgecolor=EDGE_COLOR, linewidth=0.8,
                                      zorder=1)
            fibers = Poly3DCollection(parts, facecolor=shaded(FIBER_COLOR, shade),
                                      edgecolor=shaded(FIBER_RIM, shade),
                                      linewidth=0.8, zorder=2)
            for artist in (matrix, fibers):
                self.ax_block.add_collection3d(artist)
                self.faces.append(artist)
        self.drawn_vf = self.values[VF_INDEX]
        self.block_canvas.draw_idle()

    def _fill_table(self) -> None:
        """Write the four models into the table and mark the selected one."""
        selected = self.model.get()
        for column, header in enumerate(self.headers):
            weight = "bold" if column == selected else "normal"
            header.set_fontweight(weight)
            header.set_color(INK_COLOR if column == selected else MUTED_COLOR)
            for row, cell in enumerate(self.cells):
                cell[column].set_text(property_text(row,
                                                    self.results[column, row]))
                cell[column].set_fontweight(weight)
        self.highlight.set_x(TABLE_COLUMNS_X[selected] - TABLE_COLUMN_WIDTH / 2.0)

    def _draw_vf(self, props: np.ndarray) -> None:
        """Draw E1 and E2 of the selected model against Vf, with circles at Vf."""
        ax = self.ax_vf
        ax.clear()
        fiber, em, num, vf = split_inputs(self.values)
        vfs, e1s, e2s = modulus_curves(self.model.get(), fiber, em, num)
        names = (f"E1 along = {props[0] / em:.1f} × matrix",
                 f"E2 across = {props[1] / em:.1f} × matrix")
        for values, now, style, name in ((e1s, props[0], "-", names[0]),
                                         (e2s, props[1], "--", names[1])):
            ax.plot(vfs, values, linestyle=style, color=COMPOSITE_COLOR,
                    linewidth=2.0, label=name)
            ax.plot(vf, now, "o", markersize=8, markerfacecolor=CARD_COLOR,
                    markeredgecolor=COMPOSITE_COLOR, markeredgewidth=2.0,
                    clip_on=False)
        ax.set_xlim(0.0, vfs[-1])
        ax.set_xticks(np.arange(0.0, vfs[-1] + VF_TICK / 2.0, VF_TICK))
        ax.set_ylim(0.0, 1.08 * max(e1s[-1], e2s[-1]))
        ax.set_xlabel(VF_TEXT, fontsize=SMALL_SIZE, color=MUTED_COLOR)
        ax.set_ylabel("E (GPa)", fontsize=SMALL_SIZE, color=MUTED_COLOR)
        # The notes stand just above the chart, next to their line styles.
        ax.legend(loc="lower left", bbox_to_anchor=VF_LEGEND_ANCHOR,
                  frameon=False, fontsize=SMALL_SIZE - 1, handlelength=1.8,
                  borderaxespad=0.0)
        style_axes(ax)
        self.props_canvas.draw_idle()

    def _draw_bars(self, props: np.ndarray) -> None:
        """Draw E1 and E2 (or E/ρ) of fiber, composite, matrix, metals as bars.

        Each bar has round top corners and its value on top, so a short
        matrix bar stays readable. A light band marks each group.
        """
        ax = self.ax_bars
        ax.clear()
        fiber, em, _, vf = split_inputs(self.values)
        heights = bar_values(fiber, em, props)
        view = self.bar_view.get()
        if view == SPECIFIC_VIEW:
            densities = bar_densities(*input_densities(self.values), vf)
            heights = heights / densities[:, np.newaxis]
        names = ("Fiber", f"Composite ({MODEL_NAMES[self.model.get()]})",
                 "Matrix", *(name for name, _, _ in REFERENCE_METALS))
        groups = np.arange(len(BAR_GROUPS))
        # The limits come first: the corner size in data units needs them.
        ax.set_xlim(-0.5, len(BAR_GROUPS) - 0.5)
        ax.set_ylim(0.0, BAR_HEADROOM * np.nanmax(heights))
        x_pixel, y_pixel = data_per_pixel(ax)
        for group in groups:
            ax.axvspan(group - BAND_HALF, group + BAND_HALF, color=BAND_COLOR,
                       linewidth=0.0, zorder=0.2)
        middle = (len(names) - 1) / 2.0
        for row, color in enumerate(BAR_COLORS):
            composite = row == 1
            spots = groups + (row - middle) * BAR_STEP
            for spot, value in zip(spots, heights[row]):
                outline = rounded_bar(spot - BAR_WIDTH / 2.0, BAR_WIDTH,
                                      float(np.nan_to_num(value)),
                                      BAR_CORNER * x_pixel, BAR_CORNER * y_pixel)
                ax.add_patch(PathPatch(outline, facecolor=color,
                                       edgecolor="none", zorder=2))
                ax.annotate(bar_text(value),
                            (spot, 0.0 if np.isnan(value) else value),
                            xytext=(0.0, BAR_LABEL_GAP),
                            textcoords="offset points", ha="center",
                            va="bottom", zorder=3,
                            fontsize=(COMPOSITE_VALUE_SIZE if composite
                                      else BAR_VALUE_SIZE),
                            color=INK_COLOR if composite else MUTED_COLOR,
                            fontweight="bold" if composite else "normal")
        ax.set_xticks(groups, BAR_GROUPS)
        ax.set_ylabel(BAR_Y_LABELS[view], fontsize=SMALL_SIZE - 1,
                      color=MUTED_COLOR)
        style_bar_axes(ax)
        handles = [Patch(facecolor=color, label=name)
                   for name, color in zip(names, BAR_COLORS)]
        ax.legend(handles=handles, loc="lower left",
                  bbox_to_anchor=BAR_LEGEND_ANCHOR, ncol=len(names),
                  frameon=False, fontsize=SMALL_SIZE - 1, labelcolor=INK_COLOR,
                  handlelength=0.9, handleheight=0.9, handletextpad=0.4,
                  columnspacing=1.2, borderaxespad=0.0)
        self.bars_canvas.draw_idle()


# =============================================================================
# Entry point
# =============================================================================


def main() -> None:
    """Open the interactive window."""
    root = tk.Tk()
    RveApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
