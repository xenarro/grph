// Which structure for what: the cost of everyday operations in each structure, worked out for the
// graph on the page, and each structure's own "How it works" with a piece of code.

import { App } from "./app";
import { classes, h } from "./dom";
import { bullets, paragraph, section, typescript } from "./explainer";
import { count, formatBytes } from "./format";
import { BYTES_PER_CELL, BYTES_PER_LIST_ITEM, RepresentationId, representationNames } from "./model";
import { structureExplainers } from "./structure-explainers";

const ORDER: RepresentationId[] = ["matrix", "list", "incidence"];

export function comparisonView(app: App): HTMLElement {
    const points = app.model.pointCount();
    const edges = app.model.edgeCount();
    const directed = app.model.directed;
    // a list holds every edge once in a directed graph, twice in an undirected one
    const entries = directed ? edges : 2 * edges;
    const perPoint = points === 0 ? 0 : entries / points;
    const twoE = directed ? "E" : "2E";

    // memory in bytes, as measured in Chrome's JavaScript engine (see model.ts)
    const bytes = {
        matrix: points * points * BYTES_PER_CELL.matrix,
        list: (points + entries) * BYTES_PER_LIST_ITEM,
        incidence: points * edges * BYTES_PER_CELL.incidence,
    };
    // for each operation, the work in the matrix, the list and the incidence matrix: [how, how much]
    const rows: [string, [string, number][]][] = [
        ["Memory", [
            [`V² cells × ${BYTES_PER_CELL.matrix} B`, bytes.matrix],
            [`(V + ${twoE}) × ≈ ${BYTES_PER_LIST_ITEM} B`, bytes.list],
            [`V × E cells × ${BYTES_PER_CELL.incidence} B`, bytes.incidence],
        ]],
        ["Is X–Y an edge?", [["1 cell", 1], ["X's list, ≈ " + count(perPoint), perPoint], ["up to E columns", edges]]],
        ["All neighbors of X", [["X's row: V cells", points], ["X's list, ≈ " + count(perPoint), perPoint], ["E cells + V per neighbor", edges + perPoint * points]]],
        ["Add a point", [["copy (V + 1)² cells", (points + 1) ** 2], ["1 empty list", 1], ["a row of E zeros", edges]]],
        ["Add an edge", [[directed ? "1 cell" : "2 cells", directed ? 1 : 2], [directed ? "1 entry" : "2 entries", directed ? 1 : 2], ["a column of V cells", points]]],
        ["Search all of it (DFS, BFS)", [["V² cells", points * points], [`V + ${twoE} entries`, points + entries], ["≈ V × E cells", points * edges]]],
    ];

    const possible = directed ? points * (points - 1) : points * (points - 1) / 2;
    const share = possible === 0 ? 0 : edges / possible;
    const zeros = points === 0 ? 0 : 1 - entries / (points * points);
    // a share near 0 or 100% keeps two significant digits of its distance from them: 0.031%, 99.96%
    const percent = (x: number) => {
        const p = x * 100;
        if (p > 0 && p < 1) {
            return `${Number(p.toPrecision(2))}%`;
        }
        if (p > 99 && p < 100) {
            return `${Number((100 - Number((100 - p).toPrecision(2))).toFixed(6))}%`;
        }
        return `${count(Math.round(p * 10) / 10)}%`;
    };
    const verdict = points < 2
        ? "Add a few points and edges to compare the structures on your graph."
        : `This graph has ${count(edges)} of the ${count(possible)} possible edges (${percent(share)}), so its adjacency matrix is ${percent(zeros)} zeros. ` +
          (bytes.list < bytes.matrix
              ? `The list stores only what is there, so it is the smaller one (${formatBytes(bytes.list)} against ${formatBytes(bytes.matrix)}), and it walks the graph fastest.`
              : `Even so the matrix is the smaller one (${formatBytes(bytes.matrix)} against ${formatBytes(bytes.list)}): a list entry carries a name and a link, about ${Math.round(BYTES_PER_LIST_ITEM / BYTES_PER_CELL.matrix)} times a matrix cell. The list still walks the graph fastest.`);

    return h("section", { class: "structure comparison", "aria-labelledby": "comparison-title" }, [
        h("header", { class: "structure-head" }, [h("h2", { id: "comparison-title" }, ["Which structure for what"])]),
        h("p", { class: "caption" }, [
            `The work each one does, for this graph of V = ${count(points)} points and E = ${count(edges)} edges. The least in each row is in bold.`,
        ]),
        h("div", { class: "scroll" }, [h("table", { class: "comparison-table" }, [
            h("thead", {}, [h("tr", {}, [h("td"), ...ORDER.map(id => h("th", { scope: "col" }, [representationNames[id]]))])]),
            h("tbody", {}, rows.map(([what, costs]) => {
                const least = Math.min(...costs.map(([, n]) => n));
                return h("tr", {}, [
                    h("th", { scope: "row" }, [what]),
                    ...costs.map(([how, n]) => h("td", { class: classes({ least: n === least }) }, [
                        h("span", { class: "amount" }, [what === "Memory" ? formatBytes(n) : count(n)]),
                        h("span", { class: "how" }, [how]),
                    ])),
                ]);
            })),
        ])]),
        h("p", { class: "cost" }, [verdict]),
    ]);
}

// "How it works" for one structure, closed until opened; `toggled` remembers the choice between renders
export function structureExplainerView(id: RepresentationId, open: boolean, toggled: (open: boolean) => void): HTMLElement {
    const explainer = structureExplainers[id];
    const details = h("details", { class: "explainer structure-explainer", open }, [
        h("summary", {}, ["How it works"]),
        ...explainer.idea.map(paragraph),
        section("In TypeScript", [typescript(explainer.typescript)]),
        h("div", { class: "explainer-columns" }, [
            section("Good for", [bullets(explainer.goodFor)]),
            section("Not good for", [bullets(explainer.badFor)]),
        ]),
    ]);
    details.addEventListener("toggle", () => toggled(details.open));
    return details;
}
