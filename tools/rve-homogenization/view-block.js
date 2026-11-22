/** 3D view of the RVE block: matrix faces, fiber cuts and strips, axis names. */

import {
    BufferGeometry,
    Color,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    SRGBColorSpace,
} from "three";
import { el } from "../../assets/js/core/dom.js";
import { createLabelLayer } from "../../assets/js/three/labels.js";
import { createView } from "../../assets/js/three/scene.js";
import { BLOCK_HEIGHT, BLOCK_LENGTH, BLOCK_WIDTH } from "./config.js";
import { blockFaces } from "./geometry.js";

// The start view and the face shades of the Python app.
const VIEW = Object.freeze({ elevation: 25.0, azimuth: -36.0 });
const VIEW_SIZE = 7.6;                 // world units that fit up and down
const VIEW_WIDTH = 13.5;               // and across: the block and its axis names
const FACE_SHADES = Object.freeze([1.0, 0.86, 0.94]);   // faces normal to axis 1, 2, 3
const STYLE = Object.freeze({
    matrix: "#C8913A",                 // honey-amber epoxy (darker than --matrix)
    fiber: "#DCE3EA",                  // silver-gray fiber
    rim: "#9AA7B4",                    // thin ring around each fiber cut
    edge: "#5A3E17",                   // block edges
});
// Axis names: [text, place as a part of the block size, direction out of it].
const AXIS_LABELS = Object.freeze([
    ["axis 1 (fibers)", [0.5, 0.0, 0.0], [0, -1, -1]],
    ["axis 2", [1.0, 0.5, 0.0], [1, 0, -1]],
    ["axis 3", [1.0, 1.0, 0.5], [1, 1, 0]],
]);
const LABEL_GAP = 0.9;
const SIZE = Object.freeze([BLOCK_LENGTH, BLOCK_WIDTH, BLOCK_HEIGHT]);

/** Return a color made darker by factor in sRGB, as the Python app does. */
function shaded(hex, factor) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return new Color().setRGB(r * factor, g * factor, b * factor, SRGBColorSpace);
}

/** Return triangle points of convex polygons (a fan from the first point). */
function fanTriangles(polygons) {
    const points = [];
    for (const polygon of polygons) {
        for (let i = 1; i < polygon.length - 1; i += 1) {
            points.push(...polygon[0], ...polygon[i], ...polygon[i + 1]);
        }
    }
    return points;
}

/** Return line-segment points of the outlines of polygons. */
function outlines(polygons) {
    const points = [];
    for (const polygon of polygons) {
        polygon.forEach((point, i) => {
            points.push(...point, ...polygon[(i + 1) % polygon.length]);
        });
    }
    return points;
}

// Depth offsets: the matrix lies furthest back, then the fiber cuts; the
// outlines have no offset, so they stay on top of both.
const MATRIX_OFFSET = 2;
const FIBER_OFFSET = 1;

/** Return a mesh of polygons with one color, pushed back in depth by offset. */
function polygonMesh(polygons, color, offset) {
    const geometry = new BufferGeometry();
    const points = new Float32BufferAttribute(fanTriangles(polygons), 3);
    geometry.setAttribute("position", points);
    return new Mesh(geometry, new MeshBasicMaterial({
        color, side: DoubleSide, polygonOffset: true,
        polygonOffsetFactor: offset, polygonOffsetUnits: offset,
    }));
}

/** Return lines along the outlines of polygons. */
function outlineLines(polygons, color) {
    const geometry = new BufferGeometry();
    const points = new Float32BufferAttribute(outlines(polygons), 3);
    geometry.setAttribute("position", points);
    return new LineSegments(geometry, new LineBasicMaterial({ color }));
}

/** Dispose the geometries and materials of a group. */
function disposeGroup(group) {
    group.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
    });
}

/**
 * Make the block view in container and return { update, view }.
 *
 * update(vf) draws the block for a fiber volume fraction: all six faces,
 * each with its matrix rectangle and the fiber parts on it.
 */
export function createBlockView(container) {
    const view = createView(container, {
        elevation: VIEW.elevation,
        azimuth: VIEW.azimuth,
        viewSize: VIEW_SIZE,
        viewWidth: VIEW_WIDTH,
        target: SIZE.map((length) => length / 2),
    });
    const labels = createLabelLayer(view, container);
    for (const [text, place, direction] of AXIS_LABELS) {
        const point = place.map((part, i) => part * SIZE[i] + LABEL_GAP * direction[i]);
        labels.add(el("span", { className: "tag", text }), point);
    }
    let group = null;
    let drawnVf = null;

    function update(vf) {
        if (vf === drawnVf) {
            return;
        }
        if (group) {
            view.scene.remove(group);
            disposeGroup(group);
        }
        group = new Group();
        for (const face of blockFaces(vf)) {
            const shade = FACE_SHADES[face.axis];
            group.add(polygonMesh([face.rectangle], shaded(STYLE.matrix, shade),
                                  MATRIX_OFFSET),
                      outlineLines([face.rectangle], STYLE.edge));
            if (face.parts.length > 0) {
                group.add(polygonMesh(face.parts, shaded(STYLE.fiber, shade),
                                      FIBER_OFFSET),
                          outlineLines(face.parts, shaded(STYLE.rim, shade)));
            }
        }
        view.scene.add(group);
        group.updateMatrixWorld(true);
        drawnVf = vf;
        view.requestRender();
    }

    return Object.freeze({ update, view });
}
