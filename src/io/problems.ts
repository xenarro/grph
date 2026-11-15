// What can be wrong with a graph someone pastes in. A problem is a code with its values, so it can be told
// in any language: the English is here, other languages give their own ProblemMessages.

export interface Problem {
    readonly code: ProblemCode;
    // the line of the text it is on, from 1; null for JSON, which has no lines worth naming, or the whole input
    readonly line: number | null;
    readonly values: ProblemValues;
}

export type ProblemValues = Readonly<Record<string, string | number>>;

// how a language tells each problem; `n` writes a number the way the language does
export type ProblemMessages = {
    readonly line: (line: string) => string;
    readonly problems: Readonly<Record<ProblemCode, (values: ProblemValues, n: (value: string | number) => string) => string>>;
    readonly locale: string;
};

export type ProblemCode =
    | "not-text" | "too-long" | "empty" | "too-many-lines" | "too-many-points" | "too-many-edges" | "too-many-rows"
    | "bad-name" | "reserved-name" | "bad-weight" | "self-loop" | "weight-twice"
    | "edge-parts" | "list-line" | "list-entry"
    | "not-a-number" | "row-length" | "not-square" | "names-differ" | "names-count" | "bad-cell" | "diagonal" | "asymmetric"
    | "column-count" | "column-too-big" | "column-directed" | "column-undirected"
    | "bad-json" | "expected-matrix" | "expected-incidence" | "names-for-rows" | "expected-edges" | "bad-edge"
    | "expected-list" | "neighbors-shape"
    | "matrix-too-big";

export const englishProblems: ProblemMessages = {
    locale: "en-US",
    line: line => `Line ${line}: `,
    problems: {
        "not-text": () => "The graph must be text.",
        "too-long": (v, n) => `The text is too long: at most ${n(v.max)} characters.`,
        "empty": () => "There is nothing to convert yet.",
        "too-many-lines": (v, n) => `Too many lines: ${n(v.count)}, at most ${n(v.max)}.`,
        "too-many-points": (v, n) => `Too many points: ${n(v.count)}, at most ${n(v.max)}.`,
        "too-many-edges": (v, n) => `Too many edges: ${n(v.count)}, at most ${n(v.max)}.`,
        "too-many-rows": (v, n) => `Too many rows: ${n(v.count)}, at most ${n(v.max)}.`,
        "bad-name": v => `"${v.name}" can't be a point name: use 1 to 32 letters, digits, "_", "." or "-".`,
        "reserved-name": v => `"${v.name}" can't be a point name: it is reserved.`,
        "bad-weight": (v, n) => `"${v.value}" can't be a weight: use a number above 0, at most ${n(v.max)}.`,
        "self-loop": v => `an edge must join two different points; this one goes from ${v.name} to itself.`,
        "weight-twice": v => `the edge ${v.edge} is given twice, with weights ${v.first} and ${v.second}.`,
        "edge-parts": v => `expected "from to" or "from to weight", got ${v.count} parts.`,
        "list-line": () => `expected "point: neighbor, neighbor(weight), …".`,
        "list-entry": v => `"${v.entry}" is not "neighbor" or "neighbor(weight)".`,
        "not-a-number": v => `"${v.value}" is not a number.`,
        "row-length": v => `this row has ${v.count} numbers, the first one ${v.first}.`,
        "not-square": v => `An adjacency matrix has as many columns as rows; this one has ${v.rows} rows and ${v.columns} columns. Is it an incidence matrix?`,
        "names-differ": () => "The names on the rows and the columns differ.",
        "names-count": v => `There are ${v.names} names over ${v.columns} columns.`,
        "bad-cell": v => `the cell in column ${v.column} must be 0 or a weight above 0, got ${v.value}.`,
        "diagonal": v => `${v.name} has an edge to itself; the diagonal must be 0.`,
        "asymmetric": v => `${v.from}–${v.to} is ${v.value} but ${v.to}–${v.from} is ${v.back}: an undirected matrix is symmetric. Tick "Directed" if the edges have directions.`,
        "column-count": v => `column ${v.column} has ${v.count} numbers other than 0; an edge's column has exactly 2.`,
        "column-too-big": v => `column ${v.column} holds a number that is too big.`,
        "column-directed": v => `column ${v.column}: a directed edge has −weight where it leaves and +weight where it enters, got ${v.a} and ${v.b}.`,
        "column-undirected": v => `column ${v.column}: an undirected edge has the same weight above 0 in both rows, got ${v.a} and ${v.b}. Tick "Directed" for −weight and +weight.`,
        "bad-json": v => `This is not valid JSON: ${v.reason}`,
        "expected-matrix": v => `Expected an adjacency matrix: an array of rows of numbers${v.key ? `, under "${v.key}"` : ""}, all as long as the first.`,
        "expected-incidence": v => `Expected an incidence matrix: an array of rows of numbers${v.key ? `, under "${v.key}"` : ""}, all as long as the first.`,
        "names-for-rows": v => `There are ${v.names} point names for ${v.rows} rows.`,
        "expected-edges": () => 'Expected an edge list: an array like [["A", "B", 4]], or { "edges": [...] }.',
        "bad-edge": v => `edge ${v.index} is not ["from", "to"] or ["from", "to", weight].`,
        "expected-list": () => 'Expected an adjacency list: an object like { "A": { "B": 4, "C": 2 } }.',
        "neighbors-shape": v => `the neighbors of ${v.name} must be a list or an object.`,
        "matrix-too-big": (v, n) => `The matrix would have ${n(v.cells)} cells, too many to write out; at most ${n(v.max)}. An adjacency list or an edge list holds this graph in far less.`,
    },
};

export function problemText(problem: Problem, messages: ProblemMessages = englishProblems): string {
    const n = (value: string | number) => typeof value === "number" ? value.toLocaleString(messages.locale) : value;
    const text = messages.problems[problem.code](problem.values, n);
    return problem.line === null ? text : messages.line(n(problem.line)) + text;
}

export class FormatError extends Error {
    constructor(readonly problems: readonly Problem[]) {
        super(problems.map(problem => problemText(problem)).join("\n"));
        this.name = "FormatError";
    }
}

export const problem = (code: ProblemCode, values: ProblemValues = {}, line: number | null = null): Problem => ({ code, line, values });
