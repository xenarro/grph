// Reads a graph someone pastes in: an edge list, an adjacency list, an adjacency matrix or an incidence
// matrix, as text or as JSON. Everything is checked before it is used, because it comes from outside:
// - the text has a size limit, and so do the points and edges it may describe;
// - a point name is 1 to 32 letters (of any alphabet), digits, "_", "." or "-", and never one of the
//   names objects inherit from, so no name can carry markup or reach an object's prototype;
// - a weight is a plain decimal number above 0, a matrix cell a plain decimal number;
// - a matrix has rows of the same length, an undirected adjacency matrix is symmetric, and every
//   column of an incidence matrix joins exactly two points.
// Problems are reported with their line, a few at a time, in a FormatError (see problems.ts).

import Edge from "../graph/interfaces/edge";
import { FormatError, Problem, problem, ProblemCode, ProblemValues } from "./problems";

export { FormatError } from "./problems";

export type GraphFormat = "edges" | "list" | "matrix" | "incidence";

export interface ParsedGraph {
    readonly directed: boolean;
    readonly points: string[];
    readonly edges: Edge[];
    // the format the input was read as
    readonly format: GraphFormat;
}

export interface ParseOptions {
    // "auto" works the format out from the input
    readonly format?: GraphFormat | "auto";
    // ignored when JSON input says it itself
    readonly directed?: boolean;
}

// as many points as the visualizer takes, and about as many edges as fit in the text
export const PARSE_LIMITS = { characters: 4_000_000, points: 100_000, edges: 300_000, matrixRows: 2_000, weight: 1e12 };
const MAX_PROBLEMS = 8;

const NAME = /^[\p{L}\p{N}_.-]{1,32}$/u;
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const WEIGHT = /^\+?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const CELL = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const isNumber = (token: string) => CELL.test(token);

export function parseGraph(input: unknown, options: ParseOptions = {}): ParsedGraph {
    if (typeof input !== "string") {
        throw new FormatError([problem("not-text")]);
    }
    if (input.length > PARSE_LIMITS.characters) {
        throw new FormatError([problem("too-long", { max: PARSE_LIMITS.characters })]);
    }
    const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    if (text.trim() === "") {
        throw new FormatError([problem("empty")]);
    }
    const format = options.format ?? "auto";
    const first = text.trimStart()[0];
    if (first === "{" || (first === "[" && looksLikeJson(text))) {
        return fromJson(text, format, options.directed ?? false);
    }
    return fromText(text, format, options.directed ?? false);
}

