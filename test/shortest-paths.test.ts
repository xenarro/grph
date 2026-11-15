import { describe, expect, it } from "vitest";
import { bfs } from "../src/algorithms/bfs";
import { dijkstra } from "../src/algorithms/dijkstra";
import { PriorityQueue } from "../src/algorithms/priority-queue";
import { edgeKey, Trace } from "../src/algorithms/trace";
import AdjacencyMatrix from "../src/graph/adjacency-matrix";
import AdjacencyList from "../src/graph/adjacency-list";
import CompactAdjacencyList from "../src/graph/compact-adjacency-list";
import IncidenceMatrix from "../src/graph/incidence-matrix";
import Graph from "../src/graph/interfaces/graph";
import { generate } from "../ui/src/generate";

const representations = [
    ["AdjacencyMatrix", (directed: boolean): Graph => new AdjacencyMatrix(directed)],
    ["AdjacencyList", (directed: boolean): Graph => new AdjacencyList(directed)],
    ["CompactAdjacencyList", (directed: boolean): Graph => new CompactAdjacencyList(directed)],
    ["IncidenceMatrix", (directed: boolean): Graph => new IncidenceMatrix(directed)],
] as const;

function random(seed: number) {
    return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
}

function randomGraph(seed: number, directed: boolean, create: (directed: boolean) => Graph): Graph {
    const next = random(seed);
    const graph = create(directed);
    const n = 1 + Math.floor(next() * 10);
    const names = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    names.forEach(name => graph.addPoint(name));
    const edges = Math.floor(next() * n * 2);
    for (let i = 0; i < edges; i++) {
        const a = names[Math.floor(next() * n)];
        const b = names[Math.floor(next() * n)];
        if (a !== b) {
            graph.addEdge(a, b, 1 + Math.floor(next() * 9) + (next() < 0.3 ? 0.5 : 0));
        }
    }
    return graph;
}

// the slow, obvious way: relax every edge points - 1 times (Bellman–Ford)
function slowDistances(graph: Graph, start: string, weighted: boolean): Map<string, number> {
    const distances = new Map([[start, 0]]);
    const edges = graph.getEdges().flatMap(e => graph.directed ? [e] : [e, { from: e.to, to: e.from, weight: e.weight }]);
    for (let round = 1; round < graph.getPoints().length; round++) {
        for (const { from, to, weight } of edges) {
            const through = (distances.get(from) ?? Infinity) + (weighted ? weight : 1);
            if (through < (distances.get(to) ?? Infinity)) {
                distances.set(to, through);
            }
        }
    }
    return distances;
}

const weightOf = (graph: Graph, path: string[]) => path.slice(1).reduce((sum, name, i) => {
    const neighbor = graph.getNeighbors(path[i]).find(n => n.name === name);
    expect(neighbor, `edge ${path[i]}→${name}`).toBeDefined();
    return sum + neighbor!.weight;
}, 0);

// every step can be reached forwards and backwards
function replays(trace: Trace): void {
    for (let i = 0; i < trace.length; i++) {
        trace.at(i);
    }
    for (let i = trace.length - 1; i >= 0; i--) {
        trace.at(i);
    }
}

describe("PriorityQueue", () => {
    it("takes items out smallest first", () => {
        const next = random(5);
        const queue = new PriorityQueue<number>((a, b) => a < b);
        const values = Array.from({ length: 500 }, () => Math.floor(next() * 100));
        values.forEach(value => queue.push(value));
        const out: number[] = [];
        while (queue.size > 0) {
            out.push(queue.pop()!);
        }
        expect(out).toEqual([...values].sort((a, b) => a - b));
        expect(queue.pop()).toBeUndefined();
    });
});

