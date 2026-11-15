// Every point keeps a list of its neighbors: the points its edges lead to, with the edge weights.
// An undirected edge X–Y is stored twice: Y in X's list and X in Y's list.
// A directed edge X→Y is stored once: Y in X's list.
//
// example (undirected):
//
// const adjacencyList = {
//  a: [b, c],
//  b: [a, c],
//  c: [a, b]
// }
//
// Memory: one list per point plus one entry per edge end (2 × edges when undirected).

import GraphInterface from "./interfaces/graph";
import Edge from "./interfaces/edge";
import Neighbor from "./interfaces/neighbor";
import { assertEdge, assertPointName, missingEdge, missingPoint } from "./validation";

type Entry = { name: string; weight: number };

export default class AdjacencyList implements GraphInterface {
    readonly graph: Map<string, Entry[]>;
    readonly directed: boolean;

    constructor(directed: boolean = false) {
        this.graph = new Map();
        this.directed = directed;
    }

    addPoint(name: string) {
        assertPointName(name);
        if (!this.graph.has(name)) {
            this.graph.set(name, []);
        }
        return this;
    }

    addPoints(names: string[]) {
        names.forEach(name => this.addPoint(name));
        return this;
    }

    removePoint(name: string) {
        this.getList(name);
        this.graph.delete(name);

        // remove the edges that lead to the removed point
        this.graph.forEach(list => this.removeEntry(list, name));
        return this;
    }

    hasPoint(name: string): boolean {
        return this.graph.has(name);
    }

    getPoints(): string[] {
        return [...this.graph.keys()];
    }

    addEdge(nameX: string, nameY: string, weight: number = 1) {
        assertEdge(nameX, nameY, weight);
        this.addPoint(nameX);
        this.addPoint(nameY);

        this.setEntry(nameX, nameY, weight);
        if (!this.directed) {
            this.setEntry(nameY, nameX, weight);
        }
        return this;
    }

    removeEdge(nameX: string, nameY: string) {
        const listX = this.getList(nameX);
        const listY = this.getList(nameY);
        if (!this.removeEntry(listX, nameY)) {
            throw missingEdge(nameX, nameY, this.directed);
        }
        if (!this.directed) {
            this.removeEntry(listY, nameX);
        }
        return this;
    }

    hasEdge(nameX: string, nameY: string): boolean {
        return this.graph.get(nameX)?.some(entry => entry.name === nameY) ?? false;
    }

    getEdges(): Edge[] {
        const edges: Edge[] = [];
        const listed = new Set<string>();
        this.graph.forEach((list, from) => {
            list.forEach(entry => {
                // an undirected edge is stored in both lists; report it from the first one
                if (this.directed || !listed.has(entry.name)) {
                    edges.push({ from, to: entry.name, weight: entry.weight });
                }
            });
            listed.add(from);
        });
        return edges;
    }

    // Reads the point's list as it is stored.
    getNeighbors(name: string): Neighbor[] {
        return this.getList(name).map(entry => ({ ...entry }));
    }

    private getList(name: string): Entry[] {
        const list = this.graph.get(name);
        if (!list) {
            throw missingPoint(name);
        }
        return list;
    }

    // adds a neighbor to the list, or updates the weight if it is already there
    private setEntry(from: string, to: string, weight: number): void {
        const list = this.getList(from);
        const entry = list.find(e => e.name === to);
        if (entry) {
            entry.weight = weight;
        } else {
            list.push({ name: to, weight });
        }
    }

    // a list holds each neighbor at most once (see setEntry)
    private removeEntry(list: Entry[], name: string): boolean {
        const index = list.findIndex(entry => entry.name === name);
        if (index >= 0) {
            list.splice(index, 1);
        }
        return index >= 0;
    }

    // weights are shown only when they are not 1: "A: B -> C(2)"
    print(): string {
        const longestName = Math.max(0, ...this.getPoints().map(name => name.length));
        let print = "";
        this.graph.forEach((list, name) => {
            const entries = list.map(entry => entry.weight === 1 ? entry.name : `${entry.name}(${entry.weight})`);
            print += `${name.padStart(longestName)}: ${entries.join(" -> ")}\n`;
        });
        return print;
    }
}
