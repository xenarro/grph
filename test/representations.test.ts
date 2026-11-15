// All the representations must always describe the same graph.
// Random sequences of operations are applied to all of them and the results compared.

import { describe, expect, it } from "vitest";
import AdjacencyMatrix from "../src/graph/adjacency-matrix";
import AdjacencyList from "../src/graph/adjacency-list";
import CompactAdjacencyList from "../src/graph/compact-adjacency-list";
import IncidenceMatrix from "../src/graph/incidence-matrix";
import Graph from "../src/graph/interfaces/graph";

const createAll = (directed: boolean): Graph[] => [
    new AdjacencyMatrix(directed),
    new AdjacencyList(directed),
    new CompactAdjacencyList(directed),
    new IncidenceMatrix(directed),
];

// small deterministic pseudo-random generator so failures can be reproduced
function random(seed: number) {
    return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
}

const normalizedEdges = (graph: Graph) =>
    graph.getEdges()
        .map(({ from, to, weight }) => {
            const [x, y] = graph.directed || from < to ? [from, to] : [to, from];
            return `${x}>${y}:${weight}`;
        })
        .sort();

const normalizedNeighbors = (graph: Graph) =>
    graph.getPoints().map(name =>
        graph.getNeighbors(name).map(n => `${n.name}:${n.weight}`).sort().join(",")
    );

describe.each([false, true])("all representations agree (directed: %s)", directed => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8])("random operations, seed %i", seed => {
        const next = random(seed);
        const names = ["A", "B", "C", "D", "E", "F"];
        const pick = () => names[Math.floor(next() * names.length)];
        const graphs = createAll(directed);

        for (let step = 0; step < 200; step++) {
            const roll = next();
            const x = pick();
            const y = pick();

            if (roll < 0.5) {
                if (x === y) continue;
                const weight = 1 + Math.floor(next() * 9);
                graphs.forEach(g => g.addEdge(x, y, weight));
            } else if (roll < 0.7) {
                if (!graphs[0].hasEdge(x, y)) continue;
                graphs.forEach(g => g.removeEdge(x, y));
            } else if (roll < 0.8) {
                if (!graphs[0].hasPoint(x)) continue;
                graphs.forEach(g => g.removePoint(x));
            } else {
                graphs.forEach(g => g.addPoint(x));
            }

            const [first, ...rest] = graphs;
            for (const graph of rest) {
                expect(graph.getPoints()).toEqual(first.getPoints());
                expect(normalizedEdges(graph)).toEqual(normalizedEdges(first));
                expect(normalizedNeighbors(graph)).toEqual(normalizedNeighbors(first));
                for (const a of names) {
                    for (const b of names) {
                        expect(graph.hasEdge(a, b)).toBe(first.hasEdge(a, b));
                    }
                }
            }
        }
    });
});
