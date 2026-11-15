// Which structure for what: the cost of everyday operations in each structure, worked out for the
// graph on the page, and each structure's own "How it works" with a piece of code.

import { App } from "./app";
import { classes, h } from "./dom";
import { bullets, paragraph, section, typescript } from "./explainer";
import { count, formatBytes, Lang, texts } from "./i18n";
import { BYTES_PER_CELL, BYTES_PER_LIST_ITEM, RepresentationId } from "./model";
import { structureCode, structureExplainers } from "./structure-explainers";

const ORDER: RepresentationId[] = ["matrix", "list", "incidence"];

export function comparisonView(app: App): HTMLElement {
    const { lang } = app;
    const t = texts[lang];
    const n = (value: number) => count(value, lang);
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
    const { how } = t;
    // for each operation, the work in the matrix, the list and the incidence matrix: [how, how much]
    const rows: [string, [string, number][], boolean][] = [
        [t.rows.memory, [
            [how.matrixMemory(BYTES_PER_CELL.matrix), bytes.matrix],
            [how.listMemory(twoE, BYTES_PER_LIST_ITEM), bytes.list],
            [how.incidenceMemory(BYTES_PER_CELL.incidence), bytes.incidence],
        ], true],
        [t.rows.isEdge, [[how.oneCell, 1], [how.xList(perPoint), perPoint], [how.upToEColumns, edges]], false],
        [t.rows.neighbors, [[how.xRow, points], [how.xList(perPoint), perPoint], [how.incidenceNeighbors, edges + perPoint * points]], false],
        [t.rows.addPoint, [[how.copyMatrix, (points + 1) ** 2], [how.emptyList, 1], [how.zerosRow, edges]], false],
        [t.rows.addEdge, [[how.cells(directed ? 1 : 2), directed ? 1 : 2], [how.entries(directed ? 1 : 2), directed ? 1 : 2], [how.cellsColumn, points]], false],
        [t.rows.searchAll, [[how.matrixSearch, points * points], [how.listSearch(twoE), points + entries], [how.incidenceSearch, points * edges]], false],
    ];

    const possible = directed ? points * (points - 1) : points * (points - 1) / 2;
    const share = possible === 0 ? 0 : edges / possible;
    const zeros = points === 0 ? 0 : 1 - entries / (points * points);
    // a share near 0 or 100% keeps two significant digits of its distance from them: 0.031%, 99.96%
    const percent = (x: number) => {
        const p = x * 100;
        if (p > 0 && p < 1) {
            return `${n(Number(p.toPrecision(2)))}%`;
        }
        if (p > 99 && p < 100) {
            return `${(100 - Number((100 - p).toPrecision(2))).toLocaleString(lang === "uk" ? "uk-UA" : "en-US", { maximumFractionDigits: 6 })}%`;
        }
        return `${n(Math.round(p * 10) / 10)}%`;
    };
    const verdict = points < 2
        ? t.addMorePoints
        : t.density(edges, possible, percent(share), percent(zeros)) +
          (bytes.list < bytes.matrix
              ? t.listSmaller(formatBytes(bytes.list, lang), formatBytes(bytes.matrix, lang))
              : t.matrixSmaller(formatBytes(bytes.matrix, lang), formatBytes(bytes.list, lang), Math.round(BYTES_PER_LIST_ITEM / BYTES_PER_CELL.matrix)));

    return h("section", { class: "structure comparison", lang, "aria-labelledby": "comparison-title" }, [
        h("header", { class: "structure-head" }, [h("h2", { id: "comparison-title" }, [t.comparisonTitle])]),
        h("p", { class: "caption" }, [t.comparisonCaption(points, edges)]),
        h("div", { class: "scroll" }, [h("table", { class: "comparison-table" }, [
            h("thead", {}, [h("tr", {}, [h("td"), ...ORDER.map(id => h("th", { scope: "col" }, [t.structureNames[id]]))])]),
            h("tbody", {}, rows.map(([what, costs, inBytes]) => {
                const least = Math.min(...costs.map(([, amount]) => amount));
                return h("tr", {}, [
                    h("th", { scope: "row" }, [what]),
                    ...costs.map(([text, amount]) => h("td", { class: classes({ least: amount === least }) }, [
                        h("span", { class: "amount" }, [inBytes ? formatBytes(amount, lang) : n(amount)]),
                        h("span", { class: "how" }, [text]),
                    ])),
                ]);
            })),
        ])]),
        h("p", { class: "cost" }, [verdict]),
    ]);
}

// "How it works" for one structure, closed until opened; `toggled` remembers the choice between renders
export function structureExplainerView(id: RepresentationId, lang: Lang, open: boolean, toggled: (open: boolean) => void): HTMLElement {
    const explainer = structureExplainers[lang][id];
    const t = texts[lang];
    const details = h("details", { class: "explainer structure-explainer", open, lang }, [
        h("summary", {}, [t.howItWorks]),
        ...explainer.idea.map(paragraph),
        section(t.inTypeScript, [typescript(structureCode[id])]),
        h("div", { class: "explainer-columns" }, [
            section(t.goodFor, [bullets(explainer.goodFor)]),
            section(t.notGoodFor, [bullets(explainer.badFor)]),
        ]),
    ]);
    details.addEventListener("toggle", () => toggled(details.open));
    return details;
}
