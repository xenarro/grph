// The graph being edited in the browser.
//
// The adjacency list holds it. A list grows with points + edges, so it can hold any graph the page can.
// The two matrices grow much faster (points × points and points × edges cells), so they are built from
// the list only while the graph is small enough for them, follow every edit from then on, and are
// dropped as soon as the graph outgrows them. Point positions are only needed for drawing and are kept here.

import AdjacencyMatrix from "../../src/graph/adjacency-matrix";
import AdjacencyList from "../../src/graph/adjacency-list";
import IncidenceMatrix from "../../src/graph/incidence-matrix";
import { convert } from "../../src/graph/convert";
import Graph from "../../src/graph/interfaces/graph";
import Edge from "../../src/graph/interfaces/edge";

export type RepresentationId = "matrix" | "list" | "incidence";

export const representationNames: Record<RepresentationId, string> = {
    matrix: "Adjacency matrix",
    list: "Adjacency list",
    incidence: "Incidence matrix",
};

export interface Position {
    x: number;
    y: number;
}

export interface GraphData {
    directed: boolean;
    points: { name: string; x: number; y: number }[];
    edges: Edge[];
}

// The area a small graph is drawn in, in drawing units. The paper itself has no edges:
// points can be anywhere, and the view zooms and moves to show them.
export const VIEW = { width: 800, height: 560 };

export class GraphTooBigError extends Error {}

export const LIMITS = {
    // The whole graph. The adjacency list of 100,000 points and 300,000 edges takes about 50 MB.
    graph: { points: 100_000, edges: 300_000 },
    // The matrices are not built past these sizes.
    matrix: { points: 1_000 },                       // 1,000 × 1,000 cells: 8 MB
    incidence: { points: 1_000, cells: 3_000_000 },  // points × edges cells: about 36 MB
};
export type Limits = typeof LIMITS;
export type MatrixId = Exclude<RepresentationId, "list">;

// Bytes one cell takes, measured in Chrome's JavaScript engine (V8): the adjacency matrix
// is a Float64Array, the incidence matrix is an array of ordinary number arrays.
export const BYTES_PER_CELL: Record<MatrixId, number> = { matrix: 8, incidence: 12 };
// and about this much for each list and each entry of the adjacency list, with its name and weight
export const BYTES_PER_LIST_ITEM = 64;

export interface StructureSize {
    cells: number;
    bytes: number;
    // false when the graph is too big for the page to build this matrix
    fits: boolean;
}

export class GraphModel {
    list = new AdjacencyList(false);
    private builtMatrix: AdjacencyMatrix | null = new AdjacencyMatrix(false);
    private builtIncidence: IncidenceMatrix | null = new IncidenceMatrix(false);
    readonly positions = new Map<string, Position>();
    readonly limits: Limits;

    constructor(limits: Limits = LIMITS) {
        this.limits = limits;
    }

    get directed(): boolean {
        return this.list.directed;
    }

    // null while the graph is too big for the matrix
    get matrix(): AdjacencyMatrix | null {
        return this.builtMatrix;
    }

    // null while the graph is too big for the matrix
    get incidence(): IncidenceMatrix | null {
        return this.builtIncidence;
    }

    // null while the graph is too big for that representation
    representation(id: RepresentationId): Graph | null {
        return { matrix: this.builtMatrix, list: this.list, incidence: this.builtIncidence }[id];
    }

    pointCount(): number {
        return this.list.graph.size;
    }

    // counted from the list without building the edge list: every undirected edge is in two lists
    edgeCount(): number {
        let entries = 0;
        this.list.graph.forEach(list => entries += list.length);
        return this.directed ? entries : entries / 2;
    }

    // how big a matrix is, or would be, for the current graph
    size(id: MatrixId): StructureSize {
        const points = this.pointCount();
        const cells = id === "matrix" ? points * points : points * this.edgeCount();
        const fits = id === "matrix"
            ? points <= this.limits.matrix.points
            : points <= this.limits.incidence.points && cells <= this.limits.incidence.cells;
        return { cells, bytes: cells * BYTES_PER_CELL[id], fits };
    }

    points(): string[] {
        return this.list.getPoints();
    }

