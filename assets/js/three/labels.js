/** 3D labels: HTML elements placed on 3D points of a view. */

import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

/**
 * Add a label layer on top of a view and return add() and remove().
 *
 * The labels are real HTML, so they stay sharp and can be buttons.
 */
export function createLabelLayer(view, container) {
    const renderer = new CSS2DRenderer();
    renderer.domElement.classList.add("label-layer");
    container.append(renderer.domElement);
    view.onResize((width, height) => renderer.setSize(width, height));
    view.onRender(() => renderer.render(view.scene, view.camera));
    return Object.freeze({
        /** Put an element at a 3D position (in the parent's axes). */
        add(element, position, parent = view.scene) {
            const label = new CSS2DObject(element);
            label.position.set(...position);
            parent.add(label);
            view.requestRender();
            return label;
        },
        /** Take a label away. */
        remove(label) {
            label.removeFromParent();
            label.element.remove();
            view.requestRender();
        },
    });
}
