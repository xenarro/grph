import { describe, expect, it } from "vitest";
import { topologicalSort } from "../src/algorithms/topological-sort";
import AdjacencyList from "../src/graph/adjacency-list";
import { generate } from "../ui/src/generate";
import { GraphModel } from "../ui/src/model";

describe("generate", () => {
    it("makes the same graph from the same recipe", () => {
        const recipe = { points: 500, seed: 42, directed: false };
        expect(generate(recipe)).toEqual(generate(recipe));
        expect(generate({ ...recipe, seed: 43 })).not.toEqual(generate(recipe));
    });

    it("makes the asked number of points, with unique names, at drawable positions", () => {
        const data = generate({ points: 1234, seed: 1, directed: false });
        expect(data.points.length).toBe(1234);
        expect(new Set(data.points.map(p => p.name)).size).toBe(1234);
        expect(data.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
        // about one and a half edges per point, each between two different points, none twice
        expect(data.edges.length).toBeGreaterThan(1234 * 1.2);
        expect(data.edges.length).toBeLessThan(1234 * 1.8);
        expect(new Set(data.edges.map(e => `${e.from}-${e.to}`)).size).toBe(data.edges.length);
        expect(data.edges.every(e => e.from !== e.to)).toBe(true);
    });

    it("makes a directed graph without cycles", () => {
        const data = generate({ points: 2000, seed: 7, directed: true });
        const graph = new AdjacencyList(true);
        data.points.forEach(p => graph.addPoint(p.name));
        data.edges.forEach(e => graph.addEdge(e.from, e.to, e.weight));
        expect(topologicalSort(graph).order).toHaveLength(2000);
    });

    it("loads 100,000 points into the model", () => {
        const model = new GraphModel();
        model.load(generate({ points: 100_000, seed: 3, directed: false }));
        expect(model.pointCount()).toBe(100_000);
        expect(model.matrix).toBeNull();
        expect(model.incidence).toBeNull();
    });
});
