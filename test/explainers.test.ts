import { stripTypeScriptTypes } from "node:module";
import { describe, expect, it } from "vitest";
import { algorithms } from "../src/algorithms";
import { bfs } from "../src/algorithms/bfs";
import { dfs } from "../src/algorithms/dfs";
import { dijkstra } from "../src/algorithms/dijkstra";
import { topologicalSort } from "../src/algorithms/topological-sort";
import AdjacencyList from "../src/graph/adjacency-list";
import Graph from "../src/graph/interfaces/graph";
import { explainers } from "../ui/src/explainers";
import { presets } from "../ui/src/presets";

// every kind of step an algorithm records on the examples, with and without a target
function stepKinds(id: string): Set<string> {
    const algorithm = algorithms.find(a => a.id === id)!;
    const kinds = new Set<string>();
    for (const { data } of presets) {
        if (algorithm.directedOnly && !data.directed) {
            continue;
        }
        const graph: Graph = new AdjacencyList(data.directed);
        data.points.forEach(p => graph.addPoint(p.name));
        data.edges.forEach(e => graph.addEdge(e.from, e.to, e.weight));
        const points = graph.getPoints();
        const targets = algorithm.target === "none" ? [undefined] : [undefined, ...points];
        for (const target of targets) {
            const trace = algorithm.run(graph, { start: points[0], target });
            for (let i = 0; i < trace.length; i++) {
                const { line } = trace.at(i);
                if (line !== undefined) {
                    kinds.add(line);
                }
            }
        }
    }
    return kinds;
}

describe("explainers", () => {
    it.each(algorithms.map(a => [a.id]))("explain %s", id => {
        const explainer = explainers[id];
        expect(explainer).toBeDefined();
        for (const field of [explainer.uses, explainer.idea, explainer.cost, explainer.useWhen, explainer.avoidWhen, explainer.tryIt]) {
            expect(field.length).toBeGreaterThan(0);
        }
    });

    it.each(algorithms.map(a => [a.id]))("have a pseudocode line for every kind of step of %s, and no others", id => {
        const inPseudocode = new Set(explainers[id].pseudocode.flatMap(line => line.steps ?? []));
        const recorded = stepKinds(id);
        expect([...recorded].filter(kind => !inPseudocode.has(kind))).toEqual([]);
        expect([...inPseudocode].filter(kind => !recorded.has(kind))).toEqual([]);
    });

    it("only suggest examples that exist", () => {
        const names = new Set(presets.map(p => p.name));
        const suggested = Object.values(explainers).flatMap(e => e.tryIt.join(" ").match(/`([^`]+)`/g) ?? [])
            .map(code => code.slice(1, -1))
            .filter(name => /^[A-Z]/.test(name) && !algorithms.some(a => a.name === name) && !/points$/.test(name) && name !== "Read neighbors from");
        expect(suggested.filter(name => !names.has(name))).toEqual([]);
    });
});

// The TypeScript on the page, run for real: types stripped by Node, then compared with this library.

const example = (id: string, name: string): (...args: any[]) => any =>
    new Function(`${stripTypeScriptTypes(explainers[id].typescript)}\nreturn ${name};`)();

function random(seed: number) {
    return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
}

function randomGraph(seed: number, directed: boolean): Graph {
    const next = random(seed);
    const graph = new AdjacencyList(directed);
    const n = 1 + Math.floor(next() * 9);
    const names = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    names.forEach(name => graph.addPoint(name));
    for (let i = Math.floor(next() * n * 2); i > 0; i--) {
        const a = names[Math.floor(next() * n)];
        const b = names[Math.floor(next() * n)];
        if (a !== b) {
            graph.addEdge(a, b, 1 + Math.floor(next() * 9));
        }
    }
    return graph;
}

const weightOf = (graph: Graph, path: string[]) =>
    path.slice(1).reduce((sum, name, i) => sum + graph.getNeighbors(path[i]).find(n => n.name === name)!.weight, 0);

describe("the TypeScript on the page", () => {
    const runs = Array.from({ length: 80 }, (_, i) => ({ seed: i + 1, directed: i % 2 === 1 }));

    it("depth-first search visits points in the same order as this library", () => {
        const pageDfs = example("dfs", "dfs");
        for (const { seed, directed } of runs) {
            const graph = randomGraph(seed, directed);
            const start = graph.getPoints()[0];
            expect(pageDfs(graph, start)).toEqual(dfs(graph, start).order);
        }
    });

    it("breadth-first search finds the same path with the fewest edges", () => {
        const pageBfs = example("bfs", "bfs");
        for (const { seed, directed } of runs) {
            const graph = randomGraph(seed, directed);
            const points = graph.getPoints();
            const target = points[seed % points.length];
            expect(pageBfs(graph, points[0], target)).toEqual(bfs(graph, points[0], target).path);
        }
    });

    it("Dijkstra's algorithm finds a path of the same, lightest weight", () => {
        const pageDijkstra = example("dijkstra", "dijkstra");
        for (const { seed, directed } of runs) {
            const graph = randomGraph(seed, directed);
            const points = graph.getPoints();
            const target = points[seed % points.length];
            const ours = dijkstra(graph, points[0], target);
            const theirs = pageDijkstra(graph, points[0], target);
            if (ours.path === null) {
                expect(theirs).toBeNull();
            } else {
                expect(theirs.weight).toBe(ours.distance);
                expect(weightOf(graph, theirs.path)).toBe(ours.distance);
            }
        }
    });

    it("topological sort finds a cycle exactly when this library does, or a valid order", () => {
        const pageSort = example("topological-sort", "topologicalSort");
        for (const { seed } of runs) {
            const graph = randomGraph(seed, true);
            const order: string[] | null = pageSort(graph);
            const ours = topologicalSort(graph);
            expect(order === null).toBe(ours.order === null);
            if (order) {
                expect([...order].sort()).toEqual(graph.getPoints().sort());
                expect(graph.getEdges().every(({ from, to }) => order.indexOf(from) < order.indexOf(to))).toBe(true);
            }
        }
    });
});
