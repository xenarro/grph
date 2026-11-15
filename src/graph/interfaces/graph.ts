// https://www.geeksforgeeks.org/graph-and-its-representations/
// https://en.wikipedia.org/wiki/Graph_theory#Applications

import Edge from "./edge";
import Neighbor from "./neighbor";

// A graph made of named points and weighted edges, directed or undirected.
// Every representation (adjacency matrix, adjacency list, incidence matrix) follows the same rules:
// - there is at most one edge between two points (one per direction in a directed graph);
//   adding an edge that already exists replaces its weight;
// - there are no self-loops and weights are positive (see validation.ts);
// - addEdge creates missing points; other methods throw a GraphError for missing points or edges;
// - points are kept in the order they were added.
export default interface Graph {
    readonly directed: boolean;

    addPoint(name: string): this;
    removePoint(name: string): this;
    hasPoint(name: string): boolean;
    getPoints(): string[];

    addEdge(nameX: string, nameY: string, weight?: number): this;
    removeEdge(nameX: string, nameY: string): this;
    hasEdge(nameX: string, nameY: string): boolean;
    // every edge once, also in an undirected graph
    getEdges(): Edge[];

    // the points reachable by one edge, in the order the representation stores them;
    // in a directed graph only the edges leaving the point count
    getNeighbors(name: string): Neighbor[];

    print(): string;
}
