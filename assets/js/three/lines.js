/** Thick 3D lines (a width in pixels), solid or dashed, for the 3D views. */

import { Color, Vector2 } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

/**
 * Return a thick line through 3D points ([x, y, z] arrays).
 *
 * width is in pixels; dashSize and gapSize are in world units.
 */
export function thickLine(points, { color, width, dashed = false, dashSize = 0.03,
                                    gapSize = 0.02 }) {
    const geometry = new LineGeometry();
    geometry.setPositions(points.flat());
    const material = new LineMaterial({
        color: new Color(color),
        linewidth: width,
        dashed,
        dashSize,
        gapSize,
    });
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return line;
}

/**
 * Give the thick lines under root the pixel size of the view.
 *
 * A thick line needs it to draw its width in pixels. Call it after a
 * resize and after new lines are added.
 */
export function updateLineResolution(view, root) {
    const resolution = view.renderer.getSize(new Vector2());
    root?.traverse((object) => {
        if (object.material instanceof LineMaterial) {
            object.material.resolution.copy(resolution);
        }
    });
}
