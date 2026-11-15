// How each structure works, shown in its section: the idea, a small runnable piece of TypeScript,
// and what it is good and bad at. test/structure-explainers.test.ts runs the code.

import { RepresentationId } from "./model";

export interface StructureExplainer {
    readonly idea: readonly string[];
    readonly typescript: string;
    readonly goodFor: readonly string[];
    readonly badFor: readonly string[];
}

export const structureExplainers: Readonly<Record<RepresentationId, StructureExplainer>> = {
    matrix: {
        idea: [
            "A grid with a row and a column for every point. The cell in row X, column Y holds the weight of the edge from X to Y, or 0 when there is none. An undirected edge fills two cells, X,Y and Y,X, so the grid is symmetric.",
            "This page keeps it as one flat array, row after row: cell [x][y] is at `x × size + y`. Its size never depends on the edges: V points take V² cells, even with no edges at all. Adding a point copies the whole array into a bigger one.",
        ],
        typescript: `// 3 points, 0, 1 and 2, and the edges 0–1 (weight 4) and 1–2 (weight 2)
const size = 3;
const cells = new Float64Array(size * size); // row after row
const cell = (x: number, y: number) => x * size + y;
cells[cell(0, 1)] = cells[cell(1, 0)] = 4;
cells[cell(1, 2)] = cells[cell(2, 1)] = 2;

// is there an edge x–y? one look at one cell
const hasEdge = (x: number, y: number) => cells[cell(x, y)] !== 0;

// the neighbors of x: read its whole row
function neighbors(x: number): number[] {
    const found: number[] = [];
    for (let y = 0; y < size; y++) {
        if (cells[cell(x, y)] !== 0) {
            found.push(y);
        }
    }
    return found;
}`,
        goodFor: [
            "Asking whether two points are connected: one look at one cell, however many edges there are.",
            "Dense graphs, where most pairs are connected: a cell is just a number, with no names or links around it.",
            "Algorithms that look at every pair of points, like Floyd–Warshall's shortest paths between all pairs.",
        ],
        badFor: [
            "Sparse graphs, which most real graphs are: nearly every cell is 0, and the zeros still take memory.",
            "Many points: 1,000 points take a million cells, 100,000 points ten billion.",
            "Walking the graph: the neighbors of a point with one edge still cost a read of its whole row.",
        ],
    },

    list: {
        idea: [
            "Every point keeps a list of its neighbors, with the weights of the edges to them. An undirected edge X–Y is in both lists: Y in X's list and X in Y's.",
            "This page keeps a `Map` from each point's name to an array of `{ name, weight }` entries. Its size grows with the points and edges actually there: V lists and 2E entries for an undirected graph.",
        ],
        typescript: `type Entry = { name: string; weight: number };
const lists = new Map<string, Entry[]>();

function addEdge(x: string, y: string, weight = 1) {
    for (const point of [x, y]) {
        if (!lists.has(point)) {
            lists.set(point, []);
        }
    }
    lists.get(x)!.push({ name: y, weight });
    lists.get(y)!.push({ name: x, weight }); // undirected: both lists
}

// the neighbors of x: its list, nothing else to read
const neighbors = (x: string) => lists.get(x) ?? [];

// is there an edge x–y? look through x's list
const hasEdge = (x: string, y: string) =>
    neighbors(x).some(entry => entry.name === y);

addEdge("A", "B", 4);
addEdge("B", "C", 2);`,
        goodFor: [
            "Sparse graphs, which most real ones are: roads, social networks, the web. It stores only the edges that exist.",
            "Walking the graph, as depth-first search, breadth-first search and Dijkstra's algorithm do: a point's neighbors cost exactly their number to read.",
            "Graphs that grow: a new point is a new empty list, a new edge one or two entries.",
        ],
        badFor: [
            "Checking one particular edge at a point with very many neighbors: the list has to be searched.",
            "Dense graphs: an entry with its name and weight takes more memory than a matrix cell, and there are nearly V² of them.",
        ],
    },

    incidence: {
        idea: [
            "A row for every point and a column for every edge. An edge's column has a number only in the rows of the two points it joins: its weight in both for an undirected edge; for a directed edge, −weight where it leaves and +weight where it enters.",
            "So every edge is a column that can be read on its own: which points does it join? Finding a point's neighbors takes two steps: read the point's row, and for each edge in it, read the edge's column to find its other end.",
        ],
        typescript: `// rows[point][edge]: the edge's weight where it touches the point, else 0
// 3 points, 0, 1 and 2; edge 0 joins 0–1 (weight 4), edge 1 joins 1–2 (weight 2)
const rows = [
    [4, 0],
    [4, 2],
    [0, 2],
];

// the points an edge joins: read its column
const ends = (edge: number) =>
    rows.flatMap((row, point) => (row[edge] !== 0 ? [point] : []));

// the neighbors of x: each edge in x's row, then the other end of that edge
const neighbors = (x: number) =>
    rows[x].flatMap((value, edge) =>
        value === 0 ? [] : ends(edge).filter(point => point !== x));`,
        goodFor: [
            "Problems about the edges themselves: electrical circuits (Kirchhoff's laws are written with it), flows through networks, and the linear algebra of graphs.",
            "Hypergraphs, where one edge can join more than two points: the column just gets more numbers.",
        ],
        badFor: [
            "Walking the graph: every neighbor costs a scan of the point's row and then of a whole column.",
            "Memory: points × edges cells is the most of the three for nearly every graph with more edges than points.",
        ],
    },
};
