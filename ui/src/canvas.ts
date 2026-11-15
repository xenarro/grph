// Draws the graph on graph paper with a 2D canvas, and handles editing and moving around:
// - click empty paper: add a point; drag empty paper: move the view
// - drag a point: move it
// - click a point, then another point: connect them
// - click an edge: select it
// - wheel, trackpad pinch or two fingers: zoom around the pointer; the buttons zoom and fit the graph
// - Delete or Backspace: remove the selection; Escape: clear it
//
// A canvas is one picture, so drawing 100,000 points costs pixels, not page elements: the SVG
// it replaced made several elements for every point and edge. Only what is in view is drawn,
// and how much detail depends on how big a point is on screen: circles with names when
// zoomed in, small circles further out, and single dots when the whole of a big graph is in view.

import { edgeKey } from "../../src/algorithms/trace";
import Edge from "../../src/graph/interfaces/edge";
import { App } from "./app";
import { mix, pack, rgb } from "./colors";
import { h, isTyping } from "./dom";
import { Position, VIEW } from "./model";

export const pointRadius = (name: string): number => Math.max(20, name.length * 4 + 8);

// how far a pointer may move before a press counts as a drag, in screen pixels
const DRAG_THRESHOLD = 4;
// extra reach around points and edges for fingers, in screen pixels
const HIT_SLOP = 8;
// zooming in past this scale spreads the points apart without making them any bigger
const MAX_DRAW_SCALE = 2.5;
const MAX_SCALE = 12;

// The view: the drawing point at the top-left corner of the canvas, and screen pixels per drawing unit.
interface Camera {
    x: number;
    y: number;
    scale: number;
}

type Detail = "full" | "small" | "dots";

interface Colors {
    paper: string; grid: string; gridStrong: string; ink: string; pencil: string; node: string; gray: string;
    highlighter: string; onHighlighter: string; blue: string; red: string; onPen: string;
    fontMath: string; fontUi: string;
}

// an edge as drawn in the last frame, in screen pixels, for hit testing
interface DrawnEdge {
    edge: Edge;
    start: Position;
    control: Position | null;
    end: Position;
}

