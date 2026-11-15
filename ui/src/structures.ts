// The three representations of the graph, drawn from the data each class actually stores.
// While an algorithm runs, the part it reads in the current step is highlighted:
// a point's row or list softly, the single edge being checked strongly.
// Clicking a point name or an edge entry selects it in the drawing too.
//
// A big graph has too many cells and entries for the page: past TABLE a matrix is drawn as a picture
// with a pixel per cell, and past LIST_ROWS the list shows only the rows in view.

import AdjacencyMatrix from "../../src/graph/adjacency-matrix";
import IncidenceMatrix from "../../src/graph/incidence-matrix";
import { edgeLabel } from "../../src/graph/validation";
import { App, Selection } from "./app";
import { classes, h } from "./dom";
import { GridMarks, GridPicture } from "./grid-picture";
import { ListWindow } from "./list-window";
import { MatrixId, RepresentationId } from "./model";
import { count, texts } from "./i18n";

const TABLE = { points: 40, edges: 120 };
const LIST_ROWS = 200;
// a row of a long list shows this many neighbors, then how many more there are
const LIST_ENTRIES = 12;

// what the views keep between renders
interface Views {
    readonly app: App;
    // goes up with every change of the graph, so a matrix picture knows when to draw its cells again
    readonly version: number;
    readonly matrixPicture: GridPicture;
    readonly incidencePicture: GridPicture;
    readonly listWindow: ListWindow;
    // called once the views are on the page
    readonly attached: (() => void)[];
}