// "[0, 1]" on several lines can be JSON or a matrix typed with brackets; JSON when it parses
function looksLikeJson(text: string): boolean {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

// ---- collecting points and edges, with every check

class Builder {
    private readonly points = new Set<string>();
    private readonly edges = new Map<string, Edge>();
    readonly problems: Problem[] = [];

    constructor(readonly directed: boolean) {}

    fail(line: number | null, code: ProblemCode, values: ProblemValues = {}): void {
        if (this.problems.length < MAX_PROBLEMS) {
            this.problems.push(problem(code, values, line));
        }
    }

    // stops at the problems found so far
    check(): void {
        if (this.problems.length > 0) {
            throw new FormatError(this.problems);
        }
    }

    // a checked name, or null after a problem is reported
    name(raw: unknown, line: number | null): string | null {
        if (typeof raw !== "string" && typeof raw !== "number") {
            this.fail(line, "bad-name", { name: shorten(String(raw)) });
            return null;
        }
        const name = String(raw).trim();
        if (!NAME.test(name)) {
            this.fail(line, "bad-name", { name: shorten(name) });
            return null;
        }
        if (RESERVED.has(name)) {
            this.fail(line, "reserved-name", { name });
            return null;
        }
        return name;
    }

    weight(raw: unknown, line: number | null): number | null {
        const value = typeof raw === "number" ? raw : typeof raw === "string" && WEIGHT.test(raw.trim()) ? Number(raw) : NaN;
        if (!Number.isFinite(value) || value <= 0 || value > PARSE_LIMITS.weight) {
            this.fail(line, "bad-weight", { value: shorten(String(raw)), max: PARSE_LIMITS.weight });
            return null;
        }
        return value;
    }

    point(name: string): void {
        this.points.add(name);
    }

    edge(from: string, to: string, weight: number, line: number | null): void {
        if (from === to) {
            this.fail(line, "self-loop", { name: from });
            return;
        }
        this.point(from);
        this.point(to);
        const key = this.directed || from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
        const earlier = this.edges.get(key);
        if (earlier && earlier.weight !== weight) {
            this.fail(line, "weight-twice", { edge: `${from}${this.directed ? "→" : "–"}${to}`, first: earlier.weight, second: weight });
            return;
        }
        if (!earlier) {
            this.edges.set(key, { from, to, weight });
        }
    }

    result(format: GraphFormat): ParsedGraph {
        if (this.points.size > PARSE_LIMITS.points) {
            this.fail(null, "too-many-points", { count: this.points.size, max: PARSE_LIMITS.points });
        }
        if (this.edges.size > PARSE_LIMITS.edges) {
            this.fail(null, "too-many-edges", { count: this.edges.size, max: PARSE_LIMITS.edges });
        }
        this.check();
        return { directed: this.directed, points: [...this.points], edges: [...this.edges.values()], format };
    }
}

// ---- text

interface Line {
    readonly number: number;
    readonly text: string;
}

function fromText(text: string, format: GraphFormat | "auto", directed: boolean): ParsedGraph {
    const lines: Line[] = text.split("\n")
        .map((line, i) => ({ number: i + 1, text: line.replace(/(#|\/\/).*$/, "").trim() }))
        .filter(line => line.text !== "");
    if (lines.length > PARSE_LIMITS.points + PARSE_LIMITS.edges) {
        throw new FormatError([problem("too-many-lines", { count: lines.length, max: PARSE_LIMITS.points + PARSE_LIMITS.edges })]);
    }
    const kind = format !== "auto" ? format : guessText(lines);
    switch (kind) {
        case "edges": return edgesFromText(lines, directed);
        case "list": return listFromText(lines, directed);
        case "matrix":
        case "incidence": return matrixFromText(lines, kind, directed);
    }
}

const ARROWS = /->|→|—|–/g;
const LIST_HEAD = /^([^\s:]+?)\s*(?::|->|→)\s*(.*)$/;

function matrixTokens(text: string): string[] {
    return text.replace(/[[\]|]/g, " ").split(/[\s,;]+/).filter(token => token !== "");
}

// Which format the text is in. A list has "point:" lines. Rows of numbers are a matrix only when that
// is the only sensible reading: square with zeros on the diagonal for an adjacency matrix, every column
// an edge's column for an incidence matrix. Anything else is an edge list, so "0 1 / 1 2 / 2 0" is three
// edges between points named by numbers. The format can always be chosen.
function guessText(lines: readonly Line[]): GraphFormat {
    if (lines.some(line => /^[^\s:]+\s*:/.test(line.text))) {
        return "list";
    }
    const { rows: named } = matrixRows(lines);
    if (named.length < 2 || named.some(row => row.tokens.length < 2 || !row.tokens.every(isNumber))) {
        return "edges";
    }
    const rows = named.map(row => row.tokens.map(Number));
    const width = rows[0].length;
    if (rows.some(row => row.length !== width)) {
        return "edges";
    }
    if (width === rows.length && rows.every((row, i) => row[i] === 0)) {
        return "matrix";
    }
    // an edge's column: the same weight twice (undirected), or −weight and +weight (directed)
    const isEdgeColumn = (c: number) => {
        const values = rows.map(row => row[c]).filter(value => value !== 0);
        return values.length === 2 && (values[0] === values[1] ? values[0] > 0 : values[0] === -values[1]);
    };
    return Array.from({ length: width }, (_, c) => isEdgeColumn(c)).every(Boolean) ? "incidence" : "edges";
}

// "A B", "A B 4", "A -> B 4", "A, B, 4", or a lone "A" for a point without edges
function edgesFromText(lines: readonly Line[], directed: boolean): ParsedGraph {
    const graph = new Builder(directed);
    for (const { number, text } of lines) {
        const tokens = text.replace(ARROWS, " ").split(/[\s,;]+/).filter(token => token !== "");
        if (tokens.length > 3) {
            graph.fail(number, "edge-parts", { count: tokens.length });
            continue;
        }
        const from = graph.name(tokens[0], number);
        if (tokens.length === 1) {
            if (from !== null) {
                graph.point(from);
            }
            continue;
        }
        const to = graph.name(tokens[1], number);
        const weight = tokens.length === 3 ? graph.weight(tokens[2], number) : 1;
        if (from !== null && to !== null && weight !== null) {
            graph.edge(from, to, weight, number);
        }
    }
    return graph.result("edges");
}

// "A: B, C(4)", "A -> B 4, C", "A: B C D", "A: B:4 C=2", or "A:" for a point without neighbors
function listFromText(lines: readonly Line[], directed: boolean): ParsedGraph {
    const graph = new Builder(directed);
    const entry = /^([^\s():=,]+)\s*(?:\(\s*([^()]*?)\s*\)|[:=]\s*(\S+)|\s+(\S+))?$/;
    for (const { number, text } of lines) {
        const head = LIST_HEAD.exec(text);
        if (!head || !/:|->|→/.test(text)) {
            graph.fail(number, "list-line");
            continue;
        }
        const from = graph.name(head[1], number);
        if (from === null) {
            continue;
        }
        graph.point(from);
        const rest = head[2].trim();
        if (rest === "") {
            continue;
        }
        // entries are separated by commas or arrows; without them, by spaces, each "name" or "name(weight)"
        const separated = /,|;|->|→/.test(rest);
        const parts = separated
            ? rest.split(/,|;|->|→/).map(part => part.trim()).filter(part => part !== "")
            : rest.split(/\s+/);
        for (const part of parts) {
            const match = separated ? entry.exec(part) : /^([^\s():=,]+)(?:\(([^()]*)\)|[:=](\S+))?$/.exec(part);
            if (!match) {
                graph.fail(number, "list-entry", { entry: shorten(part) });
                continue;
            }
            const to = graph.name(match[1], number);
            const rawWeight = match[2] ?? match[3] ?? match[4];
            const weight = rawWeight === undefined ? 1 : graph.weight(rawWeight, number);
            if (to !== null && weight !== null) {
                graph.edge(from, to, weight, number);
            }
        }
    }
    return graph.result("list");
}

interface MatrixRow {
    readonly line: number;
    readonly name: string | null;
    readonly tokens: string[];
}

// The rows of a matrix typed as text, and its names: a first line of names over the columns and a name
// at the start or end of each row are both optional. A first line one shorter than every other line is
// a line of names even when the names are numbers, as in "   0  1 / 0  0  4 / 1  4  0".
function matrixRows(lines: readonly Line[]): { header: string[] | null; rows: MatrixRow[] } {
    const all = lines.map(line => ({ line: line.number, tokens: matrixTokens(line.text) }));
    const [first, ...rest] = all;
    if (first && rest.length > 0 && rest.every(row => row.tokens.length === first.tokens.length + 1)) {
        return { header: first.tokens, rows: rest.map(row => ({ line: row.line, name: row.tokens[0], tokens: row.tokens.slice(1) })) };
    }
    let header: string[] | null = null;
    const rows: MatrixRow[] = [];
    for (const [i, { line, tokens }] of all.entries()) {
        if (i === 0 && tokens.every(token => !isNumber(token))) {
            header = tokens;
            continue;
        }
        const cells = [...tokens];
        let name: string | null = null;
        if (cells.length > 0 && !isNumber(cells[0])) {
            name = cells.shift()!;
        } else if (cells.length > 0 && !isNumber(cells[cells.length - 1])) {
            name = cells.pop()!;
        }
        rows.push({ line, name, tokens: cells });
    }
    return { header, rows };
}

// rows of numbers, with their names if they have them
function matrixFromText(lines: readonly Line[], kind: "matrix" | "incidence", directed: boolean): ParsedGraph {
    const graph = new Builder(directed);
    const { header, rows: named } = matrixRows(lines);
    const rows: { line: number; name: string | null; cells: number[] }[] = [];
    for (const { line, name, tokens } of named) {
        const bad = tokens.find(token => !isNumber(token));
        if (bad !== undefined) {
            graph.fail(line, "not-a-number", { value: shorten(bad) });
            continue;
        }
        rows.push({ line, name, cells: tokens.map(Number) });
    }
    if (rows.length > PARSE_LIMITS.matrixRows) {
        throw new FormatError([problem("too-many-rows", { count: rows.length, max: PARSE_LIMITS.matrixRows })]);
    }
    const width = rows[0]?.cells.length ?? 0;
    for (const row of rows) {
        if (row.cells.length !== width) {
            graph.fail(row.line, "row-length", { count: row.cells.length, first: width });
        }
    }
    graph.check();
    const rowNames = rows.every(row => row.name !== null) ? rows.map(row => row.name!) : null;
    const isSquare = width === rows.length;
    if (kind === "matrix" && !isSquare) {
        throw new FormatError([problem("not-square", { rows: rows.length, columns: width })]);
    }
    const names = kind === "matrix"
        ? rowNames ?? header ?? rows.map((_, i) => String(i))
        : rowNames ?? rows.map((_, i) => String(i));
    if (kind === "matrix" && rowNames && header && header.join() !== rowNames.join()) {
        throw new FormatError([problem("names-differ")]);
    }
    if (kind === "matrix" && header && header.length !== width) {
        throw new FormatError([problem("names-count", { names: header.length, columns: width })]);
    }
    return kind === "matrix"
        ? adjacency(graph, names, rows.map(row => row.cells), rows.map(row => row.line))
        : incidence(graph, names, rows.map(row => row.cells), rows.map(row => row.line));
}

function adjacency(graph: Builder, rawNames: readonly unknown[], cells: number[][], lines: (number | null)[]): ParsedGraph {
    const names = rawNames.map((raw, i) => graph.name(raw, lines[i]));
    graph.check();
    const n = cells.length;
    const wrong = cells.find(row => row.length !== n);
    if (wrong) {
        throw new FormatError([problem("not-square", { rows: n, columns: wrong.length })]);
    }
    names.forEach(name => graph.point(name!));
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const value = cells[r][c];
            if (!Number.isFinite(value) || value < 0 || value > PARSE_LIMITS.weight) {
                graph.fail(lines[r], "bad-cell", { column: c + 1, value });
            } else if (value !== 0 && r === c) {
                graph.fail(lines[r], "diagonal", { name: names[r]! });
            } else if (!graph.directed && cells[c][r] !== value) {
                graph.fail(lines[r], "asymmetric", { from: names[r]!, to: names[c]!, value, back: cells[c][r] });
            } else if (value !== 0 && (graph.directed || r < c)) {
                graph.edge(names[r]!, names[c]!, value, lines[r]);
            }
        }
    }
    return graph.result("matrix");
}

function incidence(graph: Builder, rawNames: readonly unknown[], cells: number[][], lines: (number | null)[]): ParsedGraph {
    const names = rawNames.map((raw, i) => graph.name(raw, lines[i]));
    graph.check();
    names.forEach(name => graph.point(name!));
    const columns = cells[0]?.length ?? 0;
    for (let c = 0; c < columns; c++) {
        const touched = cells.map((row, r) => ({ r, value: row[c] })).filter(({ value }) => value !== 0);
        const column = c + 1;
        if (touched.length !== 2) {
            graph.fail(null, "column-count", { column, count: touched.length });
            continue;
        }
        const [a, b] = touched;
        if (!touched.every(({ value }) => Number.isFinite(value) && Math.abs(value) <= PARSE_LIMITS.weight)) {
            graph.fail(null, "column-too-big", { column });
        } else if (graph.directed) {
            const [from, to] = a.value < 0 ? [a, b] : [b, a];
            if (!(from.value < 0 && to.value > 0 && -from.value === to.value)) {
                graph.fail(null, "column-directed", { column, a: a.value, b: b.value });
            } else {
                graph.edge(names[from.r]!, names[to.r]!, to.value, null);
            }
        } else if (a.value !== b.value || a.value < 0) {
            graph.fail(null, "column-undirected", { column, a: a.value, b: b.value });
        } else {
            graph.edge(names[a.r]!, names[b.r]!, a.value, null);
        }
    }
    return graph.result("incidence");
}

// ---- JSON

function fromJson(text: string, format: GraphFormat | "auto", directedOption: boolean): ParsedGraph {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new FormatError([problem("bad-json", { reason: (error as Error).message })]);
    }
    const object = isObject(data) ? data : null;
    const directed = object && typeof object.directed === "boolean" ? object.directed : directedOption;
    const graph = new Builder(directed);
    const kind = format !== "auto" ? format : guessJson(data);
    const isMatrix = (value: unknown): value is number[][] =>
        Array.isArray(value) && value.length <= PARSE_LIMITS.matrixRows && value.every(row => Array.isArray(row) && row.every(cell => typeof cell === "number"));

    if (kind === "matrix" || kind === "incidence") {
        const key = kind === "matrix" ? "matrix" : "incidence";
        const cells = Array.isArray(data) ? data : object?.[key];
        if (!isMatrix(cells) || cells.some(row => row.length !== cells[0].length)) {
            throw new FormatError([problem(kind === "matrix" ? "expected-matrix" : "expected-incidence", { key: Array.isArray(data) ? "" : key })]);
        }
        const points = object && Array.isArray(object.points) ? object.points : cells.map((_, i) => String(i));
        if (points.length !== cells.length) {
            throw new FormatError([problem("names-for-rows", { names: points.length, rows: cells.length })]);
        }
        const lines = cells.map(() => null);
        return kind === "matrix" ? adjacency(graph, points, cells, lines) : incidence(graph, points, cells, lines);
    }

    if (kind === "edges") {
        const edges = Array.isArray(data) ? data : object?.edges;
        if (!Array.isArray(edges)) {
            throw new FormatError([problem("expected-edges")]);
        }
        const points = object && Array.isArray(object.points) ? object.points : [];
        if (points.length > PARSE_LIMITS.points) {
            throw new FormatError([problem("too-many-points", { count: points.length, max: PARSE_LIMITS.points })]);
        }
        if (edges.length > PARSE_LIMITS.edges) {
            throw new FormatError([problem("too-many-edges", { count: edges.length, max: PARSE_LIMITS.edges })]);
        }
        points.forEach((point: unknown) => {
            const name = graph.name(isObject(point) ? point.name : point, null);
            if (name !== null) {
                graph.point(name);
            }
        });
        edges.forEach((edge: unknown, i: number) => {
            const [rawFrom, rawTo, rawWeight] = Array.isArray(edge) ? edge
                : isObject(edge) ? [edge.from, edge.to, edge.weight]
                : [];
            const from = graph.name(rawFrom, null);
            const to = graph.name(rawTo, null);
            const weight = rawWeight === undefined ? 1 : graph.weight(rawWeight, null);
            if (from === null || to === null || weight === null) {
                graph.fail(null, "bad-edge", { index: i + 1 });
            } else {
                graph.edge(from, to, weight, null);
            }
        });
        return graph.result("edges");
    }

    // an adjacency list: { "A": ["B", "C"] }, { "A": { "B": 4 } }, { "A": [["B", 4]] } or { "A": [{ "name": "B", "weight": 4 }] }
    if (!object) {
        throw new FormatError([problem("expected-list")]);
    }
    // "directed" is the flag when it is true or false, else a point of that name
    const entries = Object.entries(object).filter(([key, value]) => !(key === "directed" && typeof value === "boolean"));
    if (entries.length > PARSE_LIMITS.points) {
        throw new FormatError([problem("too-many-points", { count: entries.length, max: PARSE_LIMITS.points })]);
    }
    for (const [key, neighbors] of entries) {
        const from = graph.name(key, null);
        if (from === null) {
            continue;
        }
        graph.point(from);
        const list: [unknown, unknown][] = Array.isArray(neighbors)
            ? neighbors.map(n => Array.isArray(n) ? [n[0], n[1]] : isObject(n) ? [n.name, n.weight] : [n, undefined])
            : isObject(neighbors) ? Object.entries(neighbors)
            : [];
        if (!Array.isArray(neighbors) && !isObject(neighbors)) {
            graph.fail(null, "neighbors-shape", { name: from });
        }
        for (const [rawTo, rawWeight] of list) {
            const to = graph.name(rawTo, null);
            const weight = rawWeight === undefined ? 1 : graph.weight(rawWeight, null);
            if (to !== null && weight !== null) {
                graph.edge(from, to, weight, null);
            }
        }
    }
    return graph.result("list");
}

// a piece of the input shown in a problem, never longer than a name can be
function shorten(text: string): string {
    return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function guessJson(data: unknown): GraphFormat {
    if (Array.isArray(data)) {
        if (data.length > 0 && data.every(row => Array.isArray(row) && row.every(cell => typeof cell === "number"))) {
            return data.every(row => (row as unknown[]).length === data.length) ? "matrix" : "incidence";
        }
        return "edges";
    }
    // an adjacency list may have points named "incidence", "matrix" or "edges": the format's own key holds an array
    if (isObject(data)) {
        if (Array.isArray(data.incidence)) {
            return "incidence";
        }
        if (Array.isArray(data.matrix)) {
            return "matrix";
        }
        if (Array.isArray(data.edges)) {
            return "edges";
        }
    }
    return "list";
}
