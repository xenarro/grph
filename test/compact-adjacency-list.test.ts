import { describe, expect, it } from "vitest";
import { bfs } from "../src/algorithms/bfs";
import { dfs } from "../src/algorithms/dfs";
import { dijkstra } from "../src/algorithms/dijkstra";
import { topologicalSort } from "../src/algorithms/topological-sort";
import AdjacencyList from "../src/graph/adjacency-list";
import CompactAdjacencyList from "../src/graph/compact-adjacency-list";
import Graph from "../src/graph/interfaces/graph";
import { generate } from "../ui/src/generate";

// small deterministic pseudo-random generator so failures can be reproduced
function random(seed: number) {
    return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
}

// everything the Graph interface shows, in the order it shows it
const everything = (graph: Graph) => ({
    points: graph.getPoints(),
    edges: graph.getEdges(),
    neighbors: graph.getPoints().map(name => graph.getNeighbors(name)),
    print: graph.print(),
});

const counts = (list: AdjacencyList) => {
    let entries = 0;
    list.graph.forEach(neighbors => entries += neighbors.length);
    return { points: list.graph.size, edges: list.directed ? entries : entries / 2 };
};

describe("CompactAdjacencyList", () => {
    it("stores an undirected edge in both lists and a directed edge in one", () => {
        const undirected = new CompactAdjacencyList(false).addEdge("A", "B", 2);
        expect(undirected.getNeighbors("A")).toEqual([{ name: "B", weight: 2 }]);
        expect(undirected.getNeighbors("B")).toEqual([{ name: "A", weight: 2 }]);

        const directed = new CompactAdjacencyList(true).addEdge("A", "B", 2);
        expect(directed.getNeighbors("A")).toEqual([{ name: "B", weight: 2 }]);
        expect(directed.getNeighbors("B")).toEqual([]);
    });

    it("updates the weight when an edge is added again instead of duplicating it", () => {
        const graph = new CompactAdjacencyList().addEdge("A", "B", 2).addEdge("B", "A", 5);
        expect(graph.getNeighbors("A")).toEqual([{ name: "B", weight: 5 }]);
        expect(graph.getNeighbors("B")).toEqual([{ name: "A", weight: 5 }]);
        expect(graph.edgeCount()).toBe(1);
    });

    it("removes every edge that leads to a removed point", () => {
        const graph = new CompactAdjacencyList(true).addEdge("A", "B").addEdge("C", "B").addEdge("B", "C");
        graph.removePoint("B");
        expect(graph.getPoints()).toEqual(["A", "C"]);
        expect(graph.getNeighbors("A")).toEqual([]);
        expect(graph.getNeighbors("C")).toEqual([]);
        expect(graph.edgeCount()).toBe(0);
    });

    it("keeps neighbors in insertion order, also after a removal in the middle and at the end", () => {
        const graph = new CompactAdjacencyList().addPoint("A").addEdge("A", "C").addEdge("A", "B").addEdge("A", "D");
        expect(graph.getNeighbors("A").map(n => n.name)).toEqual(["C", "B", "D"]);
        graph.removeEdge("A", "B").removeEdge("D", "A").addEdge("A", "E");
        expect(graph.getNeighbors("A").map(n => n.name)).toEqual(["C", "E"]);
    });

    it("reports each undirected edge once, from the point added first", () => {
        const graph = new CompactAdjacencyList().addEdge("A", "B").addEdge("C", "B", 3);
        expect(graph.getEdges()).toEqual([
            { from: "A", to: "B", weight: 1 },
            { from: "B", to: "C", weight: 3 },
        ]);
    });

    it("prints like AdjacencyList, with weights that are not 1", () => {
        expect(new CompactAdjacencyList().addEdge("A", "B").addEdge("A", "CC", 2).print()).toBe(
            " A: B -> CC(2)\n" +
            " B: A\n" +
            "CC: A(2)\n"
        );
    });

    it("throws for missing points and edges, and for bad names and weights", () => {
        const graph = new CompactAdjacencyList().addEdge("A", "B").addPoint("C");
        expect(() => graph.removePoint("Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "C")).toThrow(/Edge A–C does not exist/);
        expect(() => graph.getNeighbors("Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.addPoint(" ")).toThrow(/non-empty string/);
        expect(() => graph.addEdge("A", "A")).toThrow(/two different points/);
        expect(() => graph.addEdge("A", "B", 0)).toThrow(/positive number/);
        expect(graph.hasEdge("A", "Z")).toBe(false);
        expect(graph.hasEdge("Z", "A")).toBe(false);
    });

    it("counts its points and edges", () => {
        const undirected = new CompactAdjacencyList().addEdge("A", "B").addEdge("B", "C").addPoint("D");
        expect([undirected.pointCount(), undirected.edgeCount()]).toEqual([4, 2]);
        const directed = new CompactAdjacencyList(true).addEdge("A", "B").addEdge("B", "A");
        expect([directed.pointCount(), directed.edgeCount()]).toEqual([2, 2]);
    });

    it("reserves room only for whole numbers of points and edges", () => {
        expect(() => new CompactAdjacencyList().reserve(-1, 0)).toThrow(/whole number/);
        expect(() => new CompactAdjacencyList().reserve(1, 0.5)).toThrow(/whole number/);
        expect(() => new CompactAdjacencyList().reserve(NaN, 0)).toThrow(/whole number/);
        const graph = new CompactAdjacencyList().reserve(3, 2).addEdge("A", "B").addEdge("B", "C").addEdge("C", "D");
        expect(graph.getEdges()).toHaveLength(3);
    });

    // Many points come and go, so the free entries are taken again and the points get numbered again:
    // after every change everything must read exactly as in AdjacencyList, order included.
    describe.each([false, true])("matches AdjacencyList exactly (directed: %s)", directed => {
        it.each([1, 2, 3, 4, 5, 6])("random operations, seed %i", seed => {
            const next = random(seed);
            const names = Array.from({ length: 40 }, (_, i) => `P${i}`);
            const pick = () => names[Math.floor(next() * names.length)];
            const list = new AdjacencyList(directed);
            const compact = new CompactAdjacencyList(directed);

            for (let step = 0; step < 1500; step++) {
                const roll = next();
                const x = pick();
                const y = pick();
                if (roll < 0.45) {
                    if (x === y) continue;
                    const weight = 1 + Math.floor(next() * 9);
                    list.addEdge(x, y, weight);
                    compact.addEdge(x, y, weight);
                } else if (roll < 0.6) {
                    if (!list.hasEdge(x, y)) continue;
                    list.removeEdge(x, y);
                    compact.removeEdge(x, y);
                } else if (roll < 0.8) {
                    if (!list.hasPoint(x)) continue;
                    list.removePoint(x);
                    compact.removePoint(x);
                } else {
                    list.addPoint(x);
                    compact.addPoint(x);
                }
                expect(everything(compact)).toEqual(everything(list));
                expect({ points: compact.pointCount(), edges: compact.edgeCount() }).toEqual(counts(list));
                expect(compact.hasEdge(x, y)).toBe(list.hasEdge(x, y));
            }
        });
    });

    it("numbers the points again once most of them are removed, keeping their order and edges", () => {
        const names = Array.from({ length: 16 }, (_, i) => `P${i}`);
        const list = new AdjacencyList();
        const compact = new CompactAdjacencyList();
        names.forEach((name, i) => [list, compact].forEach(g => g.addEdge(name, names[(i + 5) % 16], i + 1)));
        // 9 of the 16 numbers become unused, so the 17th point is added after numbering the 7 left again
        names.filter((_, i) => i % 2 === 0 || i === 15).forEach(name => [list, compact].forEach(g => g.removePoint(name)));
        [list, compact].forEach(g => g.addEdge("Q", "P1", 7).addEdge("P3", "Q", 2));
        expect(everything(compact)).toEqual(everything(list));
    });

    it("gives the algorithms the same graph as AdjacencyList, so they give the same results", () => {
        const data = generate({ points: 2_000, seed: 7, directed: true });
        const build = (graph: Graph) => {
            data.points.forEach(({ name }) => graph.addPoint(name));
            data.edges.forEach(({ from, to }, i) => graph.addEdge(from, to, 1 + (i % 5)));
            return graph;
        };
        const list = build(new AdjacencyList(true));
        const compact = build(new CompactAdjacencyList(true));
        const summary = (result: { steps: { length: number; at(i: number): { message: string } } }) =>
            ({ ...result, steps: [result.steps.length, result.steps.at(-1).message] });
        expect(summary(dfs(compact, "1", "1999"))).toEqual(summary(dfs(list, "1", "1999")));
        expect(summary(bfs(compact, "1", "1999"))).toEqual(summary(bfs(list, "1", "1999")));
        expect(summary(dijkstra(compact, "1", "1999"))).toEqual(summary(dijkstra(list, "1", "1999")));
        expect(summary(topologicalSort(compact))).toEqual(summary(topologicalSort(list)));
    });

    it("holds a graph of 200,000 points and prints it", () => {
        const data = generate({ points: 200_000, seed: 1, directed: false });
        const graph = new CompactAdjacencyList().reserve(data.points.length, data.edges.length);
        data.points.forEach(({ name }) => graph.addPoint(name));
        data.edges.forEach(({ from, to }) => graph.addEdge(from, to));
        expect(graph.pointCount()).toBe(200_000);
        expect(graph.edgeCount()).toBe(data.edges.length);
        expect(graph.getEdges()).toEqual(data.edges);
        expect(graph.print().split("\n")).toHaveLength(200_001);
        expect(bfs(graph, "1").order.length).toBeGreaterThan(190_000);
    });
});
