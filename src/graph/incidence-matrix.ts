// Each row represents a point (node, vertex), each column represents an edge.
// A column has exactly two non-zero cells: the two points the edge connects.
// - undirected edge: the weight in both rows;
// - directed edge X→Y: -weight in row X (the edge leaves X), +weight in row Y (the edge enters Y).
//
// example (undirected, 3 points, 3 edges):
//     e1,e2,e3
// const incidenceMatrix = [
//     [1, 1, 0], // point 1
//     [0, 1, 1], // point 2
//     [1, 0, 1]  // point 3
//];
//
// Memory: points × edges cells.

import Point from "./point";
import GraphInterface from "./interfaces/graph";
import Edge from "./interfaces/edge";
import Neighbor from "./interfaces/neighbor";
import { assertEdge, assertPointName, missingEdge, missingPoint } from "./validation";

// the label of a column: which points the edge connects
type EdgeLabel = { from: string; to: string };

export default class IncidenceMatrix implements GraphInterface {
    readonly graph: number[][];
    readonly points: Map<string, Point>;
    readonly edges: EdgeLabel[];
    readonly directed: boolean;

    constructor(directed: boolean = false) {
        this.graph = [];
        this.points = new Map();
        this.edges = [];
        this.directed = directed;
    }

    addPoint(name: string) {
        assertPointName(name);
        if (!this.points.has(name)) {
            this.points.set(name, new Point(name, this.points.size));
            this.graph.push(new Array(this.edges.length).fill(0));
        }
        return this;
    }

    addPoints(names: string[]) {
        names.forEach(name => this.addPoint(name));
        return this;
    }

    removePoint(name: string) {
        const removed = this.getPoint(name);

        // remove the point's edges: every column with a non-zero cell in its row
        for (let column = this.edges.length - 1; column >= 0; column--) {
            if (this.graph[removed.getIndex()][column] !== 0) {
                this.removeColumn(column);
            }
        }

        // remove the point's row; points below it move up by one row
        this.graph.splice(removed.getIndex(), 1);
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

        let column = this.findColumn(nameX, nameY);
        if (column === -1) {
            // add a new column of zeros
            column = this.edges.length;
            this.edges.push({ from: nameX, to: nameY });
            this.graph.forEach(row => row.push(0));
        }

        this.graph[this.getPoint(nameX).getIndex()][column] = this.directed ? -weight : weight;
        this.graph[this.getPoint(nameY).getIndex()][column] = weight;
        return this;
    }

    removeEdge(nameX: string, nameY: string) {
        this.getPoint(nameX);
        this.getPoint(nameY);
        const column = this.findColumn(nameX, nameY);
        if (column === -1) {
            throw missingEdge(nameX, nameY, this.directed);
        }
        this.removeColumn(column);
        return this;
    }

    hasEdge(nameX: string, nameY: string): boolean {
        return this.findColumn(nameX, nameY) !== -1;
    }

    getEdges(): Edge[] {
        return this.edges.map(({ from, to }, column) => ({
            from,
            to,
            weight: this.graph[this.getPoint(to).getIndex()][column],
        }));
    }

    // Reads the point's row. For every edge in the row, scans the edge's column
    // to find the point at its other end. In a directed graph only edges that
    // leave the point (negative cells) lead to neighbors.
    getNeighbors(name: string): Neighbor[] {
        const point = this.getPoint(name);
        const others = [...this.points.values()].filter(other => other !== point);
        const neighbors: Neighbor[] = [];

        this.graph[point.getIndex()].forEach((value, column) => {
            if (value === 0 || (this.directed && value > 0)) {
                return;
            }
            const other = others.find(o => this.graph[o.getIndex()][column] !== 0);
            if (other) {
                neighbors.push({ name: other.getName(), weight: Math.abs(this.graph[other.getIndex()][column]) });
            }
        });
        return neighbors;
    }

    // index of the column that holds the edge, or -1
    findColumn(nameX: string, nameY: string): number {
        return this.edges.findIndex(({ from, to }) =>
            (from === nameX && to === nameY) || (!this.directed && from === nameY && to === nameX)
        );
    }

    private removeColumn(column: number): void {
        this.edges.splice(column, 1);
        this.graph.forEach(row => row.splice(column, 1));
    }

    print(): string {
        const names = this.getPoints();
        const longestName = Math.max(0, ...names.map(name => name.length));
        const widths = this.edges.map((_, column) =>
            Math.max(...this.graph.map(row => String(row[column]).length))
        );

        let print = "";
        this.points.forEach(point => {
            const cells = this.graph[point.getIndex()].map((value, column) => String(value).padStart(widths[column]));
            print += `${point.getName().padStart(longestName)} ${cells.join(" ")}\n`;
        });
        return print;
    }
}

export {Point};
