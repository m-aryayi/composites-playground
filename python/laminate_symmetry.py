"""Is it symmetric? See how the ply angles decide if a pulled laminate curls."""

import tkinter as tk

import numpy as np
from matplotlib import font_manager, rcParams
from matplotlib.backend_bases import MouseEvent
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.patches import FancyBboxPatch
from matplotlib.text import Annotation, Text
from mpl_toolkits.mplot3d import proj3d
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

# =============================================================================
# Configuration
# =============================================================================

APP_TITLE = "Composite laminate: symmetric or not?"
APP_HINT = ("A laminate is a stack of thin fiber plies. "
            "Click a ply and change its fiber angle.")
STACK_CAPTION = "PLY STACK   ·   top to bottom"

# Graphite/epoxy ply in MPa and mm, from Kaw (2005). All plies
# have the same material and thickness, so only the angles matter.
MATERIAL = {"E1": 181000.0, "E2": 10300.0, "nu12": 0.28, "G12": 7170.0}
PLY_THICKNESS = 0.125
PULL_LOAD = (100.0, 0.0, 0.0)

DEFAULT_ANGLES = (0.0, 45.0, 90.0)
MAX_PLIES = 12
LIMIT_NOTE = f"This app allows up to {MAX_PLIES} plies."

# Read-only window with the fixed inputs and the coupling matrix [B].
MATERIAL_NAME = "Graphite/epoxy (carbon fiber)"
REFERENCE_TEXT = ("Formulas and material data:  Kaw, A. K. (2005). Mechanics "
                  "of Composite Materials (2nd ed.). CRC Press, Boca Raton.")
B_BUTTON = "Show [B], A16, A26"
POPUP_TITLE = "[B] and balance"
B_FORMULA = "[B] = ½ · Σ [Q̄] · (z_bottom² − z_top²)"
B_FORMULA_NOTE = "One term for each ply. z is measured from the mid-plane."
B_UNITS = "[B] IN N"
INPUTS_CAPTION = "INPUTS"
B_ZERO_TEXT = "[B] = 0: a pull does not bend or twist it."
B_NONZERO_TEXT = "[B] ≠ 0: a pull also bends or twists it."
# Balance (Kaw 2005): +θ and -θ plies in pairs give A16 = A26 = 0.
A_FORMULA = "[A] = Σ [Q̄] · (z_bottom − z_top)"
A_UNITS = "BALANCE: A16, A26 IN N/mm"
A_ZERO_TEXT = "A16 = A26 = 0: balanced. No shear if [B] = 0 too."
A_NONZERO_TEXT = "A16, A26 ≠ 0: not balanced, a pull also shears it."
BALANCED_TEXT = "Balanced"
# The switch under the plate: show the bend, the shear, or both.
VIEW_MODES = ("Bend", "Shear", "Both")
DEFAULT_MODE = "Both"
SWITCH_LABEL = "Show"
UNBALANCED_TEXT = "Not balanced"
CELL_WIDTH = 7
ANGLE_LIMITS = (-90.0, 90.0)
ANGLE_STEP = 15.0
COUPLING_TOLERANCE = 1.0e-8

# Deformed plate: a square plate, drawn with exaggerated displacements.
PLATE_SIZE_MM = 100.0
PLATE_GRID_POINTS = 21
PLATE_OUT_OF_PLANE_SCALE = 0.35
PLATE_SHEAR_SCALE = 0.12
PLATE_COUPLING_RATIO = 1.0e-6
PLATE_VIEW = (24.0, -58.0)
PLATE_ZOOM = 1.3
ARROW_LENGTH = 0.24
ARROW_GAP = 0.1

# Animation from the old plate shape to the new one.
ANIMATION_FRAMES = 14
ANIMATION_INTERVAL_MS = 25

# Exploded ply stack: unit-square plies, drawn apart so that each ply shows.
STACK_HEIGHT = 1.9
PLY_SLAB_FRACTION = 0.3
STACK_VIEW = (24.0, -58.0)
STACK_ZOOM = 1.15
# The view center moves to the right of the stack, so the drawing moves
# left and the "mid-plane" label stays inside the card.
STACK_CENTER_SHIFT = 0.2
STACK_LIMITS = (0.85, 0.85, 1.0)
FIBER_SPACING = 0.07
FIBER_INSET = 0.03
MIN_ROWS = 6
LABEL_GAP = 0.12
BRACKET_START = 0.05
BRACKET_STEP = 0.06
MID_PLANE_SIZE = 0.8
MID_PLANE_ALPHA = 0.3
MID_PLANE_COLOR = "#4F7CC9"

# Colors: a soft green page with white cards. Every ply is carbon/epoxy,
# so every ply has the same dark color; the fiber lines show the angle.
BG_COLOR = "#E3F2EA"
CARD_COLOR = "#FFFFFF"
SHADOW_COLOR = "#1D5A3F"
SHADOW_ALPHA = 0.08
INK_COLOR = "#14281F"
MUTED_COLOR = "#5C7066"
ACCENT_COLOR = "#0F8A5F"
ACCENT_DARK = "#0B6B49"
GOOD_COLOR = "#0F9D63"
BAD_COLOR = "#E5484D"
BUTTON_COLOR = "#FFFFFF"
BUTTON_HOVER = "#CDEADA"
CELL_COLOR = "#F1F6F3"
LINE_COLOR = "#DCE6E0"
PLY_COLORS = ("#3B4A52", "#2B373E", "#222C32")
SELECTED_COLORS = ("#12A06E", "#0D7A54", "#0A6345")
FIBER_COLOR = "#B4C7CF"
SELECTED_FIBER_COLOR = "#E4F7EE"
FIBER_ALPHA = 0.8
PLATE_LOW = (0.741, 0.902, 0.816)
PLATE_HIGH = (0.059, 0.541, 0.373)

