import { describe, expect, it } from "vitest";
import AdjacencyList from "../src/graph/adjacency-list";
import AdjacencyMatrix from "../src/graph/adjacency-matrix";
import IncidenceMatrix from "../src/graph/incidence-matrix";
import { convert } from "../src/graph/convert";
import Graph from "../src/graph/interfaces/graph";

const kinds = {
    "adjacency matrix": (directed: boolean) => new AdjacencyMatrix(directed),
    "adjacency list": (directed: boolean) => new AdjacencyList(directed),
    "incidence matrix": (directed: boolean) => new IncidenceMatrix(directed),
};
const pairs = Object.entries(kinds).flatMap(([from, makeFrom]) =>
    Object.entries(kinds).map(([to, makeTo]) => ({ from, to, makeFrom, makeTo })));

// an undirected edge C–A is the same edge as A–C
const sortedEdges = (graph: Graph) => graph.getEdges()
    .map(({ from, to, weight }) => {
        const [x, y] = graph.directed || from < to ? [from, to] : [to, from];
        return `${x}>${y}:${weight}`;
    })
    .sort();

describe.each([false, true])("convert (directed: %s)", directed => {
    it.each(pairs)("$from → $to keeps the points in order and every edge", ({ makeFrom, makeTo }) => {
        const source = makeFrom(directed)
            .addPoint("Z")
            .addEdge("A", "B", 2)
            .addEdge("B", "C", 3.5)
            .addEdge("C", "A")
            .addPoint("lonely");
        const target = convert(source, makeTo(directed));

        expect(target.getPoints()).toEqual(["Z", "A", "B", "C", "lonely"]);
        expect(sortedEdges(target)).toEqual(sortedEdges(source));
        source.getPoints().forEach(name =>
            expect(target.getNeighbors(name).length).toBe(source.getNeighbors(name).length));
    });

    it("refuses to mix directed and undirected graphs", () => {
        expect(() => convert(new AdjacencyList(directed), new AdjacencyMatrix(!directed))).toThrow(/directed/);
    });
});