export function mountCanvas(canvas: HTMLCanvasElement, app: App): void {
    const paper = canvas.parentElement!;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "Graph drawing. Click empty paper to add a point, drag a point to move it, click two points to connect them, drag the paper to move around, and use the wheel or two fingers to zoom.");
    // A transparent canvas: an opaque one starts black, and stays black wherever drawing fails.
    const context = canvas.getContext("2d")!;

    let camera: Camera = { x: 0, y: 0, scale: 1 };
    // true until the user zooms or moves the view: a resized canvas then fits the graph again
    let fitted = true;
    let width = 0;
    let height = 0;
    let colors = readColors();

    // ---- what changes only with the graph, kept between frames

    let points: string[] = [];
    let edges: Edge[] = [];
    let keys: string[] = [];        // edgeKey() of each edge, for its algorithm mark
    let curved: boolean[] = [];     // two opposite directed edges are drawn as curves so both stay visible
    let showWeights = false;
    const index = new PointIndex();
    let drawnEdges: DrawnEdge[] = [];
    let seenLoads = -1;

    // positions by point number and edges as pairs of point numbers, for drawing a whole big graph fast
    let indexOf = new Map<string, number>();
    let xs = new Float64Array(0);
    let ys = new Float64Array(0);
    let edgeEnds = new Int32Array(0);

    const refreshGraph = () => {
        const { model } = app;
        points = model.points();
        edges = model.edges();
        indexOf = new Map(points.map((name, i) => [name, i]));
        xs = new Float64Array(points.length);
        ys = new Float64Array(points.length);
        points.forEach((name, i) => {
            const { x, y } = model.position(name);
            xs[i] = x;
            ys[i] = y;
        });
        edgeEnds = new Int32Array(edges.length * 2);
        edges.forEach((edge, i) => {
            edgeEnds[i * 2] = indexOf.get(edge.from)!;
            edgeEnds[i * 2 + 1] = indexOf.get(edge.to)!;
        });
        keys = edges.map(edge => edgeKey(edge.from, edge.to, model.directed));
        curved = edges.map(edge => model.directed && model.hasEdge(edge.to, edge.from));
        showWeights = edges.some(edge => edge.weight !== 1);
        index.rebuild(points, name => model.position(name));
    };

    // ---- camera

    const toScreen = (p: Position): Position => ({ x: (p.x - camera.x) * camera.scale, y: (p.y - camera.y) * camera.scale });
    const toWorld = (p: Position): Position => ({ x: p.x / camera.scale + camera.x, y: p.y / camera.scale + camera.y });

    // the box the whole graph fits in: the drawing area of a small graph, or around all the points
    const graphBox = () => {
        let minX = 0, minY = 0, maxX = VIEW.width, maxY = VIEW.height;
        for (const name of points) {
            const { x, y } = app.model.position(name);
            const r = pointRadius(name) + 16;
            minX = Math.min(minX, x - r); minY = Math.min(minY, y - r);
            maxX = Math.max(maxX, x + r); maxY = Math.max(maxY, y + r);
        }
        return { minX, minY, maxX, maxY };
    };

    // a few pixels of paper around the graph, so the start and target tags fit too
    const FIT_PADDING = 20;
    const fitScale = (box: { minX: number; minY: number; maxX: number; maxY: number }) =>
        Math.min((width - 2 * FIT_PADDING) / (box.maxX - box.minX), (height - 2 * FIT_PADDING) / (box.maxY - box.minY)) || 1;

    const minScale = () => Math.min(0.5, fitScale(graphBox()) / 4);

    const fit = () => {
        const box = graphBox();
        const scale = fitScale(box);
        camera = {
            scale,
            x: (box.minX + box.maxX) / 2 - width / 2 / scale,
            y: (box.minY + box.maxY) / 2 - height / 2 / scale,
        };
        fitted = true;
        schedule();
    };

    const zoomAt = (screen: Position, factor: number) => {
        const scale = Math.min(MAX_SCALE, Math.max(minScale(), camera.scale * factor));
        const world = toWorld(screen);
        camera = { scale, x: world.x - screen.x / scale, y: world.y - screen.y / scale };
        fitted = false;
        schedule(true);
    };

    // ---- drawing

    let frame = 0;
    let lastFrameMs = 0;
    // a copy of the last full frame, moved around while the view moves when drawing is slow
    const snapshot = document.createElement("canvas");
    let snapshotCamera: Camera | null = null;
    let settleTimer: number | undefined;

    // `moving` is true while the view is zooming or panning: a slow frame is then replaced by the snapshot
    const schedule = (moving = false) => {
        if (moving && lastFrameMs > 25 && snapshotCamera) {
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => schedule(), 140);
            if (!frame) {
                frame = requestAnimationFrame(drawSnapshot);
            }
            return;
        }
        if (frame) {
            cancelAnimationFrame(frame);
        }
        frame = requestAnimationFrame(draw);
    };

    const drawSnapshot = () => {
        colors = readColors();
        frame = 0;
        const from = snapshotCamera!;
        const ratio = camera.scale / from.scale;
        const dpr = window.devicePixelRatio || 1;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = colors.paper;
        context.fillRect(0, 0, width, height);
        drawGrid();
        context.drawImage(snapshot,
            (from.x - camera.x) * camera.scale, (from.y - camera.y) * camera.scale,
            width * ratio, height * ratio);
    };

    const draw = () => {
        // read every frame: cheap, follows the theme, and never stuck with colours read before the styles loaded
        colors = readColors();
        frame = 0;
        const started = performance.now();
        const dpr = window.devicePixelRatio || 1;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = colors.paper;
        context.fillRect(0, 0, width, height);
        drawGrid();

        const drawScale = Math.min(camera.scale, MAX_DRAW_SCALE);
        const onScreen = 20 * drawScale; // the radius of a one-letter point, in pixels
        const detail: Detail = onScreen >= 9 ? "full" : onScreen >= 2.5 ? "small" : "dots";

        if (detail === "dots") {
            drawOverview(drawScale);
        } else {
            drawEdges(detail, drawScale);
        }
        drawPoints(detail, drawScale);

        if (points.length === 0) {
            context.font = `18px ${colors.fontUi}`;
            context.fillStyle = colors.pencil;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("Click anywhere on the paper to add a point.", width / 2, height / 2);
        }

        lastFrameMs = performance.now() - started;
        if (lastFrameMs > 25) {
            // only slow frames are worth keeping for moving the view; the copy itself is cheap
            snapshot.width = canvas.width;
            snapshot.height = canvas.height;
            snapshot.getContext("2d")!.drawImage(canvas, 0, 0);
            snapshotCamera = { ...camera };
        }
    };

    // graph paper: thin lines every 20 units and stronger ones every 100, or wider apart when zoomed out
    const drawGrid = () => {
        let step = 20;
        while (step * camera.scale < 9) {
            step *= 5;
        }
        const left = Math.floor(camera.x / step) * step;
        const top = Math.floor(camera.y / step) * step;
        const right = camera.x + width / camera.scale;
        const bottom = camera.y + height / camera.scale;
        for (const strong of [false, true]) {
            context.beginPath();
            for (let x = left; x <= right; x += step) {
                if (isStrong(x, step) === strong) {
                    const sx = Math.round((x - camera.x) * camera.scale) + 0.5;
                    context.moveTo(sx, 0);
                    context.lineTo(sx, height);
                }
            }
            for (let y = top; y <= bottom; y += step) {
                if (isStrong(y, step) === strong) {
                    const sy = Math.round((y - camera.y) * camera.scale) + 0.5;
                    context.moveTo(0, sy);
                    context.lineTo(width, sy);
                }
            }
            context.strokeStyle = strong ? colors.gridStrong : colors.grid;
            context.lineWidth = 1;
            context.stroke();
        }
    };
    const isStrong = (value: number, step: number) => Math.round(value / step) % 5 === 0;

    const drawEdges = (detail: Detail, drawScale: number) => {
        const { model, step } = app;
        const directed = model.directed;
        const focus = step?.focus.edge;
        const focusKey = focus ? edgeKey(focus.from, focus.to, directed) : null;
        const selected = app.selection?.kind === "edge" ? edgeKey(app.selection.from, app.selection.to, directed) : null;
        const margin = 40 * drawScale;
        const visible = (p: Position) => p.x > -margin && p.y > -margin && p.x < width + margin && p.y < height + margin;
        const full = detail === "full";

        // edges grouped by how they look, so each group is drawn in one go
        const groups = new Map<string, DrawnEdge[]>();
        const under: { drawn: DrawnEdge; kind: "highlight" | "selection" }[] = [];
        const weights: { at: Position; weight: number }[] = [];
        drawnEdges = [];

        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const a = toScreen(model.position(edge.from));
            const b = toScreen(model.position(edge.to));
            if (!visible(a) && !visible(b) && !crosses(a, b, width, height)) {
                continue;
            }
            const drawn = edgeGeometry(edge, a, b,
                full ? pointRadius(edge.from) * drawScale : 0,
                full ? pointRadius(edge.to) * drawScale + 1 : 0,
                curved[i] ? 34 * drawScale : 0);
            drawnEdges.push(drawn);

            const mark = step?.edges.get(keys[i]) ?? "plain";
            const group = groups.get(mark) ?? [];
            group.push(drawn);
            groups.set(mark, group);
            if (keys[i] === focusKey) {
                under.push({ drawn, kind: "highlight" });
            }
            if (keys[i] === selected) {
                under.push({ drawn, kind: "selection" });
            }
            if (full && showWeights) {
                weights.push({ at: middleOf(drawn), weight: edge.weight });
            }
        }

        // the highlighter under the edge being read, and the selection
        context.lineCap = "round";
        for (const { drawn, kind } of under) {
            context.beginPath();
            tracePath(context, drawn);
            context.strokeStyle = kind === "highlight" ? colors.highlighter : colors.pencil;
            context.globalAlpha = kind === "highlight" ? 1 : 0.3;
            context.lineWidth = Math.max(kind === "highlight" ? 8 : 6, (kind === "highlight" ? 18 : 12) * drawScale);
            context.stroke();
        }
        context.globalAlpha = 1;
        context.lineCap = "butt";

        for (const [mark, group] of groups) {
            const look = EDGE_LOOK[mark as keyof typeof EDGE_LOOK];
            const color = colors[look.color];
            context.beginPath();
            group.forEach(drawn => tracePath(context, drawn));
            context.strokeStyle = color;
            // in a whole big graph a result or a cycle has to stand out from thousands of thin lines
            const standsOut = mark === "result" || mark === "error";
            context.lineWidth = detail === "dots" ? (standsOut ? 3 : 1) : Math.max(1, look.width * drawScale);
            context.globalAlpha = detail === "dots" && (mark === "plain" || mark === "skipped") ? 0.35 : 1;
            context.setLineDash(mark === "skipped" && detail !== "dots" ? [6 * drawScale, 5 * drawScale] : []);
            context.stroke();
            context.setLineDash([]);
            context.globalAlpha = 1;

            if (directed && detail !== "dots") {
                context.beginPath();
                group.forEach(drawn => traceArrow(context, drawn, 12 * drawScale));
                context.fillStyle = color;
                context.fill();
            }
        }

        if (weights.length) {
            context.font = `500 ${14 * drawScale}px ${colors.fontUi}`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.lineJoin = "round";
            context.lineWidth = 5 * drawScale;
            context.strokeStyle = colors.paper;
            context.fillStyle = colors.ink;
            for (const { at, weight } of weights) {
                context.strokeText(String(weight), at.x, at.y);
                context.fillText(String(weight), at.x, at.y);
            }
        }
    };

    // A whole big graph, written straight into an image: hundreds of thousands of tiny lines and dots
    // cost far less as pixels in an array than as as many separate drawing calls.
    const overview = { canvas: document.createElement("canvas"), image: new ImageData(1, 1), pixels: new Uint32Array(1) };

    const drawOverview = (drawScale: number) => {
        const w = canvas.width;
        const h = canvas.height;
        if (overview.image.width !== w || overview.image.height !== h) {
            overview.image = new ImageData(w, h);
            overview.pixels = new Uint32Array(overview.image.data.buffer);
            overview.canvas.width = w;
            overview.canvas.height = h;
        }
        const pixels = overview.pixels;
        pixels.fill(0);
        const { step } = app;
        const k = camera.scale * (window.devicePixelRatio || 1);
        const sx = (i: number) => Math.round((xs[i] - camera.x) * k);
        const sy = (i: number) => Math.round((ys[i] - camera.y) * k);
        const plot = (x: number, y: number, color: number) => {
            if (x >= 0 && y >= 0 && x < w && y < h) {
                pixels[y * w + x] = color;
            }
        };

        const paper = rgb(colors.paper);
        const edgeColors = {
            plain: pack(mix(rgb(colors.pencil), paper, 0.35)),
            skipped: pack(mix(rgb(colors.pencil), paper, 0.35)),
            tree: pack(rgb(colors.ink)),
            result: pack(rgb(colors.blue)),
            error: pack(rgb(colors.red)),
        };
        for (let i = 0; i < edges.length; i++) {
            const mark = step?.edges.get(keys[i]) ?? "plain";
            const thick = mark === "result" || mark === "error";
            const a = edgeEnds[i * 2];
            const b = edgeEnds[i * 2 + 1];
            rasterLine(sx(a), sy(a), sx(b), sy(b), w, h, (x, y) => {
                plot(x, y, edgeColors[mark]);
                if (thick) {
                    plot(x + 1, y, edgeColors[mark]);
                    plot(x, y + 1, edgeColors[mark]);
                }
            });
        }

        // one small square per point, smaller when the points are close together
        const dot = Math.max(1, Math.min(3, Math.round(20 * drawScale * 1.2))) * Math.round(window.devicePixelRatio || 1);
        const pointColors: Record<PointLook, number> = {
            plain: pack(rgb(colors.pencil)), active: pack(rgb(colors.gray)), done: pack(rgb(colors.ink)),
            current: pack(rgb(colors.highlighter)), result: pack(rgb(colors.blue)), error: pack(rgb(colors.red)),
        };
        for (let i = 0; i < points.length; i++) {
            const x = sx(i);
            const y = sy(i);
            if (x < -4 || y < -4 || x >= w + 4 || y >= h + 4) {
                continue;
            }
            const mark: PointLook = step?.points.get(points[i]) ?? "plain";
            const size = mark === "result" || mark === "error" ? Math.max(dot, 4) : dot;
            const half = size >> 1;
            for (let dy = 0; dy < size; dy++) {
                for (let dx = 0; dx < size; dx++) {
                    plot(x - half + dx, y - half + dy, pointColors[mark]);
                }
            }
        }

        overview.canvas.getContext("2d")!.putImageData(overview.image, 0, 0);
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(overview.canvas, 0, 0);
        context.restore();
        drawnEdges = [];
    };

    const drawPoints = (detail: Detail, drawScale: number) => {
        const { model, step } = app;
        const margin = 60 * drawScale;
        const look = (name: string) => {
            const at = toScreen(model.position(name));
            if (at.x < -margin || at.y < -margin || at.x > width + margin || at.y > height + margin) {
                return null;
            }
            const r = detail === "dots" ? 1.5 : pointRadius(name) * drawScale;
            return { name, at, r, mark: (step?.points.get(name) ?? "plain") as PointLook };
        };
        // in the overview every point is already a pixel: only the few marked ones are looked up here
        const selectedName = app.selection?.kind === "point" ? app.selection.name : null;
        const names = detail === "dots"
            ? [...new Set([step?.focus.point, app.start, app.target, selectedName])].filter((name): name is string => !!name && model.list.hasPoint(name))
            : points;
        const shown = names.map(look).filter(p => p !== null);

        // the highlighter under a point the algorithm reads that is not the current one
        const focusName = step?.focus.point;
        for (const { name, at, r, mark } of shown) {
            if (name === focusName && mark !== "current") {
                context.beginPath();
                context.arc(at.x, at.y, Math.max(r + 9 * drawScale, 6), 0, Math.PI * 2);
                context.fillStyle = colors.highlighter;
                context.fill();
            }
        }

        if (detail !== "dots") {
            // circles grouped by look: one path per look, filled and outlined once
            const groups = new Map<PointLook, typeof shown>();
            for (const point of shown) {
                const group = groups.get(point.mark) ?? [];
                group.push(point);
                groups.set(point.mark, group);
            }
            for (const [mark, group] of groups) {
                const pointLook = POINT_LOOK[mark];
                context.beginPath();
                for (const { at, r } of group) {
                    context.moveTo(at.x + r, at.y);
                    context.arc(at.x, at.y, r, 0, Math.PI * 2);
                }
                context.fillStyle = colors[pointLook.fill];
                context.fill();
                context.strokeStyle = colors[pointLook.stroke];
                context.lineWidth = detail === "full" ? (mark === "current" ? 3 : 2) * drawScale : 1;
                context.stroke();
            }
        }

        if (detail === "full") {
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.font = `italic ${19 * drawScale}px ${colors.fontMath}`;
            for (const { name, at, mark } of shown) {
                context.fillStyle = colors[POINT_LOOK[mark].text];
                context.fillText(name, at.x, at.y + 1 * drawScale);
            }
            // the order an algorithm reached a point in, on a small badge
            context.font = `600 ${11 * drawScale}px ${colors.fontUi}`;
            for (const { name, at, r } of shown) {
                const label = step?.labels.get(name);
                if (label === undefined) {
                    continue;
                }
                const bx = at.x + r * 0.75;
                const by = at.y - r * 0.75;
                context.beginPath();
                context.arc(bx, by, 10 * drawScale, 0, Math.PI * 2);
                context.fillStyle = colors.paper;
                context.fill();
                context.lineWidth = 1;
                context.strokeStyle = colors.ink;
                context.stroke();
                context.fillStyle = colors.ink;
                context.fillText(label, bx, by + 0.5 * drawScale);
            }
        }

        // where a search starts and ends, tagged in every level of detail so they can be found in a big graph
        const ends = [{ name: app.start, tag: "start" }, { name: app.target, tag: "target" }];
        context.font = `600 11px ${colors.fontUi}`;
        context.textAlign = "center";
        context.textBaseline = "bottom";
        for (const { name, tag } of ends) {
            const end = name === null ? undefined : shown.find(p => p.name === name);
            if (!end) {
                continue;
            }
            const ring = Math.max(end.r + 4 * drawScale, 6);
            context.beginPath();
            context.arc(end.at.x, end.at.y, ring, 0, Math.PI * 2);
            context.strokeStyle = colors.ink;
            context.lineWidth = 2;
            context.stroke();
            context.lineJoin = "round";
            context.lineWidth = 4;
            context.strokeStyle = colors.paper;
            context.strokeText(tag, end.at.x, end.at.y - ring - 3);
            context.fillStyle = colors.ink;
            context.fillText(tag, end.at.x, end.at.y - ring - 3);
        }

        const selected = app.selection?.kind === "point" ? app.selection.name : null;
        const chosen = selected === null ? undefined : shown.find(p => p.name === selected);
        if (chosen) {
            context.beginPath();
            context.arc(chosen.at.x, chosen.at.y, Math.max(chosen.r + 6 * drawScale, 7), 0, Math.PI * 2);
            context.setLineDash([4, 4]);
            context.strokeStyle = colors.ink;
            context.lineWidth = 1.5;
            context.stroke();
            context.setLineDash([]);
        }
    };

    // ---- hit testing

    const pointAt = (screen: Position): string | null => {
        const drawScale = Math.min(camera.scale, MAX_DRAW_SCALE);
        const circles = 20 * drawScale >= 2.5;
        const world = toWorld(screen);
        const reach = (name: string) => ((circles ? pointRadius(name) * drawScale : 3) + HIT_SLOP) / camera.scale;
        let best: string | null = null;
        let bestDistance = Infinity;
        for (const name of index.near(world, (60 * drawScale + HIT_SLOP) / camera.scale)) {
            const p = app.model.position(name);
            const distance = Math.hypot(p.x - world.x, p.y - world.y);
            if (distance <= reach(name) && distance < bestDistance) {
                best = name;
                bestDistance = distance;
            }
        }
        return best;
    };

    // edges are found among the ones drawn in the last frame; with very many on screen they can't be picked
    const edgeAt = (screen: Position): Edge | null => {
        if (drawnEdges.length > 20000) {
            return null;
        }
        let best: Edge | null = null;
        let bestDistance = HIT_SLOP;
        for (const drawn of drawnEdges) {
            const distance = distanceToEdge(screen, drawn);
            if (distance <= bestDistance) {
                best = drawn.edge;
                bestDistance = distance;
            }
        }
        return best;
    };

    // ---- pointer input

    type Press =
        | { kind: "point"; name: string; start: Position; offset: Position; moved: boolean }
        | { kind: "edge"; from: string; to: string }
        | { kind: "paper"; start: Position; from: Camera; moved: boolean };
    let press: Press | null = null;
    const pointers = new Map<number, Position>();
    let pinch: { distance: number; center: Position; from: Camera } | null = null;

    const screenOf = (event: PointerEvent | WheelEvent): Position => {
        const box = canvas.getBoundingClientRect();
        return { x: event.clientX - box.left, y: event.clientY - box.top };
    };

    const pinchState = () => {
        const [a, b] = [...pointers.values()];
        return { distance: Math.hypot(b.x - a.x, b.y - a.y) || 1, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    canvas.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        const at = screenOf(event);
        pointers.set(event.pointerId, at);
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = "";
        event.preventDefault();

        if (pointers.size === 2) {
            // a second finger turns the press into a pinch
            press = null;
            canvas.classList.remove("dragging");
            pinch = { ...pinchState(), from: { ...camera } };
            return;
        }
        if (pointers.size > 2) {
            return;
        }

        const name = pointAt(at);
        if (name) {
            const p = app.model.position(name);
            const world = toWorld(at);
            press = { kind: "point", name, start: at, offset: { x: p.x - world.x, y: p.y - world.y }, moved: false };
            return;
        }
        const edge = edgeAt(at);
        press = edge ? { kind: "edge", from: edge.from, to: edge.to } : { kind: "paper", start: at, from: { ...camera }, moved: false };
    });

    canvas.addEventListener("pointermove", event => {
        const at = screenOf(event);
        if (!pointers.has(event.pointerId)) {
            // hovering: show what a press would do
            canvas.style.cursor = pointAt(at) ? "grab" : edgeAt(at) ? "pointer" : "";
            return;
        }
        pointers.set(event.pointerId, at);

        if (pinch && pointers.size === 2) {
            const { distance, center } = pinchState();
            const scale = Math.min(MAX_SCALE, Math.max(minScale(), pinch.from.scale * distance / pinch.distance));
            // the drawing point under the fingers' first center follows the fingers
            const world = { x: pinch.center.x / pinch.from.scale + pinch.from.x, y: pinch.center.y / pinch.from.scale + pinch.from.y };
            camera = { scale, x: world.x - center.x / scale, y: world.y - center.y / scale };
            fitted = false;
            schedule(true);
            return;
        }
        if (!press || press.kind === "edge") {
            return;
        }
        if (!press.moved && Math.hypot(at.x - press.start.x, at.y - press.start.y) > DRAG_THRESHOLD) {
            press.moved = true;
            canvas.classList.add("dragging");
        }
        if (!press.moved) {
            return;
        }
        if (press.kind === "point") {
            const world = toWorld(at);
            const position = { x: world.x + press.offset.x, y: world.y + press.offset.y };
            index.move(press.name, app.model.position(press.name), position);
            const i = indexOf.get(press.name);
            if (i !== undefined) {
                xs[i] = position.x;
                ys[i] = position.y;
            }
            app.movePoint(press.name, position);
        } else {
            camera = {
                ...press.from,
                x: press.from.x - (at.x - press.start.x) / press.from.scale,
                y: press.from.y - (at.y - press.start.y) / press.from.scale,
            };
            fitted = false;
            schedule(true);
        }
    });

    const release = (event: PointerEvent, cancelled: boolean) => {
        pointers.delete(event.pointerId);
        if (pinch) {
            if (pointers.size < 2) {
                pinch = null;
            }
            return;
        }
        const released = press;
        press = null;
        canvas.classList.remove("dragging");
        if (!released || cancelled) {
            return;
        }
        if (released.kind === "point") {
            if (!released.moved) {
                app.clickPoint(released.name);
            }
        } else if (released.kind === "edge") {
            app.select({ kind: "edge", from: released.from, to: released.to });
        } else if (!released.moved) {
            if (app.selection) {
                // the first click on empty paper clears the selection, the next one adds a point
                app.select(null);
            } else {
                app.addPoint(toWorld(released.start));
            }
        }
    };
    canvas.addEventListener("pointerup", event => release(event, false));
    canvas.addEventListener("pointercancel", event => release(event, true));

    canvas.addEventListener("wheel", event => {
        event.preventDefault();
        const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
        // a trackpad pinch arrives as a wheel event with the control key held
        const speed = event.ctrlKey ? 0.01 : 0.0015;
        zoomAt(screenOf(event), Math.exp(-event.deltaY * lines * speed));
    }, { passive: false });

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

    // ---- zoom buttons

    const button = (label: string, text: string, action: () => void) => {
        const element = h("button", { type: "button", "aria-label": label, title: label }, [text]);
        element.addEventListener("click", action);
        return element;
    };
    const middle = () => ({ x: width / 2, y: height / 2 });
    paper.append(h("div", { class: "zoom" }, [
        button("Zoom in", "+", () => zoomAt(middle(), 1.5)),
        button("Zoom out", "−", () => zoomAt(middle(), 1 / 1.5)),
        button("Fit the whole graph", "Fit", fit),
    ]));

    // ---- size, theme and fonts

    const resize = () => {
        const box = paper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const centerWorld = toWorld(middle());
        width = Math.max(1, box.width);
        height = Math.max(1, box.height);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        lastFrameMs = 0;
        if (fitted) {
            fit();
        } else {
            // keep the same drawing point in the middle
            camera = { ...camera, x: centerWorld.x - width / 2 / camera.scale, y: centerWorld.y - height / 2 / camera.scale };
            schedule();
        }
    };
    new ResizeObserver(resize).observe(paper);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        colors = readColors();
        schedule();
    });
    document.fonts?.ready.then(() => schedule());

    app.on(change => {
        if (change === "graph") {
            refreshGraph();
        }
        if (app.loads !== seenLoads) {
            // a new graph: show all of it
            seenLoads = app.loads;
            fit();
            return;
        }
        schedule();
    });

    refreshGraph();
    seenLoads = app.loads;
    resize();
}

