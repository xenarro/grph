// Every algorithm the visualizer can run.
// To add one: implement it with a Tracer next to dfs.ts and add an entry below.

import { GraphError } from "../graph/validation";
import { Algorithm, AlgorithmInput } from "./algorithm";
import { bfs } from "./bfs";
import { dfs } from "./dfs";
import { dijkstra } from "./dijkstra";
import { topologicalSort } from "./topological-sort";

const requireStart = (input: AlgorithmInput): string => {
    if (input.start === undefined) {
        throw new GraphError("Choose a start point");
    }
    return input.start;
};

export const algorithms: readonly Algorithm[] = [
    {
        id: "dfs",
        name: "Depth-first search",
        description: "Goes as deep as possible along each edge before going back. Give a target to search for a path to it.",
        start: "required",
        target: "optional",
        directedOnly: false,
        run: (graph, input) => dfs(graph, requireStart(input), input.target).steps,
    },
    {
        id: "bfs",
        name: "Breadth-first search",
        description: "Visits points in rings around the start, nearest first by number of edges. Give a target to find the path with the fewest edges to it; weights are ignored.",
        start: "required",
        target: "optional",
        directedOnly: false,
        run: (graph, input) => bfs(graph, requireStart(input), input.target).steps,
    },
    {
        id: "dijkstra",
        name: "Shortest path (Dijkstra)",
        description: "Finds the lightest path from the start to every point, taking the nearest unfinished point each time. Give a target to get the lightest path to it.",
        start: "required",
        target: "optional",
        directedOnly: false,
        run: (graph, input) => dijkstra(graph, requireStart(input), input.target).steps,
    },
    {
        id: "topological-sort",
        name: "Topological sort",
        description: "Orders the points so that every edge goes from an earlier point to a later one, or finds a cycle that makes this impossible.",
        start: "none",
        target: "none",
        directedOnly: true,
        run: graph => topologicalSort(graph).steps,
    },
];

export function getAlgorithm(id: string): Algorithm {
    const algorithm = algorithms.find(a => a.id === id);
    if (!algorithm) {
        throw new GraphError(`Unknown algorithm ${id}`);
    }
    return algorithm;
}

export type { Algorithm, AlgorithmInput } from "./algorithm";
export * from "./trace";
