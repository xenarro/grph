// Draws the graph on graph paper and handles editing with the mouse, pen or touch:
// - click empty paper: add a point
// - drag a point: move it
// - click a point, then another point: connect them
// - click an edge: select it
// - Delete or Backspace: remove the selection; Escape: clear it

import { edgeKey } from "../../src/algorithms/trace";
import Edge from "../../src/graph/interfaces/edge";
import { App } from "./app";
import { classes, isTyping, s } from "./dom";
import { Position, VIEW } from "./model";

const EDGE_MARKS = ["plain", "tree", "skipped", "result", "error"] as const;
const DRAG_THRESHOLD = 4;

export const pointRadius = (name: string): number => Math.max(20, name.length * 4 + 8);

export function mountCanvas(svg: SVGSVGElement, app: App): void {
    svg.setAttribute("viewBox", `0 0 ${VIEW.width} ${VIEW.height}`);
    svg.setAttribute("role", "application");
    svg.setAttribute("aria-label", "Graph drawing. Click empty paper to add a point, drag a point to move it, click two points to connect them.");

    const defs = s("defs", {}, [
        s("pattern", { id: "grid-minor", width: 20, height: 20, patternUnits: "userSpaceOnUse" }, [
            s("path", { d: "M 20 0 L 0 0 0 20", class: "grid-line" }),
        ]),
        s("pattern", { id: "grid", width: 100, height: 100, patternUnits: "userSpaceOnUse" }, [
            s("rect", { width: 100, height: 100, fill: "url(#grid-minor)" }),
            s("path", { d: "M 100 0 L 0 0 0 100", class: "grid-line strong" }),
        ]),
        ...EDGE_MARKS.map(mark =>
            s("marker", {
                id: `arrow-${mark}`, viewBox: "0 0 12 12", refX: 11, refY: 6,
                markerWidth: 12, markerHeight: 12, markerUnits: "userSpaceOnUse", orient: "auto",
            }, [s("path", { d: "M 0 0 L 12 6 L 0 12 z", class: `arrow arrow-${mark}` })])
        ),
    ]);
    // the paper reaches past the drawing area so a wide or tall window shows no edges
    const paper = s("rect", { x: -3000, y: -3000, width: VIEW.width + 6000, height: VIEW.height + 6000, fill: "url(#grid)" });
    const edgeLayer = s("g");
    const pointLayer = s("g");
    const emptyHint = s("text", { x: VIEW.width / 2, y: VIEW.height / 2, class: "empty-hint" }, ["Click anywhere on the paper to add a point."]);
    svg.append(defs, paper, edgeLayer, pointLayer, emptyHint);

    const render = () => {
        const { model } = app;
        const edges = model.edges();
        const showWeights = edges.some(edge => edge.weight !== 1);
        edgeLayer.replaceChildren(...edges.map(edge => drawEdge(app, edge, showWeights)));
        pointLayer.replaceChildren(...model.points().map(name => drawPoint(app, name)));
        emptyHint.style.display = model.points().length ? "none" : "";
    };
    app.on(render);
    render();

    // ---- pointer input

    type Press =
        | { kind: "point"; name: string; start: Position; offset: Position; moved: boolean }
        | { kind: "edge"; from: string; to: string }
        | { kind: "paper"; at: Position };
    let press: Press | null = null;

    const toDrawing = (event: PointerEvent): Position => {
        const matrix = svg.getScreenCTM();
        if (!matrix) {
            return { x: 0, y: 0 };
        }
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        return { x: point.x, y: point.y };
    };

    svg.addEventListener("pointerdown", event => {
        if (event.button !== 0) {
            return;
        }
        const at = toDrawing(event);
        const target = event.target as Element;
        const pointElement = target.closest<SVGGElement>("[data-point]");
        const edgeElement = target.closest<SVGGElement>("[data-from]");

        if (pointElement) {
            const name = pointElement.dataset.point!;
            const position = app.model.position(name);
            press = { kind: "point", name, start: at, offset: { x: position.x - at.x, y: position.y - at.y }, moved: false };
        } else if (edgeElement) {
            press = { kind: "edge", from: edgeElement.dataset.from!, to: edgeElement.dataset.to! };
        } else {
            press = { kind: "paper", at };
        }
        svg.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    svg.addEventListener("pointermove", event => {
        if (press?.kind !== "point") {
            return;
        }
        const at = toDrawing(event);
        if (!press.moved && Math.hypot(at.x - press.start.x, at.y - press.start.y) > DRAG_THRESHOLD) {
            press.moved = true;
            svg.classList.add("dragging");
        }
        if (press.moved) {
            app.movePoint(press.name, { x: at.x + press.offset.x, y: at.y + press.offset.y });
        }
    });

    svg.addEventListener("pointerup", () => {
        const released = press;
        press = null;
        svg.classList.remove("dragging");
        if (!released) {
            return;
        }
        if (released.kind === "point") {
            if (!released.moved) {
                app.clickPoint(released.name);
            }
        } else if (released.kind === "edge") {
            app.select({ kind: "edge", from: released.from, to: released.to });
        } else if (app.selection) {
            // the first click on empty paper clears the selection, the next one adds a point
            app.select(null);
        } else {
            app.addPoint(released.at);
        }
    });

    svg.addEventListener("pointercancel", () => {
        press = null;
        svg.classList.remove("dragging");
    });

    document.addEventListener("keydown", event => {
        if (isTyping()) {
            return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
            if (app.selection) {
                event.preventDefault();
                app.deleteSelection();
            }
        } else if (event.key === "Escape") {
            app.select(null);
        }
    });
}

function drawEdge(app: App, edge: Edge, showWeight: boolean): SVGGElement {
    const { model, step } = app;
    const directed = model.directed;
    const key = edgeKey(edge.from, edge.to, directed);
    const mark = step?.edges[key];
    const focus = step?.focus.edge;
    const focused = focus !== undefined && edgeKey(focus.from, focus.to, directed) === key;
    const selected = app.isSelectedEdge(edge.from, edge.to);

    // two opposite directed edges are drawn as curves so both stay visible
    const curved = directed && model.hasEdge(edge.to, edge.from);
    const { d, middle } = edgeGeometry(
        model.position(edge.from), model.position(edge.to),
        pointRadius(edge.from), pointRadius(edge.to), curved,
    );

    return s("g", {
        class: classes({ edge: true, [`mark-${mark}`]: mark !== undefined, focused, selected }),
        "data-from": edge.from,
        "data-to": edge.to,
    }, [
        focused && s("path", { d, class: "edge-highlight" }),
        selected && s("path", { d, class: "edge-selection" }),
        s("path", { d, class: "edge-line", "marker-end": directed ? `url(#arrow-${mark ?? "plain"})` : undefined }),
        s("path", { d, class: "edge-hit" }),
        showWeight && s("text", { x: middle.x, y: middle.y, class: "edge-weight" }, [edge.weight]),
    ]);
}

function drawPoint(app: App, name: string): SVGGElement {
    const { step } = app;
    const { x, y } = app.model.position(name);
    const r = pointRadius(name);
    const mark = step?.points[name];
    // the highlighter ring marks a point the algorithm is reading that is not the current one
    const focused = step?.focus.point === name && mark !== "current";
    const selected = app.isSelectedPoint(name);
    const label = step?.labels[name];

    return s("g", {
        class: classes({ point: true, [`mark-${mark}`]: mark !== undefined, selected }),
        "data-point": name,
        transform: `translate(${round(x)} ${round(y)})`,
    }, [
        focused && s("circle", { r: r + 9, class: "point-highlight" }),
        selected && s("circle", { r: r + 6, class: "point-selection" }),
        s("circle", { r, class: "point-body" }),
        s("text", { class: "point-name", dy: "0.32em" }, [name]),
        label !== undefined && s("g", { class: "point-label", transform: `translate(${round(r * 0.75)} ${round(-r * 0.75)})` }, [
            s("circle", { r: 10 }),
            s("text", { dy: "0.35em" }, [label]),
        ]),
    ]);
}

// A straight line (or a curve bending to the left of its direction) between the edges of two circles.
function edgeGeometry(a: Position, b: Position, radiusA: number, radiusB: number, curved: boolean) {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const bend = curved ? 34 : 0;
    const control = { x: (a.x + b.x) / 2 + normal.x * bend, y: (a.y + b.y) / 2 + normal.y * bend };

    const start = moveToward(a, control, radiusA);
    const end = moveToward(b, control, radiusB + 1);
    const d = curved
        ? `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`
        : `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`;
    // the middle of the quadratic curve, or of the line
    const middle = {
        x: round(0.25 * start.x + 0.5 * control.x + 0.25 * end.x),
        y: round(0.25 * start.y + 0.5 * control.y + 0.25 * end.y),
    };
    return { d, middle };
}

function moveToward(from: Position, to: Position, distance: number): Position {
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: from.x + (to.x - from.x) / length * distance, y: from.y + (to.y - from.y) / length * distance };
}

const round = (value: number) => Math.round(value * 10) / 10;