// ---- looks, matching the legend under the drawing (legend.ts)

const EDGE_LOOK = {
    plain: { color: "pencil", width: 2 },
    tree: { color: "ink", width: 3.5 },
    skipped: { color: "pencil", width: 2 },
    result: { color: "blue", width: 4 },
    error: { color: "red", width: 4 },
} as const;

const POINT_LOOK = {
    plain: { fill: "node", stroke: "ink", text: "ink", dot: "pencil" },
    active: { fill: "gray", stroke: "ink", text: "ink", dot: "gray" },
    done: { fill: "ink", stroke: "ink", text: "paper", dot: "ink" },
    current: { fill: "highlighter", stroke: "ink", text: "onHighlighter", dot: "highlighter" },
    result: { fill: "blue", stroke: "blue", text: "onPen", dot: "blue" },
    error: { fill: "red", stroke: "red", text: "onPen", dot: "red" },
} as const;
type PointLook = keyof typeof POINT_LOOK;

// the light theme, for the moment before the page's styles have loaded
const FALLBACK: Record<string, string> = {
    "--paper": "#eef2ea", "--grid": "#dce4d6", "--grid-strong": "#c9d4c2", "--ink": "#1f2a2e", "--pencil": "#56645c",
    "--node": "#ffffff", "--gray": "#aeb8b1", "--highlighter": "#f5e15a", "--on-highlighter": "#1f2a2e",
    "--blue": "#1d5fbf", "--red": "#c42f2f", "--on-pen": "#ffffff", "--font-math": "serif", "--font-ui": "sans-serif",
};

