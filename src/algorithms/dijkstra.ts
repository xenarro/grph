// Dijkstra's algorithm
// https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm
//
// Finds the path with the smallest total weight from the start to every point. It works because
// weights are positive (see validation.ts).
//
// Every reached point has a distance: the weight of the lightest path to it found so far. The queue
// holds the reached points that are not finished, nearest first. Each round takes the nearest one:
// every other path to it would go through a point at least as far away, so its distance is final.
// Then each of its edges is tried: if going through it makes a neighbor nearer, the neighbor gets
// the smaller distance and remembers which point it was reached from.
//
// The queue is a binary heap (priority-queue.ts), so taking the nearest point costs about
// log2(points) steps instead of a look at the whole queue. A point that gets nearer is added again
// with its new distance, and its old entry is skipped when it comes out. The trace shows the queue
// as a list sorted by distance.

import Graph from "../graph/interfaces/graph";
import { missingPoint } from "../graph/validation";
import { PriorityQueue } from "./priority-queue";
import { nameList, Trace, Tracer } from "./trace";

export interface DijkstraResult {
    // the shortest distance from the start to every point it can reach
    readonly distances: Map<string, number>;
    // the lightest path start → target, when a target was given and can be reached
    readonly path: string[] | null;
    // the total weight of that path
    readonly distance: number | null;
    readonly steps: Trace;
}

// A queue entry. `order` counts the entries made, so of two points at the same distance
// the one reached first comes out first, in the heap and in the list the trace shows alike.
interface Entry {
    readonly name: string;
    readonly distance: number;
    readonly order: number;
}

const before = (a: Entry, b: Entry) => a.distance < b.distance || (a.distance === b.distance && a.order < b.order);

