/** 3D view of the exploded ply stack: plies, fibers, mid-plane, brackets, labels. */

import {
    BoxGeometry,
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Raycaster,
    Vector2,
} from "three";
import { el } from "../../assets/js/core/dom.js";
import { createLabelLayer } from "../../assets/js/three/labels.js";
import { thickLine as sharedThickLine, updateLineResolution } from
    "../../assets/js/three/lines.js";
import { createView } from "../../assets/js/three/scene.js";
import { CLICK_TOLERANCE_PX, STACK_STYLE, STACK_VIEW } from "./config.js";
import {
    fiberLines,
    formatAngle,
    mirrorPairs,
    plyLevels,
    sameDirection,
} from "./model.js";

const DEG_TO_RAD = Math.PI / 180;
const PLY_SIZE = 1.0;                  // plies are unit squares (as in the Python app)
const HALF = PLY_SIZE / 2;

/** Return the unit vector in the x-y plane that points right on the screen. */
function rightVector() {
    const azimuth = STACK_VIEW.azimuth * DEG_TO_RAD;
    return [-Math.sin(azimuth), Math.cos(azimuth)];
}

/** Return a ply angle for the screen: a true minus sign instead of "-". */
function angleText(angle) {
    return formatAngle(angle).replace("-", "−");
}

/** Return a thick line of the stack style through 3D points; solid or dashed. */
function thickLine(points, color, dashed) {
    return sharedThickLine(points, {
        color,
        width: STACK_STYLE.lineWidth,
        dashed,
        dashSize: STACK_STYLE.dashSize,
        gapSize: STACK_STYLE.gapSize,
    });
}

