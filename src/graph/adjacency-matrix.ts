// Each row and each column represents a point (node, vertex).
// The cell in row X, column Y holds the weight of the edge X→Y, or 0 when there is no edge.
// An undirected edge is stored twice: in [X][Y] and in [Y][X], so the matrix is symmetric.
//
// The matrix is stored as one flat array, row by row: cell [row][column] is graph[row * size + column].
// It is a Float64Array: every cell takes exactly 8 bytes and holds any weight a JS number can.
// A typed array has a fixed length, so adding or removing points builds a new array once
// and copies the old rows into it.
//
// example (undirected, 3 points):
//     p1,p2,p3
// const adjacencyMatrix = [
//     0, 1, 1, // point 1
//     1, 0, 1, // point 2
//     1, 1, 0  // point 3
//];
//
// Memory: size × size cells, whatever the number of edges: 8 MB for 1,000 points, 800 MB for 10,000.

import Point from "./point";
import GraphInterface from "./interfaces/graph";
import Edge from "./interfaces/edge";
import Neighbor from "./interfaces/neighbor";
import { assertEdge, assertPointName, missingEdge, missingPoint } from "./validation";

export default class AdjacencyMatrix implements GraphInterface {
    // replaced by a bigger or smaller array when points are added or removed
    graph: Float64Array;
    readonly points: Map<string, Point>;
    readonly directed: boolean;

    constructor(directed: boolean = false) {
        this.graph = new Float64Array(0);
        this.points = new Map();
        this.directed = directed;
    }

    addPoint(name: string) {
        return this.addPoints([name]);
    }

    // Adds a row and a column for every new point. The matrix is rebuilt once for all of them,
    // so adding 1,000 points at once copies the cells once instead of 1,000 times.
    addPoints(names: string[]) {
        names.forEach(assertPointName);
        const oldSize = this.points.size;
        names.forEach(name => {
            if (!this.points.has(name)) {
                this.points.set(name, new Point(name, this.points.size));
            }
        });
        const size = this.points.size;
        if (size === oldSize) {
            return this;
        }

        // every old row keeps its cells at its start; the new columns and rows are zeros
        const graph = new Float64Array(size * size);
        for (let row = 0; row < oldSize; row++) {
            graph.set(this.graph.subarray(row * oldSize, (row + 1) * oldSize), row * size);
        }
        this.graph = graph;
        return this;
    }

    removePoint(name: string) {
        const removed = this.getPoint(name).getIndex();
        const oldSize = this.points.size;
        const size = oldSize - 1;

        // copy every row except the point's, leaving out the point's column;
        // its edges are removed with them
        const graph = new Float64Array(size * size);
        for (let row = 0, target = 0; row < oldSize; row++) {
            if (row === removed) {
                continue;
            }
            const start = row * oldSize;
            graph.set(this.graph.subarray(start, start + removed), target * size);
            graph.set(this.graph.subarray(start + removed + 1, start + oldSize), target * size + removed);
            target++;
        }
        this.graph = graph;

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
