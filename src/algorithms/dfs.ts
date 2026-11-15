// depth first search
// https://en.wikipedia.org/wiki/Depth-first_search
//
// Starting from one point, follow an edge to an unvisited neighbor and keep going deeper.
// When a point has no unvisited neighbors left, go back to the point it was reached from
// and try that point's next neighbor.
//
// This version is recursive: the "Stack" list in the trace is the call stack. When a target
// is found, the stack holds the path from the start to the target.

import Graph from "../graph/interfaces/graph";
import { missingPoint } from "../graph/validation";
import { Step, Tracer } from "./trace";

export interface DfsResult {
    // points in the order they were visited
    readonly order: string[];
    // start → target, when a target was given and found
    readonly path: string[] | null;
    readonly steps: Step[];
}

const dfs = (graph: Graph, start: string, target?: string): DfsResult => {
    if (!graph.hasPoint(start)) {
        throw missingPoint(start);
    }
    if (target !== undefined && !graph.hasPoint(target)) {
        throw missingPoint(target);
    }

    const arrow = graph.directed ? "→" : "–";
    const tracer = new Tracer(graph.directed);
    const order: string[] = [];
    const stack: string[] = [];
    const visited = new Set<string>();
    const cameFrom = new Map<string, string>();

    tracer.list("Stack", stack).list("Visited", order);
    tracer.step(target === undefined
        ? `Start depth-first search at ${start}.`
        : `Start depth-first search at ${start}, looking for ${target}.`);

    // returns true when the target is found
    const visit = (name: string): boolean => {
        const previous = stack[stack.length - 1];
        if (previous !== undefined) {
            tracer.markPoint(previous, "active");
        }
        visited.add(name);
        order.push(name);
        stack.push(name);
        tracer.markPoint(name, "current").label(name, String(order.length)).list("Stack", stack).list("Visited", order);

        if (name === target) {
            tracer.step(`Visit ${name}. It is the target.`, { point: name });
            return true;
        }
        tracer.step(`Visit ${name} and read its neighbors.`, { point: name });

        for (const { name: next } of graph.getNeighbors(name)) {
            const focus = { point: name, edge: { from: name, to: next } };
            const edge = `${name}${arrow}${next}`;

            if (!graph.directed && cameFrom.get(name) === next) {
                tracer.step(`Edge ${edge} leads back to ${next}, where ${name} was reached from. Skip it.`, focus);
                continue;
            }
            if (visited.has(next)) {
                tracer.markEdge(name, next, "skipped").step(`Edge ${edge}: ${next} is already visited. Skip it.`, focus);
                continue;
            }

            cameFrom.set(next, name);
            tracer.markEdge(name, next, "tree").step(`Edge ${edge}: ${next} is not visited yet. Go deeper, to ${next}.`, focus);
            if (visit(next)) {
                return true;
            }
        }

        stack.pop();
        const back = stack[stack.length - 1];
        tracer.markPoint(name, "done").list("Stack", stack);
        if (back === undefined) {
            tracer.step(`All neighbors of ${name} are checked. ${name} is done.`, { point: name });
        } else {
            tracer.markPoint(back, "current").step(`All neighbors of ${name} are checked. ${name} is done, go back to ${back}.`, { point: name });
        }
        return false;
    };

    // when the target is found, the stack still holds the path to it
    const path = visit(start) ? [...stack] : null;

    if (target !== undefined) {
        if (path) {
            path.forEach((name, i) => {
                tracer.markPoint(name, "result");
                if (i > 0) {
                    tracer.markEdge(path[i - 1], name, "result");
                }
            });
            tracer.step(`Found ${target}. The stack is the path: ${path.join(" → ")}.`);
        } else {
            tracer.step(`Every point reachable from ${start} is visited. ${target} cannot be reached from ${start}.`);
        }
    } else {
        const unreached = graph.getPoints().filter(name => !visited.has(name));
        tracer.step(`Done. Visiting order: ${order.join(", ")}.` +
            (unreached.length ? ` Not reachable from ${start}: ${unreached.join(", ")}.` : ""));
    }

    return { order, path, steps: tracer.steps };
};

export {
    dfs
};
