import { describe, expect, it } from "vitest";
import { algorithms, getAlgorithm } from "../src/algorithms";
import AdjacencyList from "../src/graph/adjacency-list";

describe("algorithm registry", () => {
    it("runs every algorithm through the common interface", () => {
        const graph = new AdjacencyList(true).addEdge("A", "B").addEdge("B", "C");
        for (const algorithm of algorithms) {
            const steps = algorithm.run(graph, { start: "A" });
            expect(steps.length).toBeGreaterThan(0);
        }
    });

    it("asks for a start point when an algorithm needs one", () => {
        expect(() => getAlgorithm("dfs").run(new AdjacencyList().addPoint("A"), {})).toThrow(/Choose a start point/);
    });

    it("throws for an unknown algorithm", () => {
        expect(() => getAlgorithm("nope")).toThrow(/Unknown algorithm/);
    });
});