describe.each(representations)("shortest paths on %s", (_, create) => {
    it.each([false, true])("Dijkstra finds the lightest distances and paths (directed: %s)", directed => {
        for (let seed = 1; seed <= 60; seed++) {
            const graph = randomGraph(seed, directed, create);
            const points = graph.getPoints();
            const start = points[0];
            const expected = slowDistances(graph, start, true);
            const result = dijkstra(graph, start);
            expect([...result.distances.keys()].sort()).toEqual([...expected.keys()].sort());
            expected.forEach((distance, name) => expect(result.distances.get(name)).toBeCloseTo(distance, 9));
            replays(result.steps);

            const target = points[seed % points.length];
            const toTarget = dijkstra(graph, start, target);
            if (expected.has(target)) {
                expect(toTarget.distance).toBeCloseTo(expected.get(target)!, 9);
                expect(toTarget.path![0]).toBe(start);
                expect(toTarget.path!.at(-1)).toBe(target);
                expect(weightOf(graph, toTarget.path!)).toBeCloseTo(toTarget.distance!, 9);
            } else {
                expect(toTarget.path).toBeNull();
            }
            replays(toTarget.steps);
        }
    });

    it.each([false, true])("breadth-first search finds the fewest edges (directed: %s)", directed => {
        for (let seed = 1; seed <= 60; seed++) {
            const graph = randomGraph(seed, directed, create);
            const points = graph.getPoints();
            const start = points[0];
            const expected = slowDistances(graph, start, false);
            const result = bfs(graph, start);
            expect(Object.fromEntries(result.distances)).toEqual(Object.fromEntries(expected));
            replays(result.steps);

            const target = points[seed % points.length];
            const toTarget = bfs(graph, start, target);
            if (expected.has(target)) {
                expect(toTarget.path!.length - 1).toBe(expected.get(target));
            } else {
                expect(toTarget.path).toBeNull();
            }
        }
    });
});

describe("the difference between fewest edges and least weight", () => {
    // A–B–C costs 1 + 1, the direct edge A–C costs 5
    const graph = new AdjacencyList().addEdge("A", "B", 1).addEdge("B", "C", 1).addEdge("A", "C", 5);

    it("Dijkstra takes the lighter way round", () => {
        const { path, distance, steps } = dijkstra(graph, "A", "C");
        expect(path).toEqual(["A", "B", "C"]);
        expect(distance).toBe(2);
        const last = steps.at(-1);
        expect(last.message).toBe("The lightest path from A to C: A → B → C, total weight 2.");
        expect(last.edges.get(edgeKey("A", "B", false))).toBe("result");
        expect(last.edges.get(edgeKey("A", "C", false))).toBe("skipped");
        expect(last.labels.get("C")).toBe("2");
    });

    it("breadth-first search takes the single edge", () => {
        const { path, steps } = bfs(graph, "A", "C");
        expect(path).toEqual(["A", "C"]);
        expect(steps.at(-1).message).toMatch(/^Found C: A → C, 1 edge\./);
    });

    it("Dijkstra shows the queue sorted by distance and moves a point up when it gets nearer", () => {
        const { steps } = dijkstra(graph, "A");
        const queues = Array.from({ length: steps.length }, (_, i) => [...steps.at(i).lists[0].items].join(" "));
        // after A's edges: B at 1, C at 5; after B's edge to C: C at 2
        expect(queues).toContain("B: 1 C: 5");
        expect(queues).toContain("C: 2");
    });

    it("says when the target can't be reached, and when start and target are the same", () => {
        const two = new AdjacencyList(true).addEdge("A", "B").addPoint("C");
        expect(dijkstra(two, "A", "C").steps.at(-1).message).toMatch(/C is not one of them/);
        expect(bfs(two, "A", "C").steps.at(-1).message).toMatch(/C is not one of them/);
        expect(dijkstra(two, "A", "A").path).toEqual(["A"]);
        expect(bfs(two, "A", "A").path).toEqual(["A"]);
    });

    it("throws for a missing start or target", () => {
        expect(() => dijkstra(graph, "Z")).toThrow(/Point Z does not exist/);
        expect(() => bfs(graph, "A", "Z")).toThrow(/Point Z does not exist/);
    });
});

describe("on a big graph", () => {
    it("finds the lightest path across 100,000 points", () => {
        const data = generate({ points: 100_000, seed: 11, directed: false });
        const graph = new AdjacencyList();
        data.points.forEach(p => graph.addPoint(p.name));
        data.edges.forEach(e => graph.addEdge(e.from, e.to, e.weight));
        const { path, distance } = dijkstra(graph, "1", "50000");
        expect(path![0]).toBe("1");
        expect(path!.at(-1)).toBe("50000");
        expect(weightOf(graph, path!)).toBe(distance);
        // with every weight 1, the lightest path has as few edges as possible
        expect(bfs(graph, "1", "50000").path!.length).toBe(path!.length);
    });
});
