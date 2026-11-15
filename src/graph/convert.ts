// Converts a graph into another representation: the new graph gets the same points, in the same order,
// and the same edges with the same weights.
//
// It only uses the Graph interface, so it works between any two representations:
//     const matrix = convert(list, new AdjacencyMatrix(list.directed));
//
// Cost: reading every edge of the source (all size × size cells of an adjacency matrix,
// every entry of an adjacency list, all points × edges cells of an incidence matrix)
// plus writing each edge into the target.

import Graph from "./interfaces/graph";
import { GraphError } from "./validation";

export function convert<T extends Graph>(source: Graph, target: T): T {
    if (source.directed !== target.directed) {
        throw new GraphError("Convert between two directed or two undirected graphs");
    }
    target.addPoints(source.getPoints());
    source.getEdges().forEach(({ from, to, weight }) => target.addEdge(from, to, weight));
    return target;
}
