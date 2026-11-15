// Writes a graph out in one of the four formats, as plain text, JSON or TypeScript. The structures are
// built with this library's own classes and convert(), so the output is what each class really stores.
// Every format comes back in through parseGraph() as the same graph.

import AdjacencyList from "../graph/adjacency-list";
import AdjacencyMatrix from "../graph/adjacency-matrix";
import IncidenceMatrix from "../graph/incidence-matrix";
import { convert } from "../graph/convert";
import { GraphFormat, ParsedGraph } from "./parse";
import { FormatError, problem } from "./problems";

export type OutputStyle = "text" | "json" | "typescript";

// a matrix with more cells than this is too long to write out; the list and the edge list have no such limit
export const FORMAT_LIMITS = { matrixCells: 1_000_000 };

export function formatGraph(graph: ParsedGraph, to: GraphFormat, style: OutputStyle): string {
    const list = new AdjacencyList(graph.directed);
    list.addPoints(graph.points);
    graph.edges.forEach(({ from, to: end, weight }) => list.addEdge(from, end, weight));

    switch (to) {
        case "list": return formatList(list, style);
        case "edges": return formatEdges(list, style);
        case "matrix": {
            checkMatrixSize(graph.points.length ** 2);
            return formatMatrix(convert(list, new AdjacencyMatrix(graph.directed)), style);
        }
        case "incidence": {
            checkMatrixSize(graph.points.length * graph.edges.length);
            return formatIncidence(convert(list, new IncidenceMatrix(graph.directed)), style);
        }
    }
}

function checkMatrixSize(cells: number): void {
    if (cells > FORMAT_LIMITS.matrixCells) {
        throw new FormatError([problem("matrix-too-big", { cells, max: FORMAT_LIMITS.matrixCells })]);
    }
}

const quote = (text: string) => JSON.stringify(text);
const number = (value: number) => String(value);

// ---- adjacency list

function formatList(list: AdjacencyList, style: OutputStyle): string {
    const points = list.getPoints();
    const weighted = list.getEdges().some(edge => edge.weight !== 1);
    if (style === "text") {
        return points.map(name => {
            const entries = list.getNeighbors(name).map(n => weighted ? `${n.name}(${number(n.weight)})` : n.name);
            return entries.length ? `${name}: ${entries.join(", ")}` : `${name}:`;
        }).join("\n") + "\n";
    }
    const body = points.map(name => {
        const entries = list.getNeighbors(name).map(n => `${quote(n.name)}: ${number(n.weight)}`);
        return `    ${quote(name)}: {${entries.length ? ` ${entries.join(", ")} ` : ""}}`;
    }).join(",\n");
    const object = points.length ? `{\n${body},\n}` : "{}";
    return style === "json"
        ? `${object.replace(/,\n}$/, "\n}")}\n`
        : `// each point, then its neighbors with the weights of the edges to them\nconst adjacencyList: Record<string, Record<string, number>> = ${object};\n`;
}

// ---- edge list

function formatEdges(list: AdjacencyList, style: OutputStyle): string {
    const edges = list.getEdges();
    const points = list.getPoints();
    const weighted = edges.some(edge => edge.weight !== 1);
    const linked = new Set(edges.flatMap(edge => [edge.from, edge.to]));
    const alone = points.filter(name => !linked.has(name));
    if (style === "text") {
        const lines = edges.map(e => weighted ? `${e.from} ${e.to} ${number(e.weight)}` : `${e.from} ${e.to}`);
        return [...lines, ...alone].join("\n") + "\n";
    }
    const edgeLines = edges.map(e => `        [${quote(e.from)}, ${quote(e.to)}, ${number(e.weight)}]`).join(",\n");
    const pointList = points.map(quote).join(", ");
    if (style === "json") {
        return `{\n    "directed": ${list.directed},\n    "points": [${pointList}],\n    "edges": [${edges.length ? `\n${edgeLines}\n    ` : ""}]\n}\n`;
    }
    return `const directed = ${list.directed};\nconst points: string[] = [${pointList}];\n` +
        `// from, to, weight\nconst edges: [string, string, number][] = [${edges.length ? `\n${edgeLines.replace(/^ {4}/gm, "")}\n` : ""}];\n`;
}

// ---- adjacency matrix

function formatMatrix(matrix: AdjacencyMatrix, style: OutputStyle): string {
    const points = matrix.getPoints();
    const size = points.length;
    const rows = points.map((_, r) => Array.from(matrix.graph.subarray(r * size, (r + 1) * size), number));
    if (style === "text") {
        return table([["", ...points], ...rows.map((row, r) => [points[r], ...row])]);
    }
    const width = Math.max(1, ...rows.flat().map(cell => cell.length));
    const body = rows.map((row, r) => `        [${row.map(cell => cell.padStart(width)).join(", ")}]${r < size - 1 ? "," : ""}` +
        (style === "typescript" ? ` // ${points[r]}` : "")).join("\n");
    if (style === "json") {
        return `{\n    "points": [${points.map(quote).join(", ")}],\n    "matrix": [${size ? `\n${body}\n    ` : ""}]\n}\n`;
    }
    return `// row and column i are points[i]; a cell holds the weight of the edge from its row to its column, or 0\n` +
        `const points: string[] = [${points.map(quote).join(", ")}];\n` +
        `const adjacencyMatrix: number[][] = [${size ? `\n${body.replace(/^ {4}/gm, "")}\n` : ""}];\n`;
}

// ---- incidence matrix

function formatIncidence(incidence: IncidenceMatrix, style: OutputStyle): string {
    const points = incidence.getPoints();
    const arrow = incidence.directed ? "→" : "–";
    const labels = incidence.edges.map(({ from, to }) => `${from}${arrow}${to}`);
    const rows = incidence.graph.map(row => row.map(number));
    if (style === "text") {
        return table([["", ...labels], ...rows.map((row, r) => [points[r], ...row])]);
    }
    const width = Math.max(1, ...rows.flat().map(cell => cell.length));
    const body = rows.map((row, r) => `        [${row.map(cell => cell.padStart(width)).join(", ")}]${r < rows.length - 1 ? "," : ""}` +
        (style === "typescript" ? ` // ${points[r]}` : "")).join("\n");
    if (style === "json") {
        return `{\n    "directed": ${incidence.directed},\n    "points": [${points.map(quote).join(", ")}],\n` +
            `    "incidence": [${rows.length ? `\n${body}\n    ` : ""}]\n}\n`;
    }
    return `// a row for every point, a column for every edge: ${labels.join(", ") || "none"}\n` +
        `const points: string[] = [${points.map(quote).join(", ")}];\n` +
        `const incidenceMatrix: number[][] = [${rows.length ? `\n${body.replace(/^ {4}/gm, "")}\n` : ""}];\n`;
}

// columns padded to their widest cell
function table(rows: string[][]): string {
    const widths = rows[0].map((_, c) => Math.max(...rows.map(row => row[c].length)));
    return rows.map(row => row.map((cell, c) => cell.padStart(widths[c])).join("  ").trimEnd()).join("\n") + "\n";
}