export function mountStructures(root: HTMLElement, app: App): void {
    let flatArrayOpen = false;
    let version = 0;
    const matrixPicture = new GridPicture();
    const incidencePicture = new GridPicture();
    const listWindow = new ListWindow();

    const render = () => {
        const views: Views = { app, version, matrixPicture, incidencePicture, listWindow, attached: [] };
        const sections = (["matrix", "list", "incidence"] as const).map(id => {
            const reading = app.step !== null && app.readFrom === id;
            const view = id === "matrix" ? matrixView(views) : id === "list" ? listView(views) : incidenceView(views);
            return h("section", { class: classes({ structure: true, reading }), "aria-labelledby": `structure-${id}` }, [
                h("header", { class: "structure-head" }, [
                    h("h2", { id: `structure-${id}` }, [texts[app.lang].structureNames[id]]),
                    reading && h("span", { class: "reading-badge" }, [texts[app.lang].readingBadge]),
                ]),
                h("p", { class: "caption", lang: app.lang }, [texts[app.lang].caption(id, app.model.directed)]),
                ...view,
            ]);
        });
        root.replaceChildren(...sections);
        views.attached.forEach(attached => attached());

        const details = root.querySelector<HTMLDetailsElement>("details.flat");
        if (details) {
            details.open = flatArrayOpen;
            details.addEventListener("toggle", () => flatArrayOpen = details.open);
        }
    };

    app.on(change => {
        if (change === "graph") {
            version++;
        }
        if (change !== "positions") {
            render();
        }
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
    render();
}

// ---- adjacency matrix

function matrixView(views: Views): Node[] {
    const { app } = views;
    const matrix = app.model.matrix;
    if (!matrix) {
        return [tooBigNote(app, "matrix")];
    }
    const points = matrix.getPoints();
    const size = points.length;
    if (size === 0) {
        return [emptyNote(app)];
    }
    if (size > TABLE.points) {
        return matrixPicture(views, matrix, points);
    }
    const focus = app.step?.focus;
    const isRead = (row: string, column: string) => focus?.edge?.from === row && focus.edge.to === column;

    const table = h("table", { class: "grid" }, [
        h("thead", {}, [h("tr", {}, [
            h("td", { class: "corner" }),
            ...points.map(name => h("th", { scope: "col", class: classes({ selected: app.isSelectedPoint(name) }) }, [pointButton(app, name)])),
        ])]),
        h("tbody", {}, points.map((row, r) => h("tr", {}, [
            h("th", { scope: "row", class: classes({ selected: app.isSelectedPoint(row) }) }, [pointButton(app, row)]),
            ...points.map((column, c) => {
                const value = matrix.graph[r * size + c];
                return h("td", {
                    class: classes({
                        zero: value === 0,
                        "row-read": focus?.point === row,
                        "cell-read": isRead(row, column),
                        selected: value !== 0 && app.isSelectedEdge(row, column),
                    }),
                }, [value === 0 ? "0" : edgeButton(app, row, column, formatNumber(value))]);
            }),
        ]))),
    ]);

    // the same matrix as the class stores it: one flat array, row after row
    const flat = h("details", { class: "flat" }, [
        h("summary", {}, [texts[app.lang].flatArray(size * size)]),
        h("p", { class: "flat-array" }, [
            "[",
            ...Array.from(matrix.graph).flatMap((value, cell) => {
                const row = points[Math.floor(cell / size)];
                const column = points[cell % size];
                const number = h("span", {
                    class: classes({
                        zero: value === 0,
                        "row-read": focus?.point === row,
                        "cell-read": isRead(row, column),
                    }),
                }, [formatNumber(value)]);
                if (cell === size * size - 1) {
                    return [number];
                }
                // a wider gap after the last number of each row
                const rowEnd = cell % size === size - 1;
                return [number, rowEnd ? h("span", { class: "row-gap" }, [","]) : ", "];
            }),
            "]",
        ]),
    ]);

    return [
        h("div", { class: "scroll" }, [table]),
        h("p", { class: "cost" }, [texts[app.lang].matrixCost(size)]),
        flat,
    ];
}

function matrixPicture(views: Views, matrix: AdjacencyMatrix, points: string[]): Node[] {
    const { app } = views;
    const size = points.length;
    const index = new Map(points.map((name, i) => [name, i]));
    const at = (name: string | undefined) => name === undefined ? undefined : index.get(name);
    const focus = app.step?.focus;
    const selection = app.selection;
    const directed = app.model.directed;

    const edgeCells = (from: string, to: string): [number, number][] => {
        const [r, c] = [at(from)!, at(to)!];
        return directed ? [[r, c]] : [[r, c], [c, r]];
    };
    const marks: GridMarks = {
        readRow: at(focus?.point),
        readCells: focus?.edge ? [[at(focus.edge.from)!, at(focus.edge.to)!]] : [],
        selectedRows: selection?.kind === "point" ? [at(selection.name)!] : [],
        selectedColumns: selection?.kind === "point" ? [at(selection.name)!] : [],
        selectedCells: selection?.kind === "edge" ? edgeCells(selection.from, selection.to) : [],
    };
    const picture = views.matrixPicture.element(String(views.version), {
        rows: size,
        columns: size,
        forEachNonZero: visit => {
            const cells = matrix.graph;
            for (let cell = 0; cell < cells.length; cell++) {
                if (cells[cell] !== 0) {
                    visit(Math.floor(cell / size), cell % size, cells[cell]);
                }
            }
        },
        value: (row, column) => matrix.graph[row * size + column],
        describe: (row, column) => texts[app.lang].matrixCell(points[row], points[column], formatNumber(matrix.graph[row * size + column])),
    }, marks, (row, column) => toggle(app, matrix.graph[row * size + column] !== 0
        ? { kind: "edge", from: points[row], to: points[column] }
        : { kind: "point", name: points[row] }));

    const cells = size * size;
    return [
        picture,
        h("p", { class: "cost" }, [texts[app.lang].matrixPicture(size, cells, cells * 8)]),
        h("p", { class: "cost" }, [texts[app.lang].matrixPictureStored(cells)]),
    ];
}

// ---- adjacency list

function listView(views: Views): Node[] {
    const { app } = views;
    const list = app.model.list;
    const points = list.getPoints();
    if (points.length === 0) {
        return [emptyNote(app)];
    }
    if (points.length > LIST_ROWS) {
        return listWindowView(views, points);
    }
    const focus = app.step?.focus;
    let entries = 0;

    const rows = points.map(name => {
        const neighbors = list.graph.get(name) ?? [];
        entries += neighbors.length;
        return h("div", { class: classes({ "list-row": true, "row-read": focus?.point === name }) }, [
            h("span", { class: classes({ "list-head": true, selected: app.isSelectedPoint(name) }) }, [pointButton(app, name)]),
            ...neighbors.flatMap(entry => [
                h("span", { class: "list-arrow", "aria-hidden": "true" }, ["→"]),
                h("span", {
                    class: classes({
                        "list-node": true,
                        "cell-read": focus?.edge?.from === name && focus.edge.to === entry.name,
                        selected: app.isSelectedEdge(name, entry.name),
                    }),
                }, [edgeButton(app, name, entry.name, [
                    h("span", { class: "list-name" }, [entry.name]),
                    h("span", { class: "list-weight", title: "weight" }, [formatNumber(entry.weight)]),
                ])]),
            ]),
            neighbors.length === 0 && h("span", { class: "list-empty" }, [texts[app.lang].noNeighbors]),
        ]);
    });

    return [
        h("div", { class: "adjacency-list" }, rows),
        h("p", { class: "cost" }, [texts[app.lang].listCost(points.length, entries)]),
    ];
}

function listWindowView(views: Views, points: string[]): Node[] {
    const { app } = views;
    const list = app.model.list;
    const focus = app.step?.focus;
    const { element, attached } = views.listWindow.element(points, focus?.point, name => {
        const neighbors = list.graph.get(name) ?? [];
        const shown = neighbors.slice(0, LIST_ENTRIES);
        return h("div", { class: classes({ "list-row": true, "window-row": true, "row-read": focus?.point === name }) }, [
            h("span", { class: classes({ "list-head": true, selected: app.isSelectedPoint(name) }) }, [pointButton(app, name)]),
            ...shown.flatMap(entry => [
                h("span", { class: "list-arrow", "aria-hidden": "true" }, ["→"]),
                h("span", {
                    class: classes({
                        "list-node": true,
                        "cell-read": focus?.edge?.from === name && focus.edge.to === entry.name,
                        selected: app.isSelectedEdge(name, entry.name),
                    }),
                }, [edgeButton(app, name, entry.name, [
                    h("span", { class: "list-name" }, [entry.name]),
                    h("span", { class: "list-weight", title: "weight" }, [formatNumber(entry.weight)]),
                ])]),
            ]),
            neighbors.length > shown.length && h("span", { class: "list-more" }, [`+${count(neighbors.length - shown.length, app.lang)}`]),
            neighbors.length === 0 && h("span", { class: "list-empty" }, [texts[app.lang].noNeighbors]),
        ]);
    });
    views.attached.push(attached);

    const entries = app.model.edgeCount() * (app.model.directed ? 1 : 2);
    return [
        element,
        h("p", { class: "cost" }, [
            `${texts[app.lang].listCost(points.length, entries)} `,
            texts[app.lang].listWindow,
        ]),
    ];
}

// ---- incidence matrix

function incidenceView(views: Views): Node[] {
    const { app } = views;
    const incidence = app.model.incidence;
    if (!incidence) {
        return [tooBigNote(app, "incidence")];
    }
    const points = incidence.getPoints();
    if (points.length === 0) {
        return [emptyNote(app)];
    }
    if (incidence.edges.length > 0 && (points.length > TABLE.points || incidence.edges.length > TABLE.edges)) {
        return incidencePicture(views, incidence, points);
    }
    const directed = app.model.directed;
    const focus = app.step?.focus;
    const readColumn = focus?.edge ? incidence.findColumn(focus.edge.from, focus.edge.to) : -1;

    const table = h("table", { class: "grid" }, [
        h("thead", {}, [h("tr", {}, [
            h("td", { class: "corner" }),
            ...incidence.edges.map(({ from, to }, column) => h("th", {
                scope: "col",
                class: classes({ "edge-head": true, "col-read": column === readColumn, selected: app.isSelectedEdge(from, to) }),
            }, [edgeButton(app, from, to, edgeLabel(from, to, directed))])),
        ])]),
        h("tbody", {}, points.map((row, r) => h("tr", {}, [
            h("th", { scope: "row", class: classes({ selected: app.isSelectedPoint(row) }) }, [pointButton(app, row)]),
            ...incidence.graph[r].map((value, column) => h("td", {
                class: classes({
                    zero: value === 0,
                    "row-read": focus?.point === row,
                    "col-read": column === readColumn,
                    "cell-read": column === readColumn && value !== 0,
                }),
            }, [formatNumber(value)])),
        ]))),
    ]);

    const edges = incidence.edges.length;
    return [
        h("div", { class: "scroll" }, [table]),
        h("p", { class: "cost" }, [
            edges === 0
                ? texts[app.lang].incidenceNoEdges
                : texts[app.lang].incidenceCost(points.length, edges),
        ]),
    ];
}

function incidencePicture(views: Views, incidence: IncidenceMatrix, points: string[]): Node[] {
    const { app } = views;
    const directed = app.model.directed;
    const edges = incidence.edges;
    const index = new Map(points.map((name, i) => [name, i]));
    const focus = app.step?.focus;
    const selection = app.selection;
    const readColumn = focus?.edge ? incidence.findColumn(focus.edge.from, focus.edge.to) : -1;
    const selectedColumn = selection?.kind === "edge" ? incidence.findColumn(selection.from, selection.to) : -1;
    const ends = (column: number): [number, number][] =>
        [[index.get(edges[column].from)!, column], [index.get(edges[column].to)!, column]];

    const marks: GridMarks = {
        readRow: focus?.point === undefined ? undefined : index.get(focus.point),
        readColumn: readColumn >= 0 ? readColumn : undefined,
        readCells: readColumn >= 0 ? ends(readColumn) : [],
        selectedRows: selection?.kind === "point" ? [index.get(selection.name)!] : [],
        selectedColumns: selectedColumn >= 0 ? [selectedColumn] : [],
    };
    const picture = views.incidencePicture.element(String(views.version), {
        rows: points.length,
        columns: edges.length,
        forEachNonZero: visit => incidence.graph.forEach((row, r) => row.forEach((value, c) => {
            if (value !== 0) {
                visit(r, c, value);
            }
        })),
        value: (row, column) => incidence.graph[row][column],
        describe: (row, column) =>
            texts[app.lang].incidenceCell(points[row], edgeLabel(edges[column].from, edges[column].to, directed), formatNumber(incidence.graph[row][column])),
    }, marks, (row, column) => toggle(app, incidence.graph[row][column] !== 0
        ? { kind: "edge", from: edges[column].from, to: edges[column].to }
        : { kind: "point", name: points[row] }));

    const cells = points.length * edges.length;
    return [
        picture,
        h("p", { class: "cost" }, [texts[app.lang].incidencePicture(points.length, edges.length, cells, cells * 12, edges.length > 2000, directed)]),
    ];
}

// ---- shared pieces

function pointButton(app: App, name: string): HTMLButtonElement {
    const button = h("button", { type: "button", class: "bare math", title: `Select point ${name}` }, [name]);
    button.addEventListener("click", () => toggle(app, { kind: "point", name }));
    return button;
}

function edgeButton(app: App, from: string, to: string, content: string | Node[]): HTMLButtonElement {
    const label = edgeLabel(from, to, app.model.directed);
    const button = h("button", { type: "button", class: "bare", title: `Select edge ${label}` }, typeof content === "string" ? [content] : content);
    button.addEventListener("click", () => toggle(app, { kind: "edge", from, to }));
    return button;
}

function toggle(app: App, selection: Exclude<Selection, null>): void {
    const already = selection.kind === "point"
        ? app.isSelectedPoint(selection.name)
        : app.isSelectedEdge(selection.from, selection.to);
    app.select(already ? null : selection);
}

// why a matrix is not built for this graph: what it would cost, and the size the page builds it for
function tooBigNote(app: App, id: MatrixId): HTMLElement {
    const { model } = app;
    const t = texts[app.lang];
    const { cells, bytes } = model.size(id);
    const { matrix, incidence } = model.limits;
    return h("p", { class: "too-big", lang: app.lang }, [
        h("strong", {}, [t.tooBig]),
        t.tooBigCost(id, model.pointCount(), model.edgeCount(), cells, bytes),
        id === "matrix" ? t.tooBigLimit(id, matrix.points, 0) : t.tooBigLimit(id, incidence.points, incidence.cells),
    ]);
}

function emptyNote(app: App): HTMLElement {
    return h("p", { class: "empty-note" }, [texts[app.lang].noPoints]);
}

// a real minus sign reads better than a hyphen
const formatNumber = (value: number) => value < 0 ? `−${-value}` : String(value);
