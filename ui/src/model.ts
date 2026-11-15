// The graph being edited in the browser. Every edit is applied to all three representations,
// so they can be shown side by side. Point positions are only needed for drawing and are kept here.

import AdjacencyMatrix from "../../src/graph/adjacency-matrix";
import AdjacencyList from "../../src/graph/adjacency-list";
import IncidenceMatrix from "../../src/graph/incidence-matrix";
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

// the drawing area, in SVG units
export const VIEW = { width: 800, height: 560 };

// The page draws every cell of both matrices, so it grows with the square of the number of points:
// 100 points already take about 90,000 elements and a few hundred freeze the browser.
// These limits keep the structures readable and the page fast.
export const MAX_POINTS = 40;
export const MAX_EDGES = 120;

export class GraphTooBigError extends Error {}

export class GraphModel {
    matrix = new AdjacencyMatrix(false);
    list = new AdjacencyList(false);
    incidence = new IncidenceMatrix(false);
    readonly positions = new Map<string, Position>();

    get directed(): boolean {
        return this.list.directed;
    }

    representation(id: RepresentationId): Graph {
        return { matrix: this.matrix, list: this.list, incidence: this.incidence }[id];
    }

    private get all(): Graph[] {
        return [this.matrix, this.list, this.incidence];
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
        return this.points().length < MAX_POINTS;
    }

    canAddEdge(): boolean {
        return this.edges().length < MAX_EDGES;
    }

    position(name: string): Position {
        return this.positions.get(name) ?? { x: VIEW.width / 2, y: VIEW.height / 2 };
    }

    addPoint(name: string, position: Position): void {
        this.all.forEach(graph => graph.addPoint(name));
        this.positions.set(name, clamp(position));
    }

    movePoint(name: string, position: Position): void {
        this.positions.set(name, clamp(position));
    }

    removePoint(name: string): void {
        this.all.forEach(graph => graph.removePoint(name));
        this.positions.delete(name);
    }

    // adds the edge, or changes its weight when it already exists
    addEdge(nameX: string, nameY: string, weight: number = 1): void {
        this.all.forEach(graph => graph.addEdge(nameX, nameY, weight));
    }

    removeEdge(nameX: string, nameY: string): void {
        this.all.forEach(graph => graph.removeEdge(nameX, nameY));
    }

    // Rebuilds the graph with the other kind of edges. An undirected edge becomes one
    // directed edge; two opposite directed edges become one undirected edge.
    setDirected(directed: boolean): void {
        this.load({ ...this.toData(), directed });
    }

    // throws a GraphTooBigError, before building anything, when the graph is over the limits
    load(data: GraphData): void {
        const names = new Set([...data.points.map(p => p.name), ...data.edges.flatMap(e => [e.from, e.to])]);
        if (names.size > MAX_POINTS || data.edges.length > MAX_EDGES) {
            throw new GraphTooBigError(`${names.size} points and ${data.edges.length} edges is over the limit`);
        }
        this.matrix = new AdjacencyMatrix(data.directed);
        this.list = new AdjacencyList(data.directed);
        this.incidence = new IncidenceMatrix(data.directed);
        this.positions.clear();
        data.points.forEach(({ name, x, y }) => this.addPoint(name, { x, y }));
        data.edges.forEach(({ from, to, weight }) => this.addEdge(from, to, weight));
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

// keeps points inside the drawing area
const MARGIN = 36;
function clamp({ x, y }: Position): Position {
    return {
        x: Math.min(VIEW.width - MARGIN, Math.max(MARGIN, x)),
        y: Math.min(VIEW.height - MARGIN, Math.max(MARGIN, y)),
    };
}