function readColors(): Colors {
    const style = getComputedStyle(document.documentElement);
    const value = (name: string) => style.getPropertyValue(name).trim() || FALLBACK[name];
    return {
        paper: value("--paper"), grid: value("--grid"), gridStrong: value("--grid-strong"),
        ink: value("--ink"), pencil: value("--pencil"), node: value("--node"), gray: value("--gray"),
        highlighter: value("--highlighter"), onHighlighter: value("--on-highlighter"),
        blue: value("--blue"), red: value("--red"), onPen: value("--on-pen"),
        fontMath: value("--font-math"), fontUi: value("--font-ui"),
    };
}

// ---- geometry, in screen pixels

// A straight line, or a curve bending to the left of its direction, between the edges of two circles.
function edgeGeometry(edge: Edge, a: Position, b: Position, radiusA: number, radiusB: number, bend: number): DrawnEdge {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const middle = { x: (a.x + b.x) / 2 + normal.x * bend, y: (a.y + b.y) / 2 + normal.y * bend };
    return {
        edge,
        start: moveToward(a, middle, radiusA),
        control: bend ? middle : null,
        end: moveToward(b, middle, radiusB),
    };
}

function moveToward(from: Position, to: Position, distance: number): Position {
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: from.x + (to.x - from.x) / length * distance, y: from.y + (to.y - from.y) / length * distance };
}

