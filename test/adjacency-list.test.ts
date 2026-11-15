import { describe, expect, it } from "vitest";
import AdjacencyList from "../src/graph/adjacency-list";

describe("AdjacencyList", () => {
    it("stores an undirected edge in both lists and a directed edge in one", () => {
        const undirected = new AdjacencyList(false).addEdge("A", "B", 2);
        expect(undirected.getNeighbors("A")).toEqual([{ name: "B", weight: 2 }]);
        expect(undirected.getNeighbors("B")).toEqual([{ name: "A", weight: 2 }]);

        const directed = new AdjacencyList(true).addEdge("A", "B", 2);
        expect(directed.getNeighbors("A")).toEqual([{ name: "B", weight: 2 }]);
        expect(directed.getNeighbors("B")).toEqual([]);
    });

    it("updates the weight when an edge is added again instead of duplicating it", () => {
        const graph = new AdjacencyList().addEdge("A", "B", 2).addEdge("B", "A", 5);
        expect(graph.getNeighbors("A")).toEqual([{ name: "B", weight: 5 }]);
        expect(graph.getNeighbors("B")).toEqual([{ name: "A", weight: 5 }]);
    });

    it("removes every edge that leads to a removed point", () => {
        const graph = new AdjacencyList(true).addEdge("A", "B").addEdge("C", "B").addEdge("B", "C");
        graph.removePoint("B");
        expect(graph.getPoints()).toEqual(["A", "C"]);
        expect(graph.getNeighbors("A")).toEqual([]);
        expect(graph.getNeighbors("C")).toEqual([]);
    });

    it("keeps neighbors in insertion order", () => {
        const graph = new AdjacencyList().addPoint("A").addEdge("A", "C").addEdge("A", "B");
        expect(graph.getNeighbors("A").map(n => n.name)).toEqual(["C", "B"]);
    });

    it("reports each undirected edge once", () => {
        const graph = new AdjacencyList().addEdge("A", "B").addEdge("C", "B", 3);
        expect(graph.getEdges()).toEqual([
            { from: "A", to: "B", weight: 1 },
            { from: "B", to: "C", weight: 3 },
        ]);
    });

    it("prints weights that are not 1", () => {
        expect(new AdjacencyList().addEdge("A", "B").addEdge("A", "CC", 2).print()).toBe(
            " A: B -> CC(2)\n" +
            " B: A\n" +
            "CC: A(2)\n"
        );
    });

    it("throws for missing points and edges", () => {
        const graph = new AdjacencyList().addEdge("A", "B").addPoint("C");
        expect(() => graph.removePoint("Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "C")).toThrow(/Edge A–C does not exist/);
    });
});