const dijkstra = (graph: Graph, start: string, target?: string): DijkstraResult => {
    if (!graph.hasPoint(start)) {
        throw missingPoint(start);
    }
    if (target !== undefined && !graph.hasPoint(target)) {
        throw missingPoint(target);
    }

    const arrow = graph.directed ? "→" : "–";
    const tracer = new Tracer(graph.directed);
    const distances = new Map<string, number>();
    const cameFrom = new Map<string, string>();
    const finished = new Set<string>();
    const heap = new PriorityQueue<Entry>(before);

    // the queue as the trace shows it: each waiting point once, sorted like the heap
    const shown: Entry[] = [];
    const entries = new Map<string, Entry>();
    let made = 0;
    const position = (entry: Entry) => {
        let low = 0;
        let high = shown.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (before(shown[middle], entry)) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        return low;
    };
    // puts a point in the queue at its distance, or moves it there when it got nearer
    const enqueue = (name: string, distance: number) => {
        const old = entries.get(name);
        if (old) {
            const index = position(old);
            shown.splice(index, 1);
            tracer.removeAt("Queue", index);
        }
        const entry = { name, distance, order: made++ };
        const index = position(entry);
        shown.splice(index, 0, entry);
        entries.set(name, entry);
        heap.push(entry);
        tracer.insert("Queue", index, `${name}: ${format(distance)}`);
    };

    tracer.list("Queue").list("Finished");
    distances.set(start, 0);
    tracer.markPoint(start, "active").label(start, "0");
    enqueue(start, 0);
    tracer.step(target === undefined
        ? `Start Dijkstra's algorithm at ${start}, at distance 0. Every other point is at ∞ until a path to it is found.`
        : `Start Dijkstra's algorithm at ${start}, looking for the lightest path to ${target}. ${start} is at distance 0, every other point at ∞ until a path to it is found.`,
    { point: start });

    let previous: string | undefined;
    let found = false;
    while (heap.size > 0) {
        const entry = heap.pop()!;
        if (entries.get(entry.name) !== entry) {
            // an old entry of a point that got nearer since, or is finished
            continue;
        }
        const { name, distance } = entry;
        if (previous !== undefined) {
            tracer.markPoint(previous, "done");
        }
        shown.shift();
        entries.delete(name);
        finished.add(name);
        tracer.removeAt("Queue", 0).add("Finished", name).markPoint(name, "current");

        if (name === target) {
            tracer.step(`Take ${name}, the nearest point in the queue, at distance ${format(distance)}. It is the target, so this is the lightest path to it.`, { point: name });
            found = true;
            break;
        }
        tracer.step(`Take ${name}, the nearest point in the queue, at distance ${format(distance)}. No path to it can be lighter, so this distance is final. Try its edges.`, { point: name });

        for (const { name: next, weight } of graph.getNeighbors(name)) {
            const focus = { point: name, edge: { from: name, to: next } };
            const edge = `${name}${arrow}${next}`;

            if (finished.has(next)) {
                if (!graph.directed && cameFrom.get(name) === next) {
                    tracer.step(`Edge ${edge} leads back to ${next}, where ${name} was reached from. Skip it.`, focus);
                } else {
                    if (tracer.edgeMark(name, next) === undefined) {
                        tracer.markEdge(name, next, "skipped");
                    }
                    tracer.step(`Edge ${edge}: ${next} is already finished. Skip it.`, focus);
                }
                continue;
            }

            const through = distance + weight;
            const sum = `${format(distance)} + ${format(weight)} = ${format(through)}`;
            const known = distances.get(next);
            if (known === undefined || through < known) {
                const from = cameFrom.get(next);
                if (from !== undefined) {
                    // the old way to `next` is no longer the lightest
                    tracer.markEdge(from, next, "skipped");
                }
                distances.set(next, through);
                cameFrom.set(next, name);
                tracer.markEdge(name, next, "tree").markPoint(next, "active").label(next, format(through));
                enqueue(next, through);
                tracer.step(known === undefined
                    ? `Edge ${edge}, weight ${format(weight)}: ${next} is reached for the first time, at ${sum}. Put it in the queue.`
                    : `Edge ${edge}, weight ${format(weight)}: through ${name}, ${next} is nearer: ${sum} instead of ${format(known)}. Move it up the queue.`,
                focus);
            } else {
                if (tracer.edgeMark(name, next) === undefined) {
                    tracer.markEdge(name, next, "skipped");
                }
                tracer.step(`Edge ${edge}, weight ${format(weight)}: ${sum} is not less than ${next}'s distance ${format(known)}. Keep ${next} as it is.`, focus);
            }
        }
        previous = name;
    }

    const final = new Map([...finished].map(name => [name, distances.get(name)!]));
    if (target !== undefined && found) {
        const path = [target];
        while (path[path.length - 1] !== start) {
            path.push(cameFrom.get(path[path.length - 1])!);
        }
        path.reverse();
        path.forEach((name, i) => {
            tracer.markPoint(name, "result");
            if (i > 0) {
                tracer.markEdge(path[i - 1], name, "result");
            }
        });
        const distance = distances.get(target)!;
        tracer.step(`The lightest path from ${start} to ${target}: ${nameList(path, " → ")}, total weight ${format(distance)}.`);
        return { distances: final, path, distance, steps: tracer.trace() };
    }

    if (previous !== undefined) {
        tracer.markPoint(previous, "done");
    }
    if (target !== undefined) {
        tracer.step(`The queue is empty: every point reachable from ${start} is finished, and ${target} is not one of them.`);
    } else {
        const unreached = graph.getPoints().filter(name => !finished.has(name));
        tracer.step(`Done. Every point shows its distance from ${start}, and the dark edges are the lightest paths to them.` +
            (unreached.length ? ` Not reachable from ${start}: ${nameList(unreached)}.` : ""));
    }
    return { distances: final, path: null, distance: null, steps: tracer.trace() };
};

// sums of decimal weights can come out as 0.30000000000000004: show at most 6 decimals
function format(value: number): string {
    return String(Number(value.toFixed(6)));
}

export {
    dijkstra
};
