import { describe, expect, it } from "vitest";
import AdjacencyMatrix from "../src/graph/adjacency-matrix";

describe("AdjacencyMatrix", () => {
    it("grows the matrix when points are added, keeping existing edges in place", () => {
        const graph = new AdjacencyMatrix().addEdge("A", "B", 7).addPoint("C").addEdge("C", "A", 3);
        expect(graph.graph).toEqual([
            0, 7, 3,
            7, 0, 0,
            3, 0, 0,
        ]);
    });

    it("stores an undirected edge in both cells and a directed edge in one", () => {
        expect(new AdjacencyMatrix(false).addEdge("A", "B", 2).graph).toEqual([0, 2, 2, 0]);
        expect(new AdjacencyMatrix(true).addEdge("A", "B", 2).graph).toEqual([0, 2, 0, 0]);
    });

    it("removes a point's row and column and renumbers the remaining points", () => {
        const graph = new AdjacencyMatrix()
            .addEdge("A", "B", 1)
            .addEdge("B", "C", 2)
            .addEdge("C", "A", 3);

        graph.removePoint("A");

        expect(graph.getPoints()).toEqual(["B", "C"]);
        expect(graph.getPoint("B").getIndex()).toBe(0);
        expect(graph.getPoint("C").getIndex()).toBe(1);
        expect(graph.graph).toEqual([
            0, 2,
            2, 0,
        ]);

        // a point added afterwards gets a fresh index and an empty row
        graph.addEdge("D", "B", 4);
        expect(graph.getPoint("D").getIndex()).toBe(2);
        expect(graph.graph).toEqual([
            0, 2, 4,
            2, 0, 0,
            4, 0, 0,
        ]);
    });

    it("reads neighbors from the point's row in point order", () => {
        const graph = new AdjacencyMatrix(true).addPoint("A").addPoint("B").addPoint("C").addEdge("A", "C", 5).addEdge("A", "B");
        expect(graph.getNeighbors("A")).toEqual([{ name: "B", weight: 1 }, { name: "C", weight: 5 }]);
        expect(graph.getNeighbors("C")).toEqual([]);
    });

    it("reports each undirected edge once", () => {
        const graph = new AdjacencyMatrix().addEdge("A", "B").addEdge("B", "C", 2);
        expect(graph.getEdges()).toEqual([
            { from: "A", to: "B", weight: 1 },
            { from: "B", to: "C", weight: 2 },
        ]);
    });

    it("prints values wider than the point names", () => {
        expect(new AdjacencyMatrix().addEdge("A", "B", 10).print()).toBe(
            " A |  B | \n" +
            " 0 | 10 | A\n" +
            "10 |  0 | B\n"
        );
    });

    it("throws for missing points and edges", () => {
        const graph = new AdjacencyMatrix().addEdge("A", "B");
        expect(() => graph.removePoint("Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.removeEdge("A", "Z")).toThrow(/Point Z does not exist/);
        expect(() => graph.addPoint("C").removeEdge("A", "C")).toThrow(/Edge A–C does not exist/);
    });
});