/** Return one ply: a box with three face colors, and its fiber lines. */
function buildPly(angle, center, half, selected) {
    const [top, front, right] = selected ? STACK_STYLE.selectedColors
                                         : STACK_STYLE.plyColors;
    const hidden = STACK_STYLE.hiddenColor;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    const faces = [right, hidden, hidden, front, top, hidden]
        .map((color) => new MeshBasicMaterial({ color }));
    const box = new Mesh(new BoxGeometry(PLY_SIZE, PLY_SIZE, 2 * half), faces);
    box.position.z = center;

    const inset = HALF - STACK_STYLE.fiberInset;
    const z = center + half + STACK_STYLE.fiberLift;
    const points = fiberLines(angle, [-inset, -inset, inset, inset])
        .flatMap(([xs, ys]) => [xs[0], ys[0], z, xs[1], ys[1], z]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    const fibers = new LineSegments(geometry, new LineBasicMaterial({
        color: selected ? STACK_STYLE.selectedFiberColor : STACK_STYLE.fiberColor,
        transparent: true,
        opacity: STACK_STYLE.fiberOpacity,
    }));
    return [box, fibers];
}

/** Return the mid-plane: a see-through square with a dashed edge, at z = 0. */
function buildMidPlane() {
    const size = STACK_STYLE.midPlaneSize;
    const geometry = new PlaneGeometry(2 * size, 2 * size);
    const plane = new Mesh(geometry, new MeshBasicMaterial({
        color: STACK_STYLE.midPlaneColor,
        transparent: true,
        opacity: STACK_STYLE.midPlaneOpacity,
        side: DoubleSide,
        depthWrite: false,
    }));
    const corners = [[-size, -size, 0], [size, -size, 0], [size, size, 0],
                     [-size, size, 0], [-size, -size, 0]];
    return [plane, thickLine(corners, STACK_STYLE.midPlaneColor, true)];
}

/**
 * Return the mirror brackets at the right of the stack, outer pairs farther out.
 *
 * A pair with the same fiber direction gets a solid line, a pair that
 * differs gets a dashed line: the line style shows it also without color.
 */
function buildBrackets(angles, centers, right) {
    const pairs = mirrorPairs(angles.length);
    return pairs.map(([k, m], depth) => {
        const same = sameDirection(angles[k], angles[m]);
        const start = [HALF + STACK_STYLE.bracketStart * right[0],
                       HALF + STACK_STYLE.bracketStart * right[1]];
        const reach = STACK_STYLE.bracketStep * (pairs.length - depth);
        const end = [start[0] + reach * right[0], start[1] + reach * right[1]];
        const points = [[...start, centers[k]], [...end, centers[k]],
                        [...end, centers[m]], [...start, centers[m]]];
        return thickLine(points, same ? STACK_STYLE.sameColor : STACK_STYLE.differColor,
                         !same);
    });
}

/** Dispose the geometries and materials of a group. */
function disposeGroup(group) {
    group.traverse((object) => {
        object.geometry?.dispose();
        const materials = [object.material ?? []].flat();
        for (const material of materials) {
            material.dispose();
        }
    });
}

/**
 * Make the ply stack view in container and return { update, view }.
 *
 * update({ angles, selected }) redraws the stack. onSelect(index) is called
 * when the user clicks or taps a ply or its label, or moves the selection
 * with the up and down arrow keys on a label.
 */
export function createStackView(container, { onSelect }) {
    const right = rightVector();
    const shift = STACK_VIEW.centerShift;
    const view = createView(container, {
        elevation: STACK_VIEW.elevation,
        azimuth: STACK_VIEW.azimuth,
        viewSize: STACK_VIEW.viewSize,
        viewWidth: STACK_VIEW.viewWidth,
        target: [shift * right[0], shift * right[1], 0],
    });
    const labels = createLabelLayer(view, container);
    let current = null;

    /** Set the pixel size of the thick lines (they need the view size). */
    function setLineResolution() {
        updateLineResolution(view, current?.group);
    }
    view.onResize(setLineResolution);

    /** Return the angle label button of ply k. */
    function plyLabel(angles, k, selected) {
        const text = angleText(angles[k]);
        const button = el("button", {
            className: `label3d${k === selected ? " is-active" : ""}`,
            text,
            attrs: {
                type: "button",
                "aria-label": `Ply ${k + 1} of ${angles.length}: ${text}`,
                "aria-pressed": String(k === selected),
            },
        });
        button.addEventListener("click", () => onSelect(k));
        button.addEventListener("keydown", (event) => {
            const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
            if (step) {
                event.preventDefault();
                onSelect(Math.min(Math.max(k + step, 0), angles.length - 1));
            }
        });
        return button;
    }

    /** Remove the current stack, its labels, and their GPU memory. */
    function clear() {
        if (!current) {
            return;
        }
        view.scene.remove(current.group);
        disposeGroup(current.group);
        for (const label of current.labels) {
            labels.remove(label);
        }
        current = null;
    }

    function update({ angles, selected }) {
        const hadFocus = current?.buttons.includes(document.activeElement) ?? false;
        clear();
        const group = new Group();
        const [centers, half] = plyLevels(angles.length);
        const plies = [];
        angles.forEach((angle, k) => {
            const [box, fibers] = buildPly(angle, centers[k], half, k === selected);
            box.userData.ply = k;
            plies.push(box);
            group.add(box, fibers);
        });
        group.add(...buildMidPlane(), ...buildBrackets(angles, centers, right));
        view.scene.add(group);
        // Positions now, not at the next frame: a click before it must hit.
        group.updateMatrixWorld(true);

        const gap = STACK_STYLE.labelGap;
        const buttons = angles.map((_, k) => plyLabel(angles, k, selected));
        const placed = buttons.map((button, k) => {
            const label = labels.add(button, [-HALF - gap * right[0],
                                              -HALF - gap * right[1], centers[k]]);
            label.center.set(1, 0.5);        // right edge at the point
            return label;
        });
        // The "mid-plane" name goes past the brackets and the plane corner.
        const pairCount = mirrorPairs(angles.length).length;
        const reach = Math.max(
            STACK_STYLE.bracketStart + STACK_STYLE.bracketStep * (pairCount + 2),
            (STACK_STYLE.midPlaneSize - HALF) * (right[0] + right[1]) + gap);
        const name = el("span", {
            className: "tag label3d--wide",
            text: "mid-plane",
            attrs: {
                style: `color: ${STACK_STYLE.midPlaneColor}`,
                "aria-hidden": "true",
            },
        });
        const planeLabel = labels.add(name, [HALF + reach * right[0],
                                             HALF + reach * right[1], 0]);
        planeLabel.center.set(0, 0.5);       // left edge at the point

        current = { group, plies, buttons, labels: [...placed, planeLabel] };
        setLineResolution();
        if (hadFocus) {
            // No scroll: the label has its screen place only after the next frame.
            buttons[selected]?.focus({ preventScroll: true });
        }
        view.requestRender();
    }

    // A short click or tap on a ply selects it; a drag only rotates the view.
    const canvas = view.renderer.domElement;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    let down = null;
    canvas.addEventListener("pointerdown", (event) => {
        down = [event.clientX, event.clientY];
    });
    canvas.addEventListener("pointerup", (event) => {
        if (!down || !current) {
            return;
        }
        const moved = Math.hypot(event.clientX - down[0], event.clientY - down[1]);
        down = null;
        if (moved > CLICK_TOLERANCE_PX) {
            return;
        }
        const box = canvas.getBoundingClientRect();
        pointer.set(((event.clientX - box.left) / box.width) * 2 - 1,
                    -((event.clientY - box.top) / box.height) * 2 + 1);
        raycaster.setFromCamera(pointer, view.camera);
        const hit = raycaster.intersectObjects(current.plies, false)[0];
        if (hit) {
            onSelect(hit.object.userData.ply);
        }
    });

    return Object.freeze({ update, view });
}
