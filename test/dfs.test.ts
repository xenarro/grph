import { describe, expect, it } from "vitest";
import { dfs } from "../src/algorithms/dfs";
import { edgeKey } from "../src/algorithms/trace";
import AdjacencyMatrix from "../src/graph/adjacency-matrix";
import AdjacencyList from "../src/graph/adjacency-list";
import IncidenceMatrix from "../src/graph/incidence-matrix";
import Graph from "../src/graph/interfaces/graph";

const representations = [
    ["AdjacencyMatrix", (directed: boolean): Graph => new AdjacencyMatrix(directed)],
    ["AdjacencyList", (directed: boolean): Graph => new AdjacencyList(directed)],
    ["IncidenceMatrix", (directed: boolean): Graph => new IncidenceMatrix(directed)],
] as const;

// A - B
// |   |
// C - D    E
const square = (create: (directed: boolean) => Graph) =>
    create(false).addEdge("A", "B").addEdge("A", "C").addEdge("B", "D").addEdge("C", "D").addPoint("E");

describe.each(representations)("dfs on %s", (_, create) => {
    it("visits reachable points depth first", () => {
        const { order, path, steps } = dfs(square(create), "A");
        expect(order).toEqual(["A", "B", "D", "C"]);
        expect(path).toBeNull();
        expect(steps[steps.length - 1].message).toBe("Done. Visiting order: A, B, D, C. Not reachable from A: E.");
    });

    it("marks tree and skipped edges", () => {
        const { steps } = dfs(square(create), "A");
        const last = steps[steps.length - 1];
        expect(last.edges).toEqual({
            [edgeKey("A", "B", false)]: "tree",
            [edgeKey("B", "D", false)]: "tree",
            [edgeKey("D", "C", false)]: "tree",
            [edgeKey("A", "C", false)]: "skipped",
        });
        expect(last.points).toEqual({ A: "done", B: "done", C: "done", D: "done" });
        expect(last.labels).toEqual({ A: "1", B: "2", D: "3", C: "4" });
        expect(last.lists).toEqual([
            { name: "Stack", items: [] },
            { name: "Visited", items: ["A", "B", "D", "C"] },
        ]);
    });

    it("stops at the target and returns the path", () => {
        const { order, path, steps } = dfs(square(create), "A", "C");
        expect(order).toEqual(["A", "B", "D", "C"]);
        expect(path).toEqual(["A", "B", "D", "C"]);
        const last = steps[steps.length - 1];
        expect(last.message).toBe("Found C. The stack is the path: A → B → D → C.");
        expect(last.edges[edgeKey("D", "C", false)]).toBe("result");
        expect(last.points.A).toBe("result");
    });

    it("reports an unreachable target", () => {
        const { path, steps } = dfs(square(create), "A", "E");
        expect(path).toBeNull();
        expect(steps[steps.length - 1].message).toMatch(/E cannot be reached from A/);
    });

    it("follows edge directions", () => {
        const graph = create(true).addEdge("A", "B").addEdge("B", "C").addEdge("C", "A").addEdge("A", "D");
        expect(dfs(graph, "B").order).toEqual(["B", "C", "A", "D"]);
        expect(dfs(graph, "D").order).toEqual(["D"]);
    });

    it("throws for a missing start or target", () => {
        expect(() => dfs(square(create), "Z")).toThrow(/Point Z does not exist/);
        expect(() => dfs(square(create), "A", "Z")).toThrow(/Point Z does not exist/);
    });
});

describe("dfs neighbor order", () => {
    it("depends on how the representation stores neighbors", () => {
        const build = (graph: Graph) => graph.addPoint("A").addPoint("B").addPoint("C").addEdge("A", "C").addEdge("A", "B");
        // a matrix row is read in point order, a list in the order edges were added
        expect(dfs(build(new AdjacencyMatrix()), "A").order).toEqual(["A", "B", "C"]);
        expect(dfs(build(new AdjacencyList()), "A").order).toEqual(["A", "C", "B"]);
        expect(dfs(build(new IncidenceMatrix()), "A").order).toEqual(["A", "C", "B"]);
    });
});
