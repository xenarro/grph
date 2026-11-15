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

import Graph from "../graph/interfaces/graph";
import { GraphError } from "../graph/validation";
import { Step, Tracer } from "./trace";

export interface TopologicalSortResult {
    // null when the graph has a cycle
    readonly order: string[] | null;
    // the first cycle found, starting and ending with the same point, for example [A, B, C, A]
    readonly cycle: string[] | null;
    readonly steps: Step[];
}

const topologicalSort = (graph: Graph): TopologicalSortResult => {
    if (!graph.directed) {
        throw new GraphError("Topological sort needs a directed graph");
    }

    const tracer = new Tracer(true);
    const order: string[] = [];
    const stack: string[] = [];
    const finished = new Set<string>();

    tracer.list("Stack", stack).list("Order", order);
    tracer.step("Start topological sort: run a depth-first search from every point that is not visited yet.");

    // returns the cycle when one is found
    const visit = (name: string): string[] | null => {
        const previous = stack[stack.length - 1];
        if (previous !== undefined) {
            tracer.markPoint(previous, "active");
        }
        stack.push(name);
        tracer.markPoint(name, "current").list("Stack", stack);
        tracer.step(`Visit ${name} and read its neighbors.`, { point: name });

        for (const { name: next } of graph.getNeighbors(name)) {
            const focus = { point: name, edge: { from: name, to: next } };
            const edge = `${name}→${next}`;

            if (stack.includes(next)) {
                tracer.markEdge(name, next, "error").step(`Edge ${edge}: ${next} is still on the stack, so this edge closes a cycle.`, focus);
                return [...stack.slice(stack.indexOf(next)), next];
            }
            if (finished.has(next)) {
                tracer.markEdge(name, next, "skipped").step(`Edge ${edge}: ${next} is already in the order. Skip it.`, focus);
                continue;
            }

            tracer.markEdge(name, next, "tree").step(`Edge ${edge}: ${next} is not visited yet. Go deeper, to ${next}.`, focus);
            const cycle = visit(next);
            if (cycle) {
                return cycle;
            }
        }

        stack.pop();
        finished.add(name);
        order.unshift(name);
        tracer.markPoint(name, "done").list("Stack", stack).list("Order", order);
        const back = stack[stack.length - 1];
        if (back !== undefined) {
            tracer.markPoint(back, "current");
        }
        tracer.step(`Everything reachable from ${name} is already in the order, so ${name} goes to the front.`, { point: name });
        return null;
    };

    for (const name of graph.getPoints()) {
        if (finished.has(name)) {
            continue;
        }
        tracer.step(`${name} is not visited yet. Start a depth-first search from ${name}.`, { point: name });

        const cycle = visit(name);
        if (cycle) {
            cycle.forEach((point, i) => {
                tracer.markPoint(point, "error");
                if (i > 0) {
                    tracer.markEdge(cycle[i - 1], point, "error");
                }
            });
            tracer.step(`The graph has a cycle: ${cycle.join(" → ")}. A topological order does not exist.`);
            return { order: null, cycle, steps: tracer.steps };
        }
    }

    order.forEach((name, i) => tracer.label(name, String(i + 1)));
    tracer.step(`Done. Topological order: ${order.join(", ")}. Every edge goes from an earlier point to a later one.`);
    return { order, cycle: null, steps: tracer.steps };
};

export {
    topologicalSort
};
