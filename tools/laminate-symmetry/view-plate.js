/** 3D view of the pulled plate: colored surface, grid, flat outline, pull arrows. */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    Group,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    SRGBColorSpace,
} from "three";
import { thickLine, updateLineResolution } from "../../assets/js/three/lines.js";
import { createView } from "../../assets/js/three/scene.js";
import { PLATE_STYLE, PLATE_VIEW, PLATE_Z_SCALE, PLY_THICKNESS, PULL_LOAD,
         SHAPE_CHANGE_MS } from "./config.js";
import {
    abdMatrix,
    midplaneResponse,
    plateColors,
    plateShape,
    plateView,
    smoothStep,
} from "./model.js";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const HALF = 0.5;                      // the flat plate is a unit square

/** Return the plate [x, y, w] and its label for a stack and a view mode. */
export function plateFor(angles, mode) {
    const abd = abdMatrix(angles, PLY_THICKNESS);
    const shape = plateShape(...midplaneResponse(abd, PULL_LOAD));
    return { grids: plateView(shape, mode), label: shape[3] };
}

/** Return triangle indexes for an n x n grid of points (two per square). */
function gridIndexes(n) {
    const indexes = [];
    for (let i = 0; i < n - 1; i += 1) {
        for (let j = 0; j < n - 1; j += 1) {
            const a = i * n + j;
            indexes.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
        }
    }
    return indexes;
}

/** Return line-pair indexes along the rows and the columns of an n x n grid. */
function gridLineIndexes(n) {
    const indexes = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n - 1; j += 1) {
            indexes.push(i * n + j, i * n + j + 1);          // along a row
            indexes.push(j * n + i, (j + 1) * n + i);        // along a column
        }
    }
    return indexes;
}

/** Return one pull arrow along +x, with its base at the origin. */
function buildArrow() {
    const material = new MeshBasicMaterial({ color: PLATE_STYLE.arrowColor });
    const headLength = PLATE_STYLE.arrowLength * PLATE_STYLE.arrowHeadRatio;
    const shaftLength = PLATE_STYLE.arrowLength - headLength;
    const shaft = new Mesh(new CylinderGeometry(PLATE_STYLE.arrowRadius,
                                                PLATE_STYLE.arrowRadius, shaftLength),
                           material);
    shaft.position.y = shaftLength / 2;
    const head = new Mesh(new ConeGeometry(PLATE_STYLE.arrowHeadRadius, headLength),
                          material);
    head.position.y = shaftLength + headLength / 2;
    const arrow = new Group();
    const body = new Group();
    body.add(shaft, head);
    body.rotation.z = -Math.PI / 2;        // the cylinder axis y turns to +x
    arrow.add(body);
    return arrow;
}

/**
 * Make the plate view in container and return { update, view }.
 *
 * update({ angles, mode }, { animate }) draws the plate of the stack and
 * returns its label ("curls", "stays flat", ...). With animate, the plate
 * moves from the old shape to the new one, unless the system asks for
 * reduced motion.
 */
export function createPlateView(container) {
    const view = createView(container, {
        elevation: PLATE_VIEW.elevation,
        azimuth: PLATE_VIEW.azimuth,
        viewSize: PLATE_VIEW.viewSize,
        viewWidth: PLATE_VIEW.viewWidth,
    });
    const root = new Group();
    view.scene.add(root);

    let n = 0;
    let surface = null;
    let grid = null;
    let shown = null;                  // the [x, y, w] grids on the screen now
    let frame = 0;

    const corners = [[-HALF, -HALF, 0], [HALF, -HALF, 0], [HALF, HALF, 0],
                     [-HALF, HALF, 0], [-HALF, -HALF, 0]];
    root.add(thickLine(corners, {
        color: PLATE_STYLE.outlineColor,
        width: PLATE_STYLE.outlineWidth,
        dashed: true,
        dashSize: PLATE_STYLE.dashSize,
        gapSize: PLATE_STYLE.gapSize,
    }));
    const arrows = [buildArrow(), buildArrow()];
    arrows[0].rotation.z = Math.PI;        // the left arrow points to -x
    root.add(...arrows);
    view.onResize(() => updateLineResolution(view, root));
    updateLineResolution(view, root);

    /** Make the surface and the grid lines for an n x n grid. */
    function buildSurface(size) {
        n = size;
        const positions = new BufferAttribute(new Float32Array(n * n * 3), 3);
        const colors = new BufferAttribute(new Float32Array(n * n * 3), 3);
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", positions);
        geometry.setAttribute("color", colors);
        geometry.setIndex(gridIndexes(n));
        surface = new Mesh(geometry, new MeshBasicMaterial({
            vertexColors: true,
            side: DoubleSide,
            polygonOffset: true,       // the grid lines stay on top
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
        }));
        const lines = new BufferGeometry();
        lines.setAttribute("position", positions);
        lines.setIndex(gridLineIndexes(n));
        grid = new LineSegments(lines, new LineBasicMaterial({
            color: PLATE_STYLE.gridColor,
            transparent: true,
            opacity: PLATE_STYLE.gridOpacity,
        }));
        root.add(surface, grid);
    }

    /** Put [x, y, w] grids on the screen: points, colors, and arrows. */
    function draw([x, y, w]) {
        if (!surface || x.length !== n) {
            buildSurface(x.length);
        }
        const positions = surface.geometry.getAttribute("position");
        const colors = surface.geometry.getAttribute("color");
        const rgb = plateColors(x, y, w, PLATE_STYLE.low, PLATE_STYLE.high);
        const color = new Color();
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const index = i * n + j;
                positions.setXYZ(index, x[i][j], y[i][j], w[i][j] * PLATE_Z_SCALE);
                color.setRGB(...rgb[i][j], SRGBColorSpace);
                colors.setXYZ(index, color.r, color.g, color.b);
            }
        }
        positions.needsUpdate = true;
        colors.needsUpdate = true;
        surface.geometry.computeBoundingSphere();
        // Each arrow pulls the middle of a plate edge.
        const middle = Math.floor(n / 2);
        const ends = [[arrows[0], -1, 0], [arrows[1], 1, n - 1]];
        for (const [arrow, side, column] of ends) {
            arrow.position.set(x[middle][column] + side * PLATE_STYLE.arrowGap,
                               y[middle][column], w[middle][column] * PLATE_Z_SCALE);
        }
        shown = [x, y, w];
        view.requestRender();
    }

    /** Move the plate from the grids `from` to the grids `to`. */
    function animate(from, to) {
        const start = performance.now();
        const step = (now) => {
            const t = smoothStep(Math.min((now - start) / SHAPE_CHANGE_MS, 1));
            const blend = from.map((gridFrom, g) => gridFrom.map((row, i) =>
                row.map((value, j) => value + (to[g][i][j] - value) * t)));
            draw(blend);
            frame = t < 1 ? window.requestAnimationFrame(step) : 0;
        };
        frame = window.requestAnimationFrame(step);
    }

    function update({ angles, mode }, { animate: moving = true } = {}) {
        const { grids, label } = plateFor(angles, mode);
        window.cancelAnimationFrame(frame);
        const reduced = window.matchMedia(REDUCED_MOTION).matches;
        if (moving && shown && !reduced && shown[0].length === grids[0].length) {
            animate(shown, grids);
        } else {
            draw(grids);
        }
        return label;
    }

    return Object.freeze({ update, view });
}
