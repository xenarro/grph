// The adjacency list of adjacency-list.ts, packed into a few long typed arrays, for big graphs.
//
// AdjacencyList keeps every edge end as a small { name, weight } object in an array per point. Each object
// and each array costs the JavaScript engine a header and pointers on top of the values it holds.
// Here an edge end is three numbers in three shared arrays, 16 bytes, and nothing else.
//
// Points are numbered in the order they are added, and the number is where a point's data sits.
// Every point's list is a chain of entries in the shared arrays (this layout is known as a "forward star"):
//
//     to[e]      the number of the neighbor
//     weight[e]  the weight of the edge
//     next[e]    the next entry of the same list, or -1 after the last one
//
// first[p] and last[p] are the two ends of point p's chain, -1 while the list is empty. A new entry is
// linked after last[p], so neighbors keep the order they were added in, as in AdjacencyList.
//
// example (undirected, edges A–B, A–C and B–C added in that order, all of weight 1):
//
//     names  = [A, B, C]           first = [0, 1, 3]        last = [2, 4, 5]
//     to     = [1, 0, 2, 0, 2, 1]
//     next   = [2, 4, -1, 5, -1, -1]
//     A's list: entries 0, 2 (B, C)     B's: 1, 4 (A, C)     C's: 3, 5 (A, B)
//
// The entry of a removed edge goes onto a chain of free entries, and the next new edge takes it.
// A removed point leaves its number unused; once more than half the numbers are unused, the points are
// numbered again from 0, in the same order.
//
// It behaves exactly like AdjacencyList: the same Graph interface and rules, and the same order of points,
// neighbors and edges. So the algorithms and convert() work on it unchanged and give the same results.
//
// Memory: 16 bytes per edge end (an undirected edge has two), 8 bytes per point, and the names. Measured in
// Node 24 for a million points and three million edges, without the name strings: 136 MB after reserve(),
// 154 MB without it, against 445 MB in AdjacencyList.

import GraphInterface from "./interfaces/graph";
import Edge from "./interfaces/edge";
import Neighbor from "./interfaces/neighbor";
import { assertEdge, assertPointName, GraphError, missingEdge, missingPoint } from "./validation";

const NONE = -1;
const FIRST_CAPACITY = 16;

export default class CompactAdjacencyList implements GraphInterface {
    readonly directed: boolean;

    // a point's number → its name, null where a removed point was
    private names: (string | null)[] = [];
    // a point's name → its number
    private readonly numbers = new Map<string, number>();
    private first = new Int32Array(0);
    private last = new Int32Array(0);
    // numbers given out so far, unused ones included
    private used = 0;

    private to = new Int32Array(0);
    private weight = new Float64Array(0);
    private next = new Int32Array(0);
    // entries given out so far, free ones included
    private entries = 0;
    // the first entry of the free chain
    private free = NONE;
    // entries in the lists
    private linked = 0;

    constructor(directed: boolean = false) {
        this.directed = directed;
    }

    // Makes room for this many more points and edges at once. The arrays grow by themselves as the graph
    // grows, but each time they grow they are copied, and they can end up a third empty; a graph of a
    // known size built after reserve() takes only the memory it needs.
    reserve(points: number, edges: number): this {
        if (!Number.isSafeInteger(points) || !Number.isSafeInteger(edges) || points < 0 || edges < 0) {
            throw new GraphError(`Reserve room for a whole number of points and edges, got ${points} and ${edges}`);
        }
        this.growPoints(this.used + points);
        this.growEntries(this.entries + (this.directed ? edges : 2 * edges));
        return this;
    }

    pointCount(): number {
        return this.numbers.size;
    }

    edgeCount(): number {
        return this.directed ? this.linked : this.linked / 2;
    }

    addPoint(name: string) {
        assertPointName(name);
        if (this.numbers.has(name)) {
            return this;
        }
        if (this.used === this.first.length && this.used - this.numbers.size > this.used / 2) {
            this.renumber();
        }
        this.growPoints(this.used + 1);
        const p = this.used++;
        this.names.push(name);
        this.numbers.set(name, p);
        this.first[p] = NONE;
        this.last[p] = NONE;
        return this;
    }

    addPoints(names: string[]) {
        this.growPoints(this.used + names.length);
        names.forEach(name => this.addPoint(name));
        return this;
    }

    removePoint(name: string) {
        const p = this.number(name);
        if (this.directed) {
            // an edge into p can be in any other list
            for (let q = 0; q < this.used; q++) {
                if (q !== p) {
                    this.unlink(q, p);
                }
            }
        } else {
            // an undirected edge p–q is also in q's list
            for (let e = this.first[p]; e !== NONE; e = this.next[e]) {
                this.unlink(this.to[e], p);
            }
        }
        // p's own list goes onto the free chain whole
        for (let e = this.first[p]; e !== NONE; e = this.next[e]) {
            this.linked--;
        }
        if (this.first[p] !== NONE) {
            this.next[this.last[p]] = this.free;
            this.free = this.first[p];
        }
        this.first[p] = NONE;
        this.last[p] = NONE;
        this.names[p] = null;
        this.numbers.delete(name);
        return this;
    }

    hasPoint(name: string): boolean {
        return this.numbers.has(name);
    }

    getPoints(): string[] {
        return this.names.filter((name): name is string => name !== null);
    }

    addEdge(nameX: string, nameY: string, weight: number = 1) {
        assertEdge(nameX, nameY, weight);
        // adding a point can number the points again, so the numbers are read after both
        this.addPoint(nameX).addPoint(nameY);
        const x = this.number(nameX);
        const y = this.number(nameY);
        this.link(x, y, weight);
        if (!this.directed) {
            this.link(y, x, weight);
        }
        return this;
    }

