// breadth first search
// https://en.wikipedia.org/wiki/Breadth-first_search
//
// Visits the points in rings around the start: first its neighbors, then their neighbors, and so on.
// The queue holds the points that are reached but not visited yet, in the order they were reached:
// a new point joins at the back, the next point to visit leaves from the front. So every point is
// reached by a path with the fewest edges, and with a target that path is returned.
//
// Weights are ignored. The path with the fewest edges is not always the one with the smallest
// total weight: Dijkstra's algorithm (dijkstra.ts) finds that one.

import Graph from "../graph/interfaces/graph";
import { missingPoint } from "../graph/validation";
import { nameList, Trace, Tracer } from "./trace";

export interface BfsResult {
    // points in the order they were visited
    readonly order: string[];
    // how many edges away from the start each reached point is
    readonly distances: Map<string, number>;
    // start → target with the fewest edges, when a target was given and can be reached
    readonly path: string[] | null;
    readonly steps: Trace;
}

const bfs = (graph: Graph, start: string, target?: string): BfsResult => {
    if (!graph.hasPoint(start)) {
        throw missingPoint(start);
    }
    if (target !== undefined && !graph.hasPoint(target)) {
        throw missingPoint(target);
    }

    const arrow = graph.directed ? "→" : "–";
    const tracer = new Tracer(graph.directed);
    const order: string[] = [];
    const distances = new Map<string, number>();
    const cameFrom = new Map<string, string>();
    // the queue is an array read from `front`: taking the first item with shift() would move all the others
    const queue: string[] = [];
    let front = 0;
    const edges = (count: number) => count === 1 ? "1 edge" : `${count} edges`;

    tracer.list("Queue", { keep: "front" }).list("Visited");
    distances.set(start, 0);
    queue.push(start);
    tracer.markPoint(start, "active").label(start, "0").add("Queue", start);
    tracer.step(target === undefined
        ? `Start breadth-first search at ${start}, 0 edges away from itself. Put it in the queue.`
        : `Start breadth-first search at ${start}, looking for the path with the fewest edges to ${target}. Put ${start} in the queue.`,
    { point: start }, "start");

    let found = start === target;
    while (!found && front < queue.length) {
        const name = queue[front++];
        const distance = distances.get(name)!;
        order.push(name);
        tracer.removeAt("Queue", 0).add("Visited", name).markPoint(name, "current");
        tracer.step(() => `Take ${name} from the front of the queue. It is ${edges(distance)} from ${start}; read its neighbors.`, { point: name }, "take");

        for (const { name: next } of graph.getNeighbors(name)) {
            const focus = { point: name, edge: { from: name, to: next } };
            const edge = () => `${name}${arrow}${next}`;

            if (distances.has(next)) {
                if (!graph.directed && cameFrom.get(name) === next) {
                    tracer.step(() => `Edge ${edge()} leads back to ${next}, where ${name} was reached from. Skip it.`, focus, "skip");
                } else {
                    if (tracer.edgeMark(name, next) === undefined) {
                        tracer.markEdge(name, next, "skipped");
                    }
                    tracer.step(() => `Edge ${edge()}: ${next} is already reached. Skip it.`, focus, "skip");
                }
                continue;
            }

            distances.set(next, distance + 1);
            cameFrom.set(next, name);
            queue.push(next);
            tracer.markEdge(name, next, "tree").markPoint(next, "active").label(next, String(distance + 1)).add("Queue", next);
            if (next === target) {
                tracer.step(() => `Edge ${edge()}: ${next} is new, and it is the target, ${edges(distance + 1)} from ${start}.`, focus, "target");
                found = true;
                break;
            }
            tracer.step(() => `Edge ${edge()}: ${next} is new, ${edges(distance + 1)} from ${start}. Put it at the back of the queue.`, focus, "reach");
        }
        if (!found) {
            // every neighbor is checked: the point is done, which shows from the next step on
            tracer.markPoint(name, "done");
        }
    }

    let path: string[] | null = null;
    if (target !== undefined && found) {
        path = [target];
        while (path[path.length - 1] !== start) {
            path.push(cameFrom.get(path[path.length - 1])!);
        }
        path.reverse();
        path.forEach((name, i) => {
            tracer.markPoint(name, "result");
            if (i > 0) {
                tracer.markEdge(path![i - 1], name, "result");
            }
        });
        tracer.step(`Found ${target}: ${nameList(path, " → ")}, ${edges(path.length - 1)}. ` +
            "It has the fewest edges; the smallest total weight is what Dijkstra's algorithm finds.", {}, "path");
    } else if (target !== undefined) {
        tracer.step(`The queue is empty: every point reachable from ${start} is visited, and ${target} is not one of them.`);
    } else {
        const unreached = graph.getPoints().filter(name => !distances.has(name));
        tracer.step(`Done. Visiting order: ${nameList(order)}.` +
            (unreached.length ? ` Not reachable from ${start}: ${nameList(unreached)}.` : ""));
    }

    return { order, distances, path, steps: tracer.trace() };
};

export {
    bfs
};
