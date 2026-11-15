// depth first search
// https://en.wikipedia.org/wiki/Depth-first_search
//
// Starting from one point, follow an edge to an unvisited neighbor and keep going deeper.
// When a point has no unvisited neighbors left, go back to the point it was reached from
// and try that point's next neighbor.
//
// The search keeps its own stack of the points it is inside, instead of calling itself for every
// point: a function that calls itself 100,000 levels deep runs out of call stack and crashes.
// The "Stack" list in the trace is that stack. When a target is found, it holds the path
// from the start to the target.

import Graph from "../graph/interfaces/graph";
import Neighbor from "../graph/interfaces/neighbor";
import { missingPoint } from "../graph/validation";
import { nameList, Trace, Tracer } from "./trace";

export interface DfsResult {
    // points in the order they were visited
    readonly order: string[];
    // start → target, when a target was given and found
    readonly path: string[] | null;
    readonly steps: Trace;
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
    const visited = new Set<string>();
    const cameFrom = new Map<string, string>();
    // the points the search is inside, with the neighbors each one still has to check
    const stack: { name: string; neighbors: Neighbor[]; next: number }[] = [];

    tracer.list("Stack").list("Visited");
    tracer.step(target === undefined
        ? `Start depth-first search at ${start}.`
        : `Start depth-first search at ${start}, looking for ${target}.`, {}, "start");

    // returns true when the point is the target
    const visit = (name: string): boolean => {
        const previous = stack[stack.length - 1];
        if (previous !== undefined) {
            tracer.markPoint(previous.name, "active");
        }
        visited.add(name);
        order.push(name);
        tracer.markPoint(name, "current").label(name, String(order.length)).add("Stack", name).add("Visited", name);

        if (name === target) {
            stack.push({ name, neighbors: [], next: 0 });
            tracer.step(`Visit ${name}. It is the target.`, { point: name }, "target");
            return true;
        }
        tracer.step(`Visit ${name} and read its neighbors.`, { point: name }, "visit");
        stack.push({ name, neighbors: graph.getNeighbors(name), next: 0 });
        return false;
    };

    let found = visit(start);
    while (!found && stack.length > 0) {
        const current = stack[stack.length - 1];
        const { name } = current;

        if (current.next < current.neighbors.length) {
            const next = current.neighbors[current.next++].name;
            const focus = { point: name, edge: { from: name, to: next } };
            const edge = `${name}${arrow}${next}`;

            if (!graph.directed && cameFrom.get(name) === next) {
                tracer.step(`Edge ${edge} leads back to ${next}, where ${name} was reached from. Skip it.`, focus, "skip");
            } else if (visited.has(next)) {
                tracer.markEdge(name, next, "skipped").step(`Edge ${edge}: ${next} is already visited. Skip it.`, focus, "skip");
            } else {
                cameFrom.set(next, name);
                tracer.markEdge(name, next, "tree").step(`Edge ${edge}: ${next} is not visited yet. Go deeper, to ${next}.`, focus, "deeper");
                found = visit(next);
            }
            continue;
        }

        // every neighbor is checked: the point is done, go back to the point below it
        stack.pop();
        const back = stack[stack.length - 1]?.name;
        tracer.markPoint(name, "done").removeNewest("Stack");
        if (back === undefined) {
            tracer.step(`All neighbors of ${name} are checked. ${name} is done.`, { point: name }, "back");
        } else {
            tracer.markPoint(back, "current").step(`All neighbors of ${name} are checked. ${name} is done, go back to ${back}.`, { point: name }, "back");
        }
    }

    // when the target is found, the stack still holds the path to it
    const path = found ? stack.map(entry => entry.name) : null;

    if (target !== undefined) {
        if (path) {
            path.forEach((name, i) => {
                tracer.markPoint(name, "result");
                if (i > 0) {
                    tracer.markEdge(path[i - 1], name, "result");
                }
            });
            tracer.step(`Found ${target}. The stack is the path: ${nameList(path, " → ")}.`);
        } else {
            tracer.step(`Every point reachable from ${start} is visited. ${target} cannot be reached from ${start}.`);
        }
    } else {
        const unreached = graph.getPoints().filter(name => !visited.has(name));
        tracer.step(`Done. Visiting order: ${nameList(order)}.` +
            (unreached.length ? ` Not reachable from ${start}: ${nameList(unreached)}.` : ""));
    }

    return { order, path, steps: tracer.trace() };
};

export {
    dfs
};
