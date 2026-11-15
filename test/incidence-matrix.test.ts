import { describe, expect, it } from "vitest";
import IncidenceMatrix from "../src/graph/incidence-matrix";

describe("IncidenceMatrix", () => {
    it("adds a column per edge with the weight in both endpoint rows", () => {
        const graph = new IncidenceMatrix().addEdge("A", "B", 2).addEdge("B", "C");
        expect(graph.graph).toEqual([
            [2, 0],
            [2, 1],
            [0, 1],
        ]);
        expect(graph.edges).toEqual([{ from: "A", to: "B" }, { from: "B", to: "C" }]);
    });

    it("marks a directed edge with -weight where it leaves and +weight where it enters", () => {
        const graph = new IncidenceMatrix(true).addEdge("A", "B", 3);
        expect(graph.graph).toEqual([[-3], [3]]);
        expect(graph.getNeighbors("A")).toEqual([{ name: "B", weight: 3 }]);
        expect(graph.getNeighbors("B")).toEqual([]);
    });

    it("updates the weight when an edge is added again instead of adding a column", () => {
        const graph = new IncidenceMatrix().addEdge("A", "B", 2).addEdge("B", "A", 5);
        expect(graph.graph).toEqual([[5], [5]]);
    });

    it("keeps A→B and B→A as separate columns in a directed graph", () => {
        const graph = new IncidenceMatrix(true).addEdge("A", "B").addEdge("B", "A");
        expect(graph.graph).toEqual([
            [-1, 1],
            [1, -1],
        ]);
    });

    it("removes an edge's column", () => {
        const graph = new IncidenceMatrix().addEdge("A", "B").addEdge("B", "C", 2);
        graph.removeEdge("B", "A");
        expect(graph.graph).toEqual([[0], [2], [2]]);
        expect(graph.edges).toEqual([{ from: "B", to: "C" }]);
    });

    it("removes a point's row and edges and renumbers the remaining points", () => {
        const graph = new IncidenceMatrix().addEdge("A", "B").addEdge("B", "C", 2).addEdge("C", "A", 3);
        graph.removePoint("A");
        expect(graph.getPoints()).toEqual(["B", "C"]);
        expect(graph.getPoint("C").getIndex()).toBe(1);
        expect(graph.graph).toEqual([[2], [2]]);
        expect(graph.edges).toEqual([{ from: "B", to: "C" }]);
        expect(graph.print()).toBe("B 2\nC 2\n");
    });

    it("finds neighbors by scanning edge columns", () => {
        const graph = new IncidenceMatrix().addEdge("B", "A").addEdge("A", "C", 4);
        expect(graph.getNeighbors("A")).toEqual([{ name: "B", weight: 1 }, { name: "C", weight: 4 }]);
    });

    it("prints wide and negative values aligned", () => {
        expect(new IncidenceMatrix(true).addEdge("A", "BB", 10).addEdge("BB", "A").print()).toBe(
            " A -10  1\n" +
            "BB  10 -1\n"
        );
    });

    it("throws for missing points and edges", () => {
        const graph = new IncidenceMatrix().addEdge("A", "B").addPoint("C");
        expect(() => graph.removePoint("Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "C")).toThrow(/Edge A–C does not exist/);
    });
});