    removeEdge(nameX: string, nameY: string) {
        const x = this.number(nameX);
        const y = this.number(nameY);
        if (!this.unlink(x, y)) {
            throw missingEdge(nameX, nameY, this.directed);
        }
        if (!this.directed) {
            this.unlink(y, x);
        }
        return this;
    }

    hasEdge(nameX: string, nameY: string): boolean {
        const x = this.numbers.get(nameX);
        const y = this.numbers.get(nameY);
        return x !== undefined && y !== undefined && this.find(x, y) !== NONE;
    }

    getEdges(): Edge[] {
        const edges: Edge[] = [];
        for (let p = 0; p < this.used; p++) {
            for (let e = this.first[p]; e !== NONE; e = this.next[e]) {
                const q = this.to[e];
                // an undirected edge is in both lists; it is reported from the point added first, as AdjacencyList does
                if (this.directed || q > p) {
                    edges.push({ from: this.names[p]!, to: this.names[q]!, weight: this.weight[e] });
                }
            }
        }
        return edges;
    }

    // Reads the point's list as it is stored.
    getNeighbors(name: string): Neighbor[] {
        const neighbors: Neighbor[] = [];
        for (let e = this.first[this.number(name)]; e !== NONE; e = this.next[e]) {
            neighbors.push({ name: this.names[this.to[e]]!, weight: this.weight[e] });
        }
        return neighbors;
    }

    // the same text as AdjacencyList.print(): weights only when they are not 1, "A: B -> C(2)"
    print(): string {
        const points = this.getPoints();
        // a loop, not Math.max(...names): a million arguments are more than a call can take
        let longestName = 0;
        points.forEach(name => longestName = Math.max(longestName, name.length));
        const lines = points.map(name => {
            const entries = this.getNeighbors(name).map(n => n.weight === 1 ? n.name : `${n.name}(${n.weight})`);
            return `${name.padStart(longestName)}: ${entries.join(" -> ")}\n`;
        });
        return lines.join("");
    }

    private number(name: string): number {
        const p = this.numbers.get(name);
        if (p === undefined) {
            throw missingPoint(name);
        }
        return p;
    }

    // the entry for q in p's list, or NONE
    private find(p: number, q: number): number {
        for (let e = this.first[p]; e !== NONE; e = this.next[e]) {
            if (this.to[e] === q) {
                return e;
            }
        }
        return NONE;
    }

    // puts q at the end of p's list, or sets the weight when q is already in it
    private link(p: number, q: number, weight: number): void {
        const found = this.find(p, q);
        if (found !== NONE) {
            this.weight[found] = weight;
            return;
        }
        let e = this.free;
        if (e !== NONE) {
            this.free = this.next[e];
        } else {
            this.growEntries(this.entries + 1);
            e = this.entries++;
        }
        this.to[e] = q;
        this.weight[e] = weight;
        this.next[e] = NONE;
        if (this.last[p] === NONE) {
            this.first[p] = e;
        } else {
            this.next[this.last[p]] = e;
        }
        this.last[p] = e;
        this.linked++;
    }

    // takes q out of p's list and puts its entry onto the free chain; false when q is not in the list
    private unlink(p: number, q: number): boolean {
        let before = NONE;
        for (let e = this.first[p]; e !== NONE; before = e, e = this.next[e]) {
            if (this.to[e] !== q) {
                continue;
            }
            const after = this.next[e];
            if (before === NONE) {
                this.first[p] = after;
            } else {
                this.next[before] = after;
            }
            if (this.last[p] === e) {
                this.last[p] = before;
            }
            this.next[e] = this.free;
            this.free = e;
            this.linked--;
            return true;
        }
        return false;
    }

    // numbers the points 0, 1, 2, ... again, in the same order, leaving out the removed ones
    private renumber(): void {
        const renumbered = new Int32Array(this.used);
        const names: string[] = [];
        for (let p = 0; p < this.used; p++) {
            const name = this.names[p];
            if (name === null) {
                continue;
            }
            // a point only moves down, onto a place already read
            const q = names.length;
            renumbered[p] = q;
            this.first[q] = this.first[p];
            this.last[q] = this.last[p];
            this.numbers.set(name, q);
            names.push(name);
        }
        // the entries on the free chain are in no list, and their `to` is never read
        for (let p = 0; p < names.length; p++) {
            for (let e = this.first[p]; e !== NONE; e = this.next[e]) {
                this.to[e] = renumbered[this.to[e]];
            }
        }
        this.names = names;
        this.used = names.length;
    }

    // the arrays grow by half again, or to `size` when that is more
    private growPoints(size: number): void {
        if (size > this.first.length) {
            const capacity = Math.max(size, Math.ceil(this.first.length * 1.5), FIRST_CAPACITY);
            this.first = grownInts(this.first, capacity);
            this.last = grownInts(this.last, capacity);
        }
    }

    private growEntries(size: number): void {
        if (size > this.to.length) {
            const capacity = Math.max(size, Math.ceil(this.to.length * 1.5), FIRST_CAPACITY);
            this.to = grownInts(this.to, capacity);
            this.next = grownInts(this.next, capacity);
            const weight = new Float64Array(capacity);
            weight.set(this.weight);
            this.weight = weight;
        }
    }
}

function grownInts(array: Int32Array, capacity: number): Int32Array<ArrayBuffer> {
    const grown = new Int32Array(capacity);
    grown.set(array);
    return grown;
}