    edges(): Edge[] {
        return this.list.getEdges();
    }

    hasEdge(nameX: string, nameY: string): boolean {
        return this.list.hasEdge(nameX, nameY);
    }

    weight(nameX: string, nameY: string): number | undefined {
        return this.list.getNeighbors(nameX).find(n => n.name === nameY)?.weight;
    }

    canAddPoint(): boolean {
        return this.pointCount() < this.limits.graph.points;
    }

    canAddEdge(): boolean {
        return this.edgeCount() < this.limits.graph.edges;
    }

    position(name: string): Position {
        return this.positions.get(name) ?? { x: VIEW.width / 2, y: VIEW.height / 2 };
    }

    addPoint(name: string, position: Position): void {
        this.edit(graph => graph.addPoint(name));
        this.positions.set(name, usable(position));
    }

    movePoint(name: string, position: Position): void {
        this.positions.set(name, usable(position));
    }

    removePoint(name: string): void {
        this.edit(graph => graph.removePoint(name));
        this.positions.delete(name);
    }

    // adds the edge, or changes its weight when it already exists
    addEdge(nameX: string, nameY: string, weight: number = 1): void {
        this.edit(graph => graph.addEdge(nameX, nameY, weight));
    }

    removeEdge(nameX: string, nameY: string): void {
        this.edit(graph => graph.removeEdge(nameX, nameY));
    }

    // Applies an edit to the list, then brings each matrix up to date: a matrix the graph still fits
    // gets the same edit, one the graph has outgrown is dropped, and one the graph fits again
    // is built from the list.
    private edit(change: (graph: Graph) => void): void {
        change(this.list);
        this.builtMatrix = this.follow(this.builtMatrix, "matrix", change, () => new AdjacencyMatrix(this.directed));
        this.builtIncidence = this.follow(this.builtIncidence, "incidence", change, () => new IncidenceMatrix(this.directed));
    }

    private follow<T extends Graph>(built: T | null, id: MatrixId, change: (graph: Graph) => void, create: () => T): T | null {
        if (!this.size(id).fits) {
            return null;
        }
        if (built) {
            change(built);
            return built;
        }
        return convert(this.list, create());
    }

    // Rebuilds the graph with the other kind of edges. An undirected edge becomes one
    // directed edge; two opposite directed edges become one undirected edge.
    setDirected(directed: boolean): void {
        this.load({ ...this.toData(), directed });
    }

    // throws a GraphTooBigError, before building anything, when the graph is over the limits
    load(data: GraphData): void {
        const names = new Set([...data.points.map(p => p.name), ...data.edges.flatMap(e => [e.from, e.to])]);
        if (names.size > this.limits.graph.points || data.edges.length > this.limits.graph.edges) {
            throw new GraphTooBigError(`${names.size} points and ${data.edges.length} edges is over the limit`);
        }
        // the list first, then the matrices the graph fits, converted from the list
        this.list = new AdjacencyList(data.directed);
        this.builtMatrix = null;
        this.builtIncidence = null;
        this.positions.clear();
        data.points.forEach(({ name, x, y }) => {
            this.list.addPoint(name);
            this.positions.set(name, usable({ x, y }));
        });
        data.edges.forEach(({ from, to, weight }) => this.list.addEdge(from, to, weight));
        this.edit(() => {});
    }

    toData(): GraphData {
        return {
            directed: this.directed,
            points: this.points().map(name => ({ name, ...this.position(name) })),
            edges: this.edges(),
        };
    }

    // the first free name: A, B, ... Z, then A1, B1, ...
    nextPointName(): string {
        const taken = new Set(this.points());
        for (let round = 0; ; round++) {
            for (let code = 65; code <= 90; code++) {
                const name = String.fromCharCode(code) + (round === 0 ? "" : round);
                if (!taken.has(name)) {
                    return name;
                }
            }
        }
    }
}

// a position that can be drawn: a missing or broken coordinate, for example from edited saved data,
// goes to the middle of the drawing area
function usable({ x, y }: Position): Position {
    return {
        x: Number.isFinite(x) ? x : VIEW.width / 2,
        y: Number.isFinite(y) ? y : VIEW.height / 2,
    };
}
