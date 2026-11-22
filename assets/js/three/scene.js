/** Shared 3D view: renderer, orthographic camera, rotation, render on demand. */

import {
    DirectionalLight,
    HemisphereLight,
    MathUtils,
    OrthographicCamera,
    Scene,
    Vector3,
    WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Axes: x and y in the plane, z up (through the thickness), as in Kaw.
const DEFAULTS = Object.freeze({
    elevation: 24,          // degrees above the x-y plane
    azimuth: -58,           // degrees from the x axis
    viewSize: 2,            // world units that always fit in the view
    viewWidth: null,        // world units that fit across (null: viewSize)
    target: [0, 0, 0],
    minZoom: 0.6,
    maxZoom: 3,
    maxPixelRatio: 2,
});
const CAMERA_DISTANCE = 10;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;
const SKY_COLOR = 0xFFFFFF;
const GROUND_COLOR = 0xDCE4DF;
const SKY_INTENSITY = 2.0;
const SUN_INTENSITY = 1.2;
const SUN_POSITION = [3, -4, 6];

/** Return the unit vector from the target to the eye (angles in degrees). */
export function viewDirection(elevation, azimuth) {
    const el = MathUtils.degToRad(elevation);
    const az = MathUtils.degToRad(azimuth);
    return new Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az),
                       Math.sin(el));
}

/**
 * Make a 3D view that fills container and return its parts.
 *
 * Returns scene, camera, renderer, controls, requestRender(), onRender(fn),
 * onResize(fn), resetView(), and dispose(). The view draws a frame only
 * after requestRender() or a rotation, never in a loop.
 */
export function createView(container, options = {}) {
    const settings = { ...DEFAULTS, ...options };
    const scene = new Scene();
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.maxPixelRatio));
    container.append(renderer.domElement);

    const camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
    camera.up.set(0, 0, 1);
    const target = new Vector3(...settings.target);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minZoom = settings.minZoom;
    controls.maxZoom = settings.maxZoom;

    scene.add(new HemisphereLight(SKY_COLOR, GROUND_COLOR, SKY_INTENSITY));
    const sun = new DirectionalLight(SKY_COLOR, SUN_INTENSITY);
    sun.position.set(...SUN_POSITION);
    scene.add(sun);

    const renderHooks = new Set();
    const resizeHooks = new Set();
    let size = null;
    let frameRequested = false;

    function render() {
        frameRequested = false;
        renderer.render(scene, camera);
        for (const hook of renderHooks) {
            hook();
        }
    }

    function requestRender() {
        if (!frameRequested) {
            frameRequested = true;
            window.requestAnimationFrame(render);
        }
    }

    function resize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) {
            return;
        }
        size = [width, height];
        renderer.setSize(width, height);
        // viewSize fits up and down, viewWidth across, also in a narrow view.
        const aspect = width / height;
        const across = settings.viewWidth ?? settings.viewSize;
        const halfHeight = Math.max(settings.viewSize / 2, across / 2 / aspect);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        for (const hook of resizeHooks) {
            hook(width, height);
        }
        requestRender();
    }

    function resetView() {
        const eye = viewDirection(settings.elevation, settings.azimuth)
            .multiplyScalar(CAMERA_DISTANCE);
        camera.position.copy(target).add(eye);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        controls.target.copy(target);
        controls.update();
        requestRender();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    controls.addEventListener("change", requestRender);
    resetView();
    resize();

    return Object.freeze({
        scene,
        camera,
        renderer,
        controls,
        requestRender,
        resetView,
        onRender(hook) {
            renderHooks.add(hook);
            return () => renderHooks.delete(hook);
        },
        onResize(hook) {
            resizeHooks.add(hook);
            if (size) {
                hook(...size);
            }
            return () => resizeHooks.delete(hook);
        },
        dispose() {
            observer.disconnect();
            controls.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        },
    });
}
