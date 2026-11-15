import { describe, expect, it } from "vitest";
import { topologicalSort } from "../src/algorithms/topological-sort";
import { edgeKey } from "../src/algorithms/trace";
import AdjacencyMatrix from "../src/graph/adjacency-matrix";
import AdjacencyList from "../src/graph/adjacency-list";
import CompactAdjacencyList from "../src/graph/compact-adjacency-list";
import IncidenceMatrix from "../src/graph/incidence-matrix";
import Graph from "../src/graph/interfaces/graph";

const representations = [
    ["AdjacencyMatrix", (directed: boolean): Graph => new AdjacencyMatrix(directed)],
    ["AdjacencyList", (directed: boolean): Graph => new AdjacencyList(directed)],
    ["CompactAdjacencyList", (directed: boolean): Graph => new CompactAdjacencyList(directed)],
    ["IncidenceMatrix", (directed: boolean): Graph => new IncidenceMatrix(directed)],
] as const;

const isTopologicalOrder = (graph: Graph, order: string[]) =>
    order.length === graph.getPoints().length &&
    graph.getEdges().every(({ from, to }) => order.indexOf(from) < order.indexOf(to));

describe.each(representations)("topologicalSort on %s", (_, create) => {
    it("orders a directed acyclic graph", () => {
        const graph = create(true).addEdge("A", "B").addEdge("A", "C").addEdge("B", "D").addEdge("C", "D").addPoint("E");
        const { order, cycle, steps } = topologicalSort(graph);

        expect(order).toEqual(["E", "A", "C", "B", "D"]);
        expect(isTopologicalOrder(graph, order!)).toBe(true);
        expect(cycle).toBeNull();

        const last = steps.at(-1);
        expect(last.message).toBe("Done. Topological order: E, A, C, B, D. Every edge goes from an earlier point to a later one.");
        expect(Object.fromEntries(last.labels)).toEqual({ E: "1", A: "2", C: "3", B: "4", D: "5" });
        expect(last.lists.map(({ name, items }) => ({ name, items }))).toEqual([
            { name: "Stack", items: [] },
            { name: "Order", items: ["E", "A", "C", "B", "D"] },
        ]);
        expect(last.edges.get(edgeKey("C", "D", true))).toBe("skipped");
    });

    it("finds a cycle", () => {
        const graph = create(true).addEdge("A", "B").addEdge("B", "C").addEdge("C", "D").addEdge("C", "A");
        const { order, cycle, steps } = topologicalSort(graph);

        expect(order).toBeNull();
        expect(cycle).toEqual(["A", "B", "C", "A"]);

        const last = steps.at(-1);
        expect(last.message).toBe("The graph has a cycle: A → B → C → A. A topological order does not exist.");
        expect(last.edges.get(edgeKey("C", "A", true))).toBe("error");
        expect(Object.fromEntries(last.points)).toMatchObject({ A: "error", B: "error", C: "error" });
    });

    it("needs a directed graph", () => {
        expect(() => topologicalSort(create(false).addEdge("A", "B"))).toThrow(/needs a directed graph/);
    });
});

it("handles an empty graph", () => {
    expect(topologicalSort(new AdjacencyList(true)).order).toEqual([]);
});