function tracePath(context: CanvasRenderingContext2D, { start, control, end }: DrawnEdge): void {
    context.moveTo(start.x, start.y);
    if (control) {
        context.quadraticCurveTo(control.x, control.y, end.x, end.y);
    } else {
        context.lineTo(end.x, end.y);
    }
}

// an arrowhead at the end of the edge, pointing along it
function traceArrow(context: CanvasRenderingContext2D, { start, control, end }: DrawnEdge, size: number): void {
    const from = control ?? start;
    const length = Math.hypot(end.x - from.x, end.y - from.y) || 1;
    const ux = (end.x - from.x) / length;
    const uy = (end.y - from.y) / length;
    context.moveTo(end.x, end.y);
    context.lineTo(end.x - ux * size - uy * size / 2, end.y - uy * size + ux * size / 2);
    context.lineTo(end.x - ux * size + uy * size / 2, end.y - uy * size - ux * size / 2);
    context.closePath();
}

// Visits the pixels of a straight line from (x0, y0) to (x1, y1) that lie in a w × h image
// (Bresenham's line algorithm). The line is first cut to the image, so a far-away end costs nothing.
function rasterLine(x0: number, y0: number, x1: number, y1: number, w: number, h: number, visit: (x: number, y: number) => void): void {
    // Liang–Barsky clipping: keep the part of the line where 0 ≤ x < w and 0 ≤ y < h
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    for (const [p, q] of [[-dx, x0], [dx, w - 1 - x0], [-dy, y0], [dy, h - 1 - y0]]) {
        if (p === 0) {
            if (q < 0) {
                return;
            }
        } else {
            const t = q / p;
            if (p < 0) {
                t0 = Math.max(t0, t);
            } else {
                t1 = Math.min(t1, t);
            }
            if (t0 > t1) {
                return;
            }
        }
    }
    let x = Math.round(x0 + t0 * dx);
    let y = Math.round(y0 + t0 * dy);
    const endX = Math.round(x0 + t1 * dx);
    const endY = Math.round(y0 + t1 * dy);
    const stepX = x < endX ? 1 : -1;
    const stepY = y < endY ? 1 : -1;
    const width = Math.abs(endX - x);
    const height = -Math.abs(endY - y);
    let error = width + height;
    for (;;) {
        visit(x, y);
        if (x === endX && y === endY) {
            return;
        }
        const twice = 2 * error;
        if (twice >= height) {
            error += height;
            x += stepX;
        }
        if (twice <= width) {
            error += width;
            y += stepY;
        }
    }
}