# Window, fonts, and figure layout (figure fractions).
WINDOW_FRACTION = (0.85, 0.85)
REFERENCE_SCREEN = (1440, 900)
UI_SCALE_LIMITS = (0.7, 1.4)
FIGURE_DPI = 100
PAD = 12
PLOT_FONTS = ("Segoe UI", "Arial", "DejaVu Sans")
UI_FONT_NAME = "Segoe UI"
UI_FONT = (UI_FONT_NAME, 12)
UI_BOLD = (UI_FONT_NAME, 12, "bold")
UI_BIG = (UI_FONT_NAME, 18, "bold")
UI_TITLE = (UI_FONT_NAME, 18, "bold")
UI_CELL = (UI_FONT_NAME, 16, "bold")
UI_SMALL_BOLD = (UI_FONT_NAME, 10, "bold")
TITLE_SIZE = 28.0
STATUS_SIZE = 18.0
SWITCH_SIZE = 12.0
NOTE_SIZE = 13.0
LABEL_SIZE = 14.0
SMALL_SIZE = 11.0
LEFT_CARD = (0.025, 0.035, 0.455, 0.775)
RIGHT_CARD = (0.505, 0.035, 0.47, 0.775)
CARD_ROUNDING = 0.012
CARD_SHADOW = 0.006
STACK_BOX = (0.03, 0.04, 0.445, 0.7)
PLATE_BOX = (0.51, 0.07, 0.46, 0.67)
TITLE_POSITION = (0.03, 0.9)
HINT_POSITION = (0.03, 0.85)
STATUS_POSITION = (0.955, 0.77)
STATUS_NOTE_POSITION = (0.74, 0.125)
SWITCH_POSITION = (0.74, 0.07)
# Gaps between badges and between switch buttons, in points.
BADGE_GAP_PT = 24.0
SWITCH_GAP_PT = 16.0
STACK_CAPTION_POSITION = (0.045, 0.77)


# =============================================================================
# Laminate mechanics (classical lamination theory)
# =============================================================================


def reduced_stiffness(material: dict[str, float]) -> np.ndarray:
    """Return the 3x3 stiffness matrix Q of one ply in its fiber axes."""
    e1 = material["E1"]
    e2 = material["E2"]
    nu12 = material["nu12"]
    nu21 = nu12 * e2 / e1
    denom = 1.0 - nu12 * nu21
    return np.array([
        [e1 / denom, nu12 * e2 / denom, 0.0],
        [nu12 * e2 / denom, e2 / denom, 0.0],
        [0.0, 0.0, material["G12"]],
    ])


def strain_transform(theta_deg: float) -> np.ndarray:
    """Return the matrix that turns global strains into fiber-axis strains."""
    c = np.cos(np.radians(theta_deg))
    s = np.sin(np.radians(theta_deg))
    return np.array([
        [c * c, s * s, c * s],
        [s * s, c * c, -c * s],
        [-2.0 * c * s, 2.0 * c * s, c * c - s * s],
    ])


def abd_matrix(angles: list[float], thickness: float) -> np.ndarray:
    """Return the 6x6 ABD matrix. Ply 1 is the top ply (z = -h/2)."""
    n_plies = len(angles)
    z = thickness * (np.arange(n_plies + 1) - n_plies / 2.0)
    q = reduced_stiffness(MATERIAL)
    a = np.zeros((3, 3))
    b = np.zeros((3, 3))
    d = np.zeros((3, 3))
    for k in range(n_plies):
        te = strain_transform(angles[k])
        qbar = te.T @ q @ te
        a = a + qbar * (z[k + 1] - z[k])
        b = b + qbar * (z[k + 1] ** 2 - z[k] ** 2) / 2.0
        d = d + qbar * (z[k + 1] ** 3 - z[k] ** 3) / 3.0
    return np.block([[a, b], [b, d]])


def is_coupled(abd: np.ndarray, thickness: float) -> bool:
    """Return True if [B] is not zero: pulling the laminate also bends it."""
    a_scale = np.max(np.abs(abd[0:3, 0:3]))
    b_size = np.max(np.abs(abd[0:3, 3:6]))
    return bool(b_size > COUPLING_TOLERANCE * a_scale * thickness)


