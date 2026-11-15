// Each row and each column represents a point (node, vertex).
// The cell in row X, column Y holds the weight of the edge X→Y, or 0 when there is no edge.
// An undirected edge is stored twice: in [X][Y] and in [Y][X], so the matrix is symmetric.
//
// The matrix is stored as one flat array, row by row: cell [row][column] is graph[row * size + column].
//
// example (undirected, 3 points):
//     p1,p2,p3
// const adjacencyMatrix = [
//     0, 1, 1, // point 1
//     1, 0, 1, // point 2
//     1, 1, 0  // point 3
//];
//
// Memory: size × size cells, whatever the number of edges.

import Point from "./point";
import GraphInterface from "./interfaces/graph";
import Edge from "./interfaces/edge";
import Neighbor from "./interfaces/neighbor";
import { assertEdge, assertPointName, missingEdge, missingPoint } from "./validation";

export default class AdjacencyMatrix implements GraphInterface {
    readonly graph: number[];
    readonly points: Map<string, Point>;
    readonly directed: boolean;

    constructor(directed: boolean = false) {
        this.graph = [];
        this.points = new Map();
        this.directed = directed;
    }

    addPoint(name: string) {
        assertPointName(name);
        if (this.points.has(name)) {
            return this;
        }

        this.points.set(name, new Point(name, this.points.size));
        const size = this.points.size;

        // add a new column: insert a 0 at the end of every existing row
        for (let row = 1; row < size; row++) {
            this.graph.splice(size * row - 1, 0, 0);
        }
        // add a new row
        this.graph.push(...new Array(size).fill(0));
        return this;
    }

    removePoint(name: string) {
        const removed = this.getPoint(name);
        const size = this.points.size;

        // drop the point's row and column; its edges are removed with them
        const kept = this.graph.filter((_, cell) => {
            const row = Math.floor(cell / size);
            const column = cell % size;
            return row !== removed.getIndex() && column !== removed.getIndex();
        });
        this.graph.splice(0, this.graph.length, ...kept);

        // points after the removed one move up by one row and column
        this.points.delete(name);
        const names = [...this.points.keys()];
        this.points.clear();
        names.forEach((pointName, index) => this.points.set(pointName, new Point(pointName, index)));
        return this;
    }

    hasPoint(name: string): boolean {
        return this.points.has(name);
    }

    getPoint(name: string): Point {
        const point = this.points.get(name);
        if (!point) {
            throw missingPoint(name);
        }
        return point;
    }

    getPoints(): string[] {
        return [...this.points.keys()];
    }

    addEdge(nameX: string, nameY: string, weight: number = 1) {
        assertEdge(nameX, nameY, weight);
        this.addPoint(nameX);
        this.addPoint(nameY);

        const pointX = this.getPoint(nameX);
        const pointY = this.getPoint(nameY);

        this.graph[this.cell(pointX, pointY)] = weight;
        if (!this.directed) {
            this.graph[this.cell(pointY, pointX)] = weight;
        }
        return this;
    }

    removeEdge(nameX: string, nameY: string) {
        const pointX = this.getPoint(nameX);
        const pointY = this.getPoint(nameY);
        if (this.graph[this.cell(pointX, pointY)] === 0) {
            throw missingEdge(nameX, nameY, this.directed);
        }

        this.graph[this.cell(pointX, pointY)] = 0;
        if (!this.directed) {
            this.graph[this.cell(pointY, pointX)] = 0;
        }
        return this;
    }

    hasEdge(nameX: string, nameY: string): boolean {
        const pointX = this.points.get(nameX);
        const pointY = this.points.get(nameY);
        return pointX !== undefined && pointY !== undefined && this.graph[this.cell(pointX, pointY)] !== 0;
    }

    getEdges(): Edge[] {
        const points = [...this.points.values()];
        const edges: Edge[] = [];
        points.forEach(from => {
            points.forEach(to => {
                // an undirected edge is stored twice; report it once, from the upper half of the matrix
                if (!this.directed && to.getIndex() < from.getIndex()) {
                    return;
                }
                const weight = this.graph[this.cell(from, to)];
                if (weight !== 0) {
                    edges.push({ from: from.getName(), to: to.getName(), weight });
                }
            });
        });
        return edges;
    }

    // Reads the point's row: every non-zero cell is an edge to the point of that column.
    getNeighbors(name: string): Neighbor[] {
        const from = this.getPoint(name);
        const neighbors: Neighbor[] = [];
        this.points.forEach(to => {
            const weight = this.graph[this.cell(from, to)];
            if (weight !== 0) {
                neighbors.push({ name: to.getName(), weight });
            }
        });
        return neighbors;
    }

    // index of cell [from][to] in the flat array
    private cell(from: Point, to: Point): number {
        return this.points.size * from.getIndex() + to.getIndex();
    }

    print(): string {
        const names = this.getPoints();
        const size = names.length;
        const value = (row: number, column: number) => String(this.graph[row * size + column]);

        // each column is as wide as its header or its widest value, whichever is wider
        const widths = names.map((name, column) =>
            Math.max(name.length, ...names.map((_, row) => value(row, column).length))
        );

        let print = names.map((name, column) => name.padStart(widths[column])).join(" | ") + " | \n";
        names.forEach((rowName, row) => {
            print += names.map((_, column) => value(row, column).padStart(widths[column])).join(" | ");
            print += " | " + rowName + "\n";
        });
        return print;
    }
}

export {Point};
