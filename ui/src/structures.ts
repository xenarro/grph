// The three representations of the graph, drawn from the data each class actually stores.
// While an algorithm runs, the part it reads in the current step is highlighted:
// a point's row or list softly, the single edge being checked strongly.
// Clicking a point name or an edge entry selects it in the drawing too.

import { edgeLabel } from "../../src/graph/validation";
import { App, Selection } from "./app";
import { classes, h } from "./dom";
import { RepresentationId, representationNames } from "./model";

export function mountStructures(root: HTMLElement, app: App): void {
    let flatArrayOpen = false;

    const render = () => {
        const sections = (["matrix", "list", "incidence"] as const).map(id => {
            const reading = app.step !== null && app.readFrom === id;
            const view = id === "matrix" ? matrixView(app) : id === "list" ? listView(app) : incidenceView(app);
            return h("section", { class: classes({ structure: true, reading }), "aria-labelledby": `structure-${id}` }, [
                h("header", { class: "structure-head" }, [
                    h("h2", { id: `structure-${id}` }, [representationNames[id]]),
                    reading && h("span", { class: "reading-badge" }, ["The algorithm reads this one"]),
                ]),
                h("p", { class: "caption" }, [caption(id, app.model.directed)]),
                ...view,
            ]);
        });
        root.replaceChildren(...sections);

        const details = root.querySelector<HTMLDetailsElement>("details.flat");
        if (details) {
            details.open = flatArrayOpen;
            details.addEventListener("toggle", () => flatArrayOpen = details.open);
        }
    };

    app.on(change => change !== "positions" && render());
    render();
}

function caption(id: RepresentationId, directed: boolean): string {
    switch (id) {
        case "matrix":
            return directed
                ? "A row and a column for every point. The cell in row X, column Y holds the weight of the edge X→Y, or 0 when there is none."
                : "A row and a column for every point. A cell holds the weight of the edge between its two points, or 0. Each edge is stored twice, so the matrix is symmetric.";
        case "list":
            return directed
                ? "Every point keeps a list of the points its edges lead to, with the edge weights."
                : "Every point keeps a list of its neighbors, with the edge weights. Each edge is stored twice, once in each point's list.";
        case "incidence":
            return directed
                ? "A row for every point, a column for every edge. An edge's column holds −weight in the row of the point it leaves and +weight in the row of the point it enters."
                : "A row for every point, a column for every edge. An edge's column holds its weight in the rows of the two points it connects.";
    }
}

// ---- adjacency matrix

function matrixView(app: App): Node[] {
    const matrix = app.model.matrix;
    const points = matrix.getPoints();
    const size = points.length;
    if (size === 0) {
        return [emptyNote()];
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
        h("summary", {}, [`Stored as one flat array of ${size * size} numbers`]),
        h("p", { class: "flat-array" }, [
            "[",
            ...matrix.graph.flatMap((value, cell) => {
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
        h("p", { class: "cost" }, [`${size} × ${size} = ${size * size} cells, whatever the number of edges.`]),
        flat,
    ];
}

// ---- adjacency list

function listView(app: App): Node[] {
    const list = app.model.list;
    const points = list.getPoints();
    if (points.length === 0) {
        return [emptyNote()];
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
            neighbors.length === 0 && h("span", { class: "list-empty" }, ["no neighbors"]),
        ]);
    });

    return [
        h("div", { class: "adjacency-list" }, rows),
        h("p", { class: "cost" }, [`${points.length} lists with ${entries} ${entries === 1 ? "entry" : "entries"} in total.`]),
    ];
}

// ---- incidence matrix

function incidenceView(app: App): Node[] {
    const incidence = app.model.incidence;
    const points = incidence.getPoints();
    if (points.length === 0) {
        return [emptyNote()];
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
                ? "No edges yet, so no columns."
                : `${points.length} × ${edges} = ${points.length * edges} cells. Finding a point's neighbors means reading its row, then scanning each edge's column for the other end.`,
        ]),
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

function emptyNote(): HTMLElement {
    return h("p", { class: "empty-note" }, ["No points yet."]);
}

// a real minus sign reads better than a hyphen
const formatNumber = (value: number) => value < 0 ? `−${-value}` : String(value);