def midplane_response(
    abd: np.ndarray, load: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Return the mid-plane strains and curvatures for an in-plane load."""
    response = np.linalg.solve(abd, np.concatenate([load, np.zeros(3)]))
    return response[0:3], response[3:6]


def shear_values(abd: np.ndarray) -> np.ndarray:
    """Return A16 and A26 in N/mm, with round-off values set to zero."""
    values = np.array([abd[0, 2], abd[1, 2]])
    limit = COUPLING_TOLERANCE * np.max(np.abs(abd[0:3, 0:3]))
    values[np.abs(values) <= limit] = 0.0
    return values


def is_balanced(abd: np.ndarray) -> bool:
    """Return True if A16 = A26 = 0 (a balanced laminate)."""
    return bool(np.all(shear_values(abd) == 0.0))


def coupling_values(abd: np.ndarray, thickness: float) -> np.ndarray:
    """Return the 3x3 [B] matrix in N, with round-off values set to zero."""
    b = abd[0:3, 3:6].copy()
    limit = COUPLING_TOLERANCE * np.max(np.abs(abd[0:3, 0:3])) * thickness
    b[np.abs(b) <= limit] = 0.0
    return b


def input_rows(angles: list[float]) -> list[tuple[str, str]]:
    """Return the fixed inputs of the calculation as (name, value) texts."""
    stack = "/".join(format_angle(angle) for angle in angles)
    return [
        ("Material", MATERIAL_NAME),
        ("E1,  E2", f"{MATERIAL['E1'] / 1000:g} GPa,  "
                    f"{MATERIAL['E2'] / 1000:g} GPa"),
        ("ν12,  G12", f"{MATERIAL['nu12']:g},  {MATERIAL['G12'] / 1000:g} GPa"),
        ("Ply thickness", f"{PLY_THICKNESS:g} mm"),
        ("Stack, top to bottom", f"[{stack}]"),
        ("Total thickness", f"{len(angles) * PLY_THICKNESS:g} mm"),
        ("Pull (plate shape only)", f"Nx = {PULL_LOAD[0]:g} N/mm"),
    ]


def mirror_pairs(n_plies: int) -> list[tuple[int, int]]:
    """Return each ply and its mirror ply across the mid-plane, outer first."""
    return [(k, n_plies - 1 - k) for k in range(n_plies // 2)]


def plate_shape(
    strain: np.ndarray, curvature: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    """Return the plate (x, y, w) with an exaggerated bend and a short label.

    The plate does not show its small stretch, so a flat plate lies on its
    flat outline. It shows the shear (exaggerated) of an unbalanced stack.
    """
    side = np.linspace(-0.5, 0.5, PLATE_GRID_POINTS)
    x, y = np.meshgrid(side, side)
    size = PLATE_SIZE_MM
    u = (strain[0] * x + 0.5 * strain[2] * y) * size
    v = (0.5 * strain[2] * x + strain[1] * y) * size
    w = -0.5 * (curvature[0] * x**2 + curvature[1] * y**2
                + curvature[2] * x * y) * size**2
    in_plane = max(float(np.max(np.abs(u))), float(np.max(np.abs(v))))
    out_of_plane = float(np.max(np.abs(w)))
    stretch = max(abs(strain[0]), abs(strain[1]), 1.0e-30)
    sheared = abs(strain[2]) > PLATE_COUPLING_RATIO * stretch
    px = x
    py = y
    if sheared:
        # Shear only: the square becomes a slanted shape.
        px = x + PLATE_SHEAR_SCALE * np.sign(strain[2]) * y
        py = y + PLATE_SHEAR_SCALE * np.sign(strain[2]) * x
    if out_of_plane <= PLATE_COUPLING_RATIO * max(in_plane, 1.0e-30):
        if sheared:
            return px, py, np.zeros_like(w), "stays flat but shears"
        return px, py, np.zeros_like(w), "stays flat"
    w = w * PLATE_OUT_OF_PLANE_SCALE / out_of_plane
    bend = max(abs(curvature[0]), abs(curvature[1]))
    twist = abs(curvature[2]) / 2.0
    if twist > 2.0 * bend:
        label = "twists"
    elif bend > 2.0 * twist:
        label = "curls"
    else:
        label = "curls and twists"
    if sheared and label == "curls and twists":
        label = "curls, twists, and shears"
    elif sheared:
        label = f"{label} and shears"
    return px, py, w, label


# =============================================================================
# Drawing helpers
# =============================================================================


def normalize_angle(angle: float) -> float:
    """Return the same fiber angle in the range [-90, 90] degrees."""
    if -90.0 <= angle <= 90.0:
        return float(angle)
    return float((angle + 90.0) % 180.0 - 90.0)


def format_angle(angle: float) -> str:
    """Return a ply angle as text, with a sign for all angles except 0 and 90."""
    if angle == 0.0 or angle == 90.0:
        return f"{angle:.0f}°"
    return f"{angle:+.0f}°"


def same_direction(angle_1: float, angle_2: float) -> bool:
    """Return True if two ply angles give the same fiber direction (-90 = 90)."""
    return bool(np.isclose((angle_1 - angle_2) % 180.0, 0.0)
                or np.isclose((angle_1 - angle_2) % 180.0, 180.0))


def ply_levels(n_plies: int) -> tuple[np.ndarray, float]:
    """Return the drawn z center of each ply (top ply first) and half its height."""
    pitch = STACK_HEIGHT / max(n_plies, MIN_ROWS)
    centers = ((n_plies - 1) / 2.0 - np.arange(n_plies)) * pitch
    return centers, PLY_SLAB_FRACTION * pitch / 2.0


def ply_faces(z_center: float, half: float) -> list[np.ndarray]:
    """Return the top, front (y = -0.5), and right (x = 0.5) faces of a ply.

    Each face is a 4x3 array of corner points (x, y, z).
    """
    top = z_center + half
    low = z_center - half
    return [
        np.array([[-0.5, -0.5, top], [0.5, -0.5, top],
                  [0.5, 0.5, top], [-0.5, 0.5, top]]),
        np.array([[-0.5, -0.5, low], [0.5, -0.5, low],
                  [0.5, -0.5, top], [-0.5, -0.5, top]]),
        np.array([[0.5, -0.5, low], [0.5, 0.5, low],
                  [0.5, 0.5, top], [0.5, -0.5, top]]),
    ]


def fiber_lines(angle: float, box: tuple[float, ...]) -> list[np.ndarray]:
    """Return 2x2 line segments that show the fiber direction inside a box.

    box is (x_min, y_min, x_max, y_max). The rows of a segment are x and y.
    """
    direction = np.array([np.cos(np.radians(angle)), np.sin(np.radians(angle))])
    normal = np.array([-direction[1], direction[0]])
    center = np.array([(box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0])
    reach = np.hypot(box[2] - box[0], box[3] - box[1]) / 2.0
    count = int(np.ceil(reach / FIBER_SPACING))
    segments = []
    for j in range(-count, count + 1):
        point = center + j * FIBER_SPACING * normal
        t_low = -np.inf
        t_high = np.inf
        inside = True
        for i in range(2):
            if abs(direction[i]) < 1.0e-12:
                inside = inside and box[i] <= point[i] <= box[i + 2]
            else:
                t1 = (box[i] - point[i]) / direction[i]
                t2 = (box[i + 2] - point[i]) / direction[i]
                t_low = max(t_low, min(t1, t2))
                t_high = min(t_high, max(t1, t2))
        if inside and t_low < t_high:
            start = point + t_low * direction
            end = point + t_high * direction
            segments.append(np.array([[start[0], end[0]], [start[1], end[1]]]))
    return segments


def flat_plate() -> tuple[np.ndarray, np.ndarray]:
    """Return the x and y grid of the flat, unloaded plate."""
    side = np.linspace(-0.5, 0.5, PLATE_GRID_POINTS)
    return np.meshgrid(side, side)


def plate_view(shape: tuple[np.ndarray, ...], mode: str) -> tuple[np.ndarray, ...]:
    """Return the plate shape with only the effect that the switch shows."""
    x, y, w = shape
    if mode == "Bend":
        x, y = flat_plate()
    elif mode == "Shear":
        w = np.zeros_like(w)
    return x, y, w


def plate_colors(x: np.ndarray, y: np.ndarray, w: np.ndarray) -> np.ndarray:
    """Return an RGB color per plate point: deeper color = the point moves more.

    The move includes the bend and the shear, so a plate that only shears
    also gets darker corners.
    """
    x0, y0 = flat_plate()
    move = np.sqrt((x - x0) ** 2 + (y - y0) ** 2 + w**2)
    blend = move / max(float(np.max(move)), 1.0e-30)
    colors = np.zeros((w.shape[0], w.shape[1], 3))
    for i in range(3):
        colors[:, :, i] = PLATE_LOW[i] + (PLATE_HIGH[i] - PLATE_LOW[i]) * blend
    return colors


def smooth_step(t: float) -> float:
    """Return an eased fraction (slow start, slow end) for t in [0, 1]."""
    return t * t * (3.0 - 2.0 * t)


def installed_fonts(names: tuple[str, ...]) -> list[str]:
    """Return the fonts of names that the computer has, in the same order."""
    installed = {entry.name for entry in font_manager.fontManager.ttflist}
    return [name for name in names if name in installed]


def ui_scale(screen_width: int, screen_height: int) -> float:
    """Return the size factor of fonts and widgets for a screen size."""
    scale = min(screen_width / REFERENCE_SCREEN[0],
                screen_height / REFERENCE_SCREEN[1])
    return float(np.clip(scale, UI_SCALE_LIMITS[0], UI_SCALE_LIMITS[1]))


# =============================================================================
# Interactive application
# =============================================================================


class SymmetryApp:
    """One window: the ply stack with its mirror pairs, and the pulled plate."""

    def __init__(self, root: tk.Tk,
                 screen: tuple[int, int] | None = None) -> None:
        """Create the window, the widgets, and the first drawing.

        screen is the screen size in pixels. None uses the real screen.
        """
        self.root = root
        self.angles = list(DEFAULT_ANGLES)
        self.selected = 0
        self.shape = None
        self.old_shape = None
        self.frame = 0
        self.after_id = None
        self.popup = None
        self.view_mode = DEFAULT_MODE
        self.popup_values = []
        self.popup_cells = []
        self.popup_result = None
        self.popup_shear_cells = []
        self.popup_shear_result = None
        if screen is None:
            screen = (root.winfo_screenwidth(), root.winfo_screenheight())
        self.scale = ui_scale(screen[0], screen[1])
        width = int(WINDOW_FRACTION[0] * screen[0])
        height = int(WINDOW_FRACTION[1] * screen[1])
        root.tk.call("tk", "scaling",
                     self.scale * float(root.tk.call("tk", "scaling")))
        root.title(APP_TITLE)
        root.geometry(f"{width}x{height}+{(screen[0] - width) // 2}+0")
        root.configure(background=BG_COLOR)
        root.protocol("WM_DELETE_WINDOW", self._on_close)
        rcParams["font.family"] = installed_fonts(PLOT_FONTS)
        self._create_toolbar()
        self._create_figure()
        self._update(animate=False)

    # ----------------------------------------------------------------- setup

    def _button(self, parent: tk.Frame, text: str, command: object,
                accent: bool = False) -> tk.Button:
        """Create one flat button. The accent button is filled with color."""
        if accent:
            colors = (ACCENT_COLOR, "white", ACCENT_DARK)
        else:
            colors = (BUTTON_COLOR, INK_COLOR, BUTTON_HOVER)
        button = tk.Button(parent, text=text, command=command, font=UI_BOLD,
                           background=colors[0], foreground=colors[1],
                           activebackground=colors[2],
                           activeforeground=colors[1], relief=tk.FLAT,
                           borderwidth=0, padx=18, pady=8, cursor="hand2")
        button.pack(side=tk.LEFT, padx=(0, PAD))
        return button

    def _create_toolbar(self) -> None:
        """Create the row of controls at the bottom of the window."""
        bar = tk.Frame(self.root, background=BG_COLOR)
        bar.pack(side=tk.BOTTOM, fill=tk.X, padx=2 * PAD, pady=(0, 2 * PAD))
        tk.Label(bar, text="Angle", font=UI_BOLD, foreground=MUTED_COLOR,
                 background=BG_COLOR).pack(side=tk.LEFT, padx=(0, 8))
        self.angle_box = tk.Spinbox(
            bar, from_=ANGLE_LIMITS[0], to=ANGLE_LIMITS[1], increment=ANGLE_STEP,
            width=5, font=UI_BIG, justify=tk.CENTER, foreground=ACCENT_COLOR,
            background=BUTTON_COLOR, buttonbackground=BUTTON_HOVER,
            relief=tk.FLAT, borderwidth=0, highlightthickness=0,
            command=self._on_angle)
        self.angle_box.pack(side=tk.LEFT, padx=(0, 2 * PAD), ipady=4)
        self.angle_box.bind("<Return>", lambda _event: self._on_angle())
        self.angle_box.bind("<FocusOut>", lambda _event: self._on_angle())
        self._button(bar, "+  Add ply", self._on_add)
        self._button(bar, "Delete", self._on_delete)
        self._button(bar, "Mirror it", self._on_mirror, accent=True)
        self._button(bar, B_BUTTON, self._on_show_b)
        self.message = tk.Label(bar, text="", font=UI_FONT,
                                foreground=BAD_COLOR, background=BG_COLOR)
        self.message.pack(side=tk.RIGHT)

    def _create_figure(self) -> None:
        """Create the one figure that holds the texts and both drawings."""
        self.fig = Figure(dpi=self.scale * FIGURE_DPI, facecolor=BG_COLOR)
        self.cards = []
        for box in (LEFT_CARD, RIGHT_CARD):
            self._add_card(box)
        # Both drawings are 3D. Objects are drawn in the order of creation.
        self.ax_stack = self.fig.add_axes(STACK_BOX, projection="3d",
                                          computed_zorder=False)
        self.ax_stack.view_init(elev=STACK_VIEW[0], azim=STACK_VIEW[1])
        self.ax_stack.disable_mouse_rotation()
        self.ax_plate = self.fig.add_axes(PLATE_BOX, projection="3d",
                                          computed_zorder=False)
        self.ax_plate.view_init(elev=PLATE_VIEW[0], azim=PLATE_VIEW[1])
        self.ply_artists = []
        self.label_points = []
        self.fig.text(*TITLE_POSITION, APP_TITLE, fontsize=TITLE_SIZE,
                      fontweight="bold", color=INK_COLOR)
        self.fig.text(*HINT_POSITION, APP_HINT, fontsize=NOTE_SIZE,
                      color=MUTED_COLOR)
        self.fig.text(*STACK_CAPTION_POSITION, STACK_CAPTION, fontsize=SMALL_SIZE,
                      va="center", fontweight="bold", color=MUTED_COLOR)
        # The status is a colored badge with white text, as on a web page.
        self.status = self.fig.text(
            *STATUS_POSITION, "", fontsize=STATUS_SIZE, fontweight="bold",
            ha="right", va="center", color="white",
            bbox={"boxstyle": "round,pad=0.45", "edgecolor": "none"})
        # The balance badge has the same style; it sits left of the status.
        self.balance = self._chained_text(
            self.status, "", -BADGE_GAP_PT, fontsize=STATUS_SIZE,
            fontweight="bold", color="white",
            bbox={"boxstyle": "round,pad=0.45", "edgecolor": "none"})
        self.status_note = self.fig.text(*STATUS_NOTE_POSITION, "",
                                         ha="center", va="center",
                                         fontsize=NOTE_SIZE, color=MUTED_COLOR)
        # The switch: one button per view mode, joined from the middle out.
        pill = {"fontsize": SWITCH_SIZE, "fontweight": "bold",
                "bbox": {"boxstyle": "round,pad=0.5", "edgecolor": "none"}}
        self.mode_buttons = {"Shear": self.fig.text(
            *SWITCH_POSITION, "Shear", ha="center", va="center", **pill)}
        self.mode_buttons["Bend"] = self._chained_text(
            self.mode_buttons["Shear"], "Bend", -SWITCH_GAP_PT, **pill)
        self.mode_buttons["Both"] = self._chained_text(
            self.mode_buttons["Shear"], "Both", SWITCH_GAP_PT, **pill)
        self._chained_text(self.mode_buttons["Bend"], SWITCH_LABEL,
                           -SWITCH_GAP_PT, fontsize=SWITCH_SIZE,
                           color=MUTED_COLOR)
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.root)
        self.canvas.get_tk_widget().configure(background=BG_COLOR,
                                              highlightthickness=0)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        self.canvas.mpl_connect("button_press_event", self._on_click)
        self.canvas.mpl_connect("resize_event", self._on_resize)

    def _chained_text(self, anchor: Text, text: str, gap_pt: float,
                      **style: object) -> Annotation:
        """Add a text next to another text: left of it if gap_pt < 0.

        The text moves with its anchor, so a longer anchor text never
        overlaps it.
        """
        side = 0.0 if gap_pt < 0 else 1.0
        label = Annotation(text, xy=(side, 0.5), xycoords=anchor,
                           xytext=(gap_pt, 0.0), textcoords="offset points",
                           ha="right" if gap_pt < 0 else "left", va="center",
                           **style)
        self.fig.add_artist(label)
        return label

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

    def _set_message(self, text: str) -> None:
        """Show a short message at the right of the controls."""
        self.message.configure(text=text)

    def _on_click(self, event: MouseEvent) -> None:
        """Select the ply that the user clicked in the stack (ply or label).

        An upper ply covers the plies below it, so the top ply is tested first.
        A click at the left of the stack selects the ply of the nearest label.
        A click on a switch button changes what the plate shows.
        """
        for mode, button in self.mode_buttons.items():
            if button.contains(event)[0]:
                self._on_mode(mode)
                return
        if event.inaxes is not self.ax_stack:
            return
        for k, ply in enumerate(self.ply_artists):
            if ply.contains(event)[0]:
                self.selected = k
                self._update(animate=False)
                return
        anchors = np.array([self._screen_point(p) for p in self.label_points])
        k = int(np.argmin(np.abs(anchors[:, 1] - event.y)))
        if event.x <= anchors[k, 0]:
            self.selected = k
            self._update(animate=False)

    def _screen_point(self, point: tuple[float, float, float]) -> np.ndarray:
        """Return the pixel position of a 3D point of the stack drawing."""
        x, y, _ = proj3d.proj_transform(*point, self.ax_stack.get_proj())
        return self.ax_stack.transData.transform((x, y))

    def _on_resize(self, _event: object) -> None:
        """Keep the card corners round when the window changes its shape."""
        width, height = self.fig.get_size_inches()
        for card in self.cards:
            card.set_mutation_aspect(width / height)

    def _on_angle(self) -> None:
        """Set the angle of the selected ply from the number box."""
        try:
            angle = float(self.angle_box.get())
        except ValueError:
            self._set_message(f"'{self.angle_box.get()}' is not a number.")
            self._show_angle()
            return
        angle = normalize_angle(angle)
        if angle == self.angles[self.selected]:
            self._show_angle()
            return
        self.angles[self.selected] = angle
        self._set_message("")
        self._update()

    def _on_add(self) -> None:
        """Add a copy of the selected ply at the bottom, and select it."""
        if len(self.angles) >= MAX_PLIES:
            self._set_message(LIMIT_NOTE)
            return
        self.angles.append(self.angles[self.selected])
        self.selected = len(self.angles) - 1
        self._set_message("")
        self._update()

    def _on_delete(self) -> None:
        """Delete the selected ply. One ply always stays."""
        if len(self.angles) <= 1:
            self._set_message("A laminate needs at least one ply.")
            return
        self.angles.pop(self.selected)
        self.selected = min(self.selected, len(self.angles) - 1)
        self._set_message("")
        self._update()

    def _on_mirror(self) -> None:
        """Add the mirror image of the stack below it: now it is symmetric."""
        if 2 * len(self.angles) > MAX_PLIES:
            self._set_message(f"Mirror needs {2 * len(self.angles)} plies. "
                              f"{LIMIT_NOTE}")
            return
        self.angles = self.angles + self.angles[::-1]
        self._set_message("")
        self._update()

    def _on_show_b(self) -> None:
        """Open a read-only window with the fixed inputs and the [B] matrix.

        Left column: the formula and the inputs. Right column: [B], the
        result, and the reference.
        """
        if self.popup is not None:
            self.popup.lift()
            return
        self.popup = tk.Toplevel(self.root, background=BG_COLOR)
        self.popup.title(POPUP_TITLE)
        self.popup.resizable(False, False)
        self.popup.protocol("WM_DELETE_WINDOW", self._on_close_popup)
        card = tk.Frame(self.popup, background=CARD_COLOR, padx=3 * PAD,
                        pady=2 * PAD)
        card.pack(padx=2 * PAD, pady=2 * PAD)
        left = tk.Frame(card, background=CARD_COLOR)
        left.grid(row=0, column=0, sticky=tk.N, padx=(0, 4 * PAD))
        right = tk.Frame(card, background=CARD_COLOR)
        right.grid(row=0, column=1, sticky=tk.N)
        self._popup_text(left, 0, POPUP_TITLE, UI_TITLE, INK_COLOR, (0, PAD))
        self._popup_text(left, 1, B_FORMULA, UI_BOLD, INK_COLOR, (0, 2))
        self._popup_text(left, 2, A_FORMULA, UI_BOLD, INK_COLOR, (0, 2))
        self._popup_text(left, 3, B_FORMULA_NOTE, UI_FONT, MUTED_COLOR, (0, 0))
        self._popup_text(left, 4, INPUTS_CAPTION, UI_SMALL_BOLD, MUTED_COLOR,
                         (2 * PAD, 4))
        self.popup_values = []
        for i, (name, _) in enumerate(input_rows(self.angles)):
            tk.Label(left, text=name, font=UI_FONT, foreground=MUTED_COLOR,
                     background=CARD_COLOR).grid(row=5 + i, column=0,
                                                 sticky=tk.W, padx=(0, 2 * PAD))
            value = tk.Label(left, text="", font=UI_BOLD, foreground=INK_COLOR,
                             background=CARD_COLOR)
            value.grid(row=5 + i, column=1, sticky=tk.W)
            self.popup_values.append(value)
        self._popup_text(right, 0, B_UNITS, UI_SMALL_BOLD, MUTED_COLOR, (PAD, 4))
        matrix = tk.Frame(right, background=CARD_COLOR)
        matrix.grid(row=1, column=0, columnspan=2, sticky=tk.W)
        self.popup_cells = []
        for i in range(3):
            for j in range(3):
                cell = tk.Label(matrix, text="", font=UI_CELL, width=CELL_WIDTH,
                                background=CELL_COLOR, pady=6)
                cell.grid(row=i, column=j, padx=2, pady=2)
                self.popup_cells.append(cell)
        self.popup_result = tk.Label(right, text="", font=UI_BOLD,
                                     background=CARD_COLOR)
        self.popup_result.grid(row=2, column=0, columnspan=2, sticky=tk.W,
                               pady=(PAD, 0))
        self._popup_text(right, 3, A_UNITS, UI_SMALL_BOLD, MUTED_COLOR,
                         (2 * PAD, 4))
        shear = tk.Frame(right, background=CARD_COLOR)
        shear.grid(row=4, column=0, columnspan=2, sticky=tk.W)
        self.popup_shear_cells = []
        for j in range(2):
            cell = tk.Label(shear, text="", font=UI_CELL, width=CELL_WIDTH,
                            background=CELL_COLOR, pady=6)
            cell.grid(row=0, column=j, padx=2, pady=2)
            self.popup_shear_cells.append(cell)
        self.popup_shear_result = tk.Label(right, text="", font=UI_BOLD,
                                           background=CARD_COLOR)
        self.popup_shear_result.grid(row=5, column=0, columnspan=2,
                                     sticky=tk.W, pady=(PAD, 0))
        # A thin line under both columns, then the reference in one line.
        tk.Frame(card, background=LINE_COLOR, height=1).grid(
            row=1, column=0, columnspan=2, sticky=tk.EW, pady=(2 * PAD, PAD))
        self._popup_text(card, 2, REFERENCE_TEXT, UI_FONT, MUTED_COLOR, (0, 0))
        self._fill_popup()

    def _popup_text(self, parent: tk.Frame, row: int, text: str,
                    font: tuple, color: str, space: tuple[int, int]) -> None:
        """Add one line of text that spans both columns of a popup grid."""
        tk.Label(parent, text=text, font=font, foreground=color,
                 background=CARD_COLOR).grid(row=row, column=0, columnspan=2,
                                             sticky=tk.W, pady=space)

    def _fill_popup(self) -> None:
        """Show the current inputs and [B] in the read-only window, if open."""
        if self.popup is None:
            return
        thickness = len(self.angles) * PLY_THICKNESS
        abd = abd_matrix(self.angles, PLY_THICKNESS)
        b = coupling_values(abd, thickness)
        for label, (_, value) in zip(self.popup_values, input_rows(self.angles)):
            label.configure(text=value)
        for cell, value in zip(self.popup_cells, b.flatten()):
            cell.configure(text=f"{value:.0f}",
                           foreground=GOOD_COLOR if value == 0.0 else BAD_COLOR)
        if is_coupled(abd, thickness):
            self.popup_result.configure(text=B_NONZERO_TEXT, foreground=BAD_COLOR)
        else:
            self.popup_result.configure(text=B_ZERO_TEXT, foreground=GOOD_COLOR)
        for cell, value in zip(self.popup_shear_cells, shear_values(abd)):
            cell.configure(text=f"{value:.0f}",
                           foreground=GOOD_COLOR if value == 0.0 else BAD_COLOR)
        if is_balanced(abd):
            self.popup_shear_result.configure(text=A_ZERO_TEXT,
                                              foreground=GOOD_COLOR)
        else:
            self.popup_shear_result.configure(text=A_NONZERO_TEXT,
                                              foreground=BAD_COLOR)

    def _on_close_popup(self) -> None:
        """Close the read-only [B] window."""
        self.popup.destroy()
        self.popup = None

    def _on_mode(self, mode: str) -> None:
        """Show the bend, the shear, or both on the plate."""
        if mode != self.view_mode:
            self.view_mode = mode
            self._update()

    def _on_close(self) -> None:
        """Stop the animation and close the window."""
        if self.after_id is not None:
            self.root.after_cancel(self.after_id)
        self.root.destroy()

    # ---------------------------------------------------------------- update

    def _show_angle(self) -> None:
        """Show the angle of the selected ply in the number box."""
        self.angle_box.delete(0, tk.END)
        self.angle_box.insert(0, f"{self.angles[self.selected]:g}")

    def _update(self, animate: bool = True) -> None:
        """Recompute the laminate and redraw; animate the plate if asked."""
        self._show_angle()
        thickness = len(self.angles) * PLY_THICKNESS
        abd = abd_matrix(self.angles, PLY_THICKNESS)
        strain, curvature = midplane_response(abd, np.array(PULL_LOAD))
        x, y, w, label = plate_shape(strain, curvature)
        if is_coupled(abd, thickness):
            self.status.set_text("Not symmetric")
            self.status.get_bbox_patch().set_facecolor(BAD_COLOR)
            b_text = "[B] ≠ 0"
        else:
            self.status.set_text("Symmetric")
            self.status.get_bbox_patch().set_facecolor(GOOD_COLOR)
            b_text = "[B] = 0"
        if is_balanced(abd):
            self.balance.set_text(BALANCED_TEXT)
            self.balance.get_bbox_patch().set_facecolor(GOOD_COLOR)
            a_text = "A16 = A26 = 0"
        else:
            self.balance.set_text(UNBALANCED_TEXT)
            self.balance.get_bbox_patch().set_facecolor(BAD_COLOR)
            a_text = "A16, A26 ≠ 0"
        self.status_note.set_text(
            f"Pulled, it {label}.   {b_text}   ·   {a_text}")
        for mode, button in self.mode_buttons.items():
            active = mode == self.view_mode
            button.set_color("white" if active else MUTED_COLOR)
            button.get_bbox_patch().set_facecolor(
                ACCENT_COLOR if active else CELL_COLOR)
        self._fill_popup()
        self._draw_stack()
        new_shape = plate_view((x, y, w), self.view_mode)
        if self.after_id is not None:
            self.root.after_cancel(self.after_id)
            self.after_id = None
        if animate and self.shape is not None:
            self.old_shape = self.shape
            self.shape = new_shape
            self.frame = 0
            self._on_frame()
        else:
            self.shape = new_shape
            self._draw_plate(self.shape)
            self.canvas.draw_idle()

    def _on_frame(self) -> None:
        """Draw one step of the change from the old to the new plate shape."""
        self.frame += 1
        t = smooth_step(self.frame / ANIMATION_FRAMES)
        blend = tuple(old + (new - old) * t
                      for old, new in zip(self.old_shape, self.shape))
        self._draw_plate(blend)
        self.canvas.draw_idle()
        if self.frame < ANIMATION_FRAMES:
            self.after_id = self.root.after(ANIMATION_INTERVAL_MS,
                                            self._on_frame)
        else:
            self.after_id = None

    # --------------------------------------------------------------- drawing

    def _draw_stack(self) -> None:
        """Draw the exploded ply stack, the mid-plane, and the mirror brackets.

        The plies are drawn from the bottom up, so an upper ply covers the
        plies below it. Labels sit at the left corner, brackets at the right.
        """
        ax = self.ax_stack
        ax.clear()
        n_plies = len(self.angles)
        centers, half = ply_levels(n_plies)
        azim = np.radians(STACK_VIEW[1])
        right = np.array([-np.sin(azim), np.cos(azim)])
        self.ply_artists = [None] * n_plies
        self.label_points = [None] * n_plies
        plane_drawn = False
        for k in range(n_plies - 1, -1, -1):
            if not plane_drawn and centers[k] >= 0.0:
                self._draw_mid_plane()
                plane_drawn = True
            colors = SELECTED_COLORS if k == self.selected else PLY_COLORS
            ply = Poly3DCollection(ply_faces(centers[k], half),
                                   facecolors=colors, edgecolors=colors,
                                   linewidths=0.5, zorder=1)
            ax.add_collection3d(ply)
            box = (-0.5 + FIBER_INSET, -0.5 + FIBER_INSET,
                   0.5 - FIBER_INSET, 0.5 - FIBER_INSET)
            xs = []
            ys = []
            for segment in fiber_lines(self.angles[k], box):
                xs = xs + [segment[0, 0], segment[0, 1], np.nan]
                ys = ys + [segment[1, 0], segment[1, 1], np.nan]
            fiber = (SELECTED_FIBER_COLOR if k == self.selected
                     else FIBER_COLOR)
            ax.plot(xs, ys, np.full(len(xs), centers[k] + half), color=fiber,
                    alpha=FIBER_ALPHA, linewidth=1.0, zorder=1)
            corner = np.array([-0.5, -0.5]) - LABEL_GAP * right
            ax.text(corner[0], corner[1], centers[k],
                    format_angle(self.angles[k]), ha="right", va="center",
                    fontsize=LABEL_SIZE, fontweight="bold",
                    color=ACCENT_COLOR if k == self.selected else MUTED_COLOR,
                    zorder=2)
            self.ply_artists[k] = ply
            self.label_points[k] = (corner[0], corner[1], centers[k])
        if not plane_drawn:
            self._draw_mid_plane()
        pairs = mirror_pairs(n_plies)
        # The label goes past the brackets and past the corner of the plane.
        reach = max(BRACKET_START + BRACKET_STEP * (len(pairs) + 2),
                    (MID_PLANE_SIZE - 0.5) * (right[0] + right[1]) + LABEL_GAP)
        place = np.array([0.5, 0.5]) + reach * right
        ax.text(place[0], place[1], 0.0, "mid-plane", ha="left", va="center",
                fontsize=SMALL_SIZE, fontweight="bold", color=MID_PLANE_COLOR,
                zorder=1)
        for depth, (k, m) in enumerate(pairs):
            if same_direction(self.angles[k], self.angles[m]):
                color = GOOD_COLOR
            else:
                color = BAD_COLOR
            start = np.array([0.5, 0.5]) + BRACKET_START * right
            end = start + BRACKET_STEP * (len(pairs) - depth) * right
            ax.plot([start[0], end[0], end[0], start[0]],
                    [start[1], end[1], end[1], start[1]],
                    [centers[k], centers[k], centers[m], centers[m]],
                    color=color, linewidth=2.2, solid_capstyle="round",
                    zorder=1)
        center = STACK_CENTER_SHIFT * right
        ax.set_xlim(center[0] - STACK_LIMITS[0], center[0] + STACK_LIMITS[0])
        ax.set_ylim(center[1] - STACK_LIMITS[1], center[1] + STACK_LIMITS[1])
        ax.set_zlim(-STACK_LIMITS[2], STACK_LIMITS[2])
        ax.set_box_aspect(STACK_LIMITS, zoom=STACK_ZOOM)
        ax.set_axis_off()
        ax.set_facecolor("none")

    def _draw_mid_plane(self) -> None:
        """Draw the mid-plane as a light square with a dashed edge."""
        ax = self.ax_stack
        size = MID_PLANE_SIZE
        corners = np.array([[-size, -size, 0.0], [size, -size, 0.0],
                            [size, size, 0.0], [-size, size, 0.0]])
        ax.add_collection3d(Poly3DCollection(
            [corners], facecolors=MID_PLANE_COLOR, edgecolors="none",
            alpha=MID_PLANE_ALPHA, zorder=1))
        edge = np.array([-size, size, size, -size, -size])
        ax.plot(edge, np.roll(edge, 1), np.zeros(5), linestyle=(0, (4, 3)),
                color=MID_PLANE_COLOR, linewidth=1.5, zorder=1)

    def _draw_plate(self, shape: tuple[np.ndarray, ...]) -> None:
        """Draw the pulled plate, its flat outline, and the pull arrows."""
        ax = self.ax_plate
        elev = ax.elev
        azim = ax.azim
        ax.clear()
        x, y, w = shape
        edge = np.array([-0.5, 0.5, 0.5, -0.5, -0.5])
        ax.plot(edge, np.roll(edge, 1), np.zeros(5), linestyle=(0, (4, 3)),
                color=MUTED_COLOR, linewidth=1.0, zorder=1)
        ax.plot_surface(x, y, w, facecolors=plate_colors(x, y, w),
                        edgecolor="white",
                        linewidth=0.4, shade=False, zorder=2)
        # Each arrow pulls the middle of a plate edge and stays on top.
        middle = PLATE_GRID_POINTS // 2
        for side, column in ((-1.0, 0), (1.0, -1)):
            ax.quiver(x[middle, column] + side * ARROW_GAP, y[middle, column],
                      w[middle, column], side * ARROW_LENGTH, 0.0, 0.0,
                      color=ACCENT_COLOR, linewidth=3.0, arrow_length_ratio=0.4,
                      zorder=3)
        ax.set_xlim(-0.75, 0.75)
        ax.set_ylim(-0.75, 0.75)
        ax.set_zlim(-0.45, 0.45)
        ax.set_box_aspect((1.0, 1.0, 0.55), zoom=PLATE_ZOOM)
        ax.set_axis_off()
        ax.set_facecolor("none")
        ax.view_init(elev=elev, azim=azim)


# =============================================================================
# Entry point
# =============================================================================


def main() -> None:
    """Open the interactive window."""
    root = tk.Tk()
    SymmetryApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