// the middle of the quadratic curve, or of the line
function middleOf({ start, control, end }: DrawnEdge): Position {
    const c = control ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return { x: 0.25 * start.x + 0.5 * c.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * c.y + 0.25 * end.y };
}

function distanceToEdge(p: Position, { start, control, end }: DrawnEdge): number {
    if (!control) {
        return distanceToSegment(p, start, end);
    }
    // a curve is close enough to eight straight pieces for a click
    let best = Infinity;
    let previous = start;
    for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const point = {
            x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
            y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
        };
        best = Math.min(best, distanceToSegment(p, previous, point));
        previous = point;
    }
    return best;
}

function distanceToSegment(p: Position, a: Position, b: Position): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// false when the segment's bounding box is entirely off the screen
function crosses(a: Position, b: Position, width: number, height: number): boolean {
    return !(Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > width || Math.max(a.y, b.y) < 0 || Math.min(a.y, b.y) > height);
}

// Points sorted into square cells of the drawing, so finding the points near the pointer
// looks at a few cells instead of every point of a big graph.
class PointIndex {
    private static readonly CELL = 100;
    private readonly cells = new Map<string, Set<string>>();

    rebuild(points: string[], position: (name: string) => Position): void {
        this.cells.clear();
        points.forEach(name => this.add(name, position(name)));
    }

    move(name: string, from: Position, to: Position): void {
        this.cells.get(PointIndex.key(from))?.delete(name);
        this.add(name, to);
    }

    *near(at: Position, radius: number): Iterable<string> {
        const { CELL } = PointIndex;
        const span = Math.min(50, Math.ceil(radius / CELL));
        const cx = Math.floor(at.x / CELL);
        const cy = Math.floor(at.y / CELL);
        for (let x = cx - span; x <= cx + span; x++) {
            for (let y = cy - span; y <= cy + span; y++) {
                yield* this.cells.get(`${x},${y}`) ?? [];
            }
        }
    }

    private add(name: string, at: Position): void {
        const key = PointIndex.key(at);
        const cell = this.cells.get(key) ?? new Set();
        cell.add(name);
        this.cells.set(key, cell);
    }

    private static key({ x, y }: Position): string {
        return `${Math.floor(x / PointIndex.CELL)},${Math.floor(y / PointIndex.CELL)}`;
    }
}
