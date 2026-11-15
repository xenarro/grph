// topological sort
// https://en.wikipedia.org/wiki/Topological_sorting
// https://www.codewars.com/kata/55f10facf351f5e236000014
//
// Orders the points of a directed graph so that every edge goes from an earlier point to a
// later one, for example tasks ordered so that each task comes after the tasks it depends on.
// Such an order exists only when the graph has no cycles.
//
// Depth-first version: run a depth-first search from every point that is not visited yet.
// A point is finished only after everything reachable from it is finished, so putting each
// finished point at the front of the order gives a valid order. Reaching a point that is
// still on the stack means the edge goes back into the current path: the graph has a cycle.
//
// Like dfs.ts, the search keeps its own stack instead of calling itself for every point,
// so it works on graphs far deeper than the call stack.

import Graph from "../graph/interfaces/graph";
import Neighbor from "../graph/interfaces/neighbor";
import { GraphError } from "../graph/validation";
import { nameList, Trace, Tracer } from "./trace";

export interface TopologicalSortResult {
    // null when the graph has a cycle
    readonly order: string[] | null;
    // the first cycle found, starting and ending with the same point, for example [A, B, C, A]
    readonly cycle: string[] | null;
    readonly steps: Trace;
}

const topologicalSort = (graph: Graph): TopologicalSortResult => {
    if (!graph.directed) {
        throw new GraphError("Topological sort needs a directed graph");
    }

    const tracer = new Tracer(true);
    // finished points, the last finished first in the order: kept in finishing order and turned
    // around at the end, because adding to the front of an array moves every item each time
    const finishedOrder: string[] = [];
    const finished = new Set<string>();
    // the points the search is inside, with the neighbors each one still has to check
    const stack: { name: string; neighbors: Neighbor[]; next: number }[] = [];
    const onStack = new Set<string>();

    tracer.list("Stack").list("Order", { newestFirst: true });
    tracer.step("Start topological sort: run a depth-first search from every point that is not visited yet.", {}, "root");

    const visit = (name: string): void => {
        const previous = stack[stack.length - 1];
        if (previous !== undefined) {
            tracer.markPoint(previous.name, "active");
        }
        stack.push({ name, neighbors: graph.getNeighbors(name), next: 0 });
        onStack.add(name);
        tracer.markPoint(name, "current").add("Stack", name);
        tracer.step(() => `Visit ${name} and read its neighbors.`, { point: name }, "visit");
    };

    // runs a search from one point; returns the cycle when one is found
    const search = (start: string): string[] | null => {
        visit(start);
        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const { name } = current;

            if (current.next < current.neighbors.length) {
                const next = current.neighbors[current.next++].name;
                const focus = { point: name, edge: { from: name, to: next } };
                const edge = () => `${name}→${next}`;

                if (onStack.has(next)) {
                    tracer.markEdge(name, next, "error").step(() => `Edge ${edge()}: ${next} is still on the stack, so this edge closes a cycle.`, focus, "cycle");
                    const names = stack.map(entry => entry.name);
                    return [...names.slice(names.indexOf(next)), next];
                }
                if (finished.has(next)) {
                    tracer.markEdge(name, next, "skipped").step(() => `Edge ${edge()}: ${next} is already in the order. Skip it.`, focus, "skip");
                    continue;
                }
                tracer.markEdge(name, next, "tree").step(() => `Edge ${edge()}: ${next} is not visited yet. Go deeper, to ${next}.`, focus, "deeper");
                visit(next);
                continue;
            }

            // everything reachable from the point is finished: it goes to the front of the order
            stack.pop();
            onStack.delete(name);
            finished.add(name);
            finishedOrder.push(name);
            tracer.markPoint(name, "done").removeNewest("Stack").add("Order", name);
            const back = stack[stack.length - 1];
            if (back !== undefined) {
                tracer.markPoint(back.name, "current");
            }
            tracer.step(() => `Everything reachable from ${name} is already in the order, so ${name} goes to the front.`, { point: name }, "finish");
        }
        return null;
    };

    for (const name of graph.getPoints()) {
        if (finished.has(name)) {
            continue;
        }
        tracer.step(() => `${name} is not visited yet. Start a depth-first search from ${name}.`, { point: name }, "root");

        const cycle = search(name);
        if (cycle) {
            cycle.forEach((point, i) => {
                tracer.markPoint(point, "error");
                if (i > 0) {
                    tracer.markEdge(cycle[i - 1], point, "error");
                }
            });
            tracer.step(`The graph has a cycle: ${nameList(cycle, " → ")}. A topological order does not exist.`, {}, "cycle");
            return { order: null, cycle, steps: tracer.trace() };
        }
    }

    const order = finishedOrder.reverse();
    order.forEach((name, i) => tracer.label(name, String(i + 1)));
    tracer.step(`Done. Topological order: ${nameList(order)}. Every edge goes from an earlier point to a later one.`);
    return { order, cycle: null, steps: tracer.trace() };
};

export {
    topologicalSort
};
