// An algorithm records its work as a list of steps so it can be replayed one step at a time.
//
// A step stores only what changed since the step before, together with the old values,
// so a long run stays small: a full copy of every mark at every step would grow with
// steps × points, which is gigabytes for a graph of 100,000 points.
// Trace.at() moves to any step by applying the changes forwards or undoing them backwards.
//
// A run can still take hundreds of thousands of steps (a depth-first search over 100,000 points
// takes 800,000), far more than anyone steps through. So only the first MAX_STEPS are kept one by one;
// the rest of the run becomes one last step that holds the combined changes and the final message.

// unmarked points have not been reached yet
export type PointMark =
    | "current" // the point being processed
    | "active"  // reached but not finished: on the stack, in the queue, ...
    | "done"    // finished
    | "result"  // part of the answer, for example the path to the target
    | "error";  // part of a problem, for example a cycle

// unmarked edges have not been looked at yet
export type EdgeMark =
    | "tree"    // the edge was used to reach a new point
    | "skipped" // the edge was looked at but led to a point that was already reached
    | "result"
    | "error";

// What the algorithm reads in this step. Views use it to highlight the part of the graph
// representation being read: a point's row or list, or a single edge's cell or column.
export interface Focus {
    readonly point?: string;
    readonly edge?: { readonly from: string; readonly to: string };
}

// an ordered collection the algorithm keeps, for example the stack or the visiting order
export interface TraceList {
    readonly name: string;
    readonly items: readonly string[];
    // true when new items go to the front, so the newest item is the first one
    readonly newestFirst: boolean;
    // the end that matters when a long list is cut short: the newest items, or the next ones out of a queue
    readonly keep: "front" | "back";
}

// One step of a trace. The marks, labels and lists show the state at this step. They are live views
// of the trace: read them before moving the trace to another step.
export interface Step {
    readonly message: string;
    readonly focus: Focus;
    readonly points: ReadonlyMap<string, PointMark>;
    readonly edges: ReadonlyMap<string, EdgeMark>; // keyed by edgeKey()
    readonly labels: ReadonlyMap<string, string>;  // short text shown next to a point
    readonly lists: readonly TraceList[];
}

export const MAX_STEPS = 100_000;

// The same key for both directions of an undirected edge.
export function edgeKey(from: string, to: string, directed: boolean): string {
    const [x, y] = directed || from < to ? [from, to] : [to, from];
    return JSON.stringify([x, y]);
}

// ---- what a step stores

type MapName = "points" | "edges" | "labels";

interface ListShape {
    readonly name: string;
    readonly newestFirst: boolean;
    readonly keep: "front" | "back";
}

type Change =
    | { readonly kind: "set"; readonly map: MapName; readonly key: string; readonly before?: string; readonly after: string }
    | { readonly kind: "add"; readonly list: string; readonly item: string }
    | { readonly kind: "remove"; readonly list: string; readonly item: string }
    | { readonly kind: "insert"; readonly list: string; readonly index: number; readonly item: string }
    | { readonly kind: "removeAt"; readonly list: string; readonly index: number; readonly item: string };

interface RecordedStep {
    readonly message: string;
    readonly focus: Focus;
    readonly changes: readonly Change[];
}

// The marks, labels and lists at one moment. The tracer keeps one while recording,
// and a trace keeps one at the step it is on.
class State {
    readonly maps: Record<MapName, Map<string, string>> = { points: new Map(), edges: new Map(), labels: new Map() };
    // items are kept in the order they were added; a newest-first list is turned around when shown
    readonly lists = new Map<string, { stored: string[]; newestFirst: boolean; keep: "front" | "back" }>();

    apply(change: Change): void {
        if (change.kind === "set") {
            this.maps[change.map].set(change.key, change.after);
        } else if (change.kind === "add") {
            this.list(change.list).stored.push(change.item);
        } else if (change.kind === "remove") {
            this.list(change.list).stored.pop();
        } else if (change.kind === "insert") {
            this.list(change.list).stored.splice(change.index, 0, change.item);
        } else {
            this.list(change.list).stored.splice(change.index, 1);
        }
    }

    undo(change: Change): void {
        if (change.kind === "set") {
            if (change.before === undefined) {
                this.maps[change.map].delete(change.key);
            } else {
                this.maps[change.map].set(change.key, change.before);
            }
        } else if (change.kind === "add") {
            this.list(change.list).stored.pop();
        } else if (change.kind === "remove") {
            this.list(change.list).stored.push(change.item);
        } else if (change.kind === "insert") {
            this.list(change.list).stored.splice(change.index, 1);
        } else {
            this.list(change.list).stored.splice(change.index, 0, change.item);
        }
    }

    list(name: string): { stored: string[]; newestFirst: boolean; keep: "front" | "back" } {
        const list = this.lists.get(name);
        if (!list) {
            throw new Error(`Trace list ${name} was not created`);
        }
        return list;
    }
}

export class Trace {
    private readonly steps: readonly RecordedStep[];
    private readonly state = new State();
    // the step the state shows; -1 is before the first step
    private position = -1;

    constructor(steps: readonly RecordedStep[], lists: readonly ListShape[]) {
        this.steps = steps;
        lists.forEach(({ name, newestFirst, keep }) => this.state.lists.set(name, { stored: [], newestFirst, keep }));
    }

    get length(): number {
        return this.steps.length;
    }

    // The step at an index; a negative index counts from the end, like Array.prototype.at().
    // Moving by one step applies or undoes only that step's changes.
    at(index: number): Step {
        const target = index < 0 ? this.length + index : index;
        if (!Number.isInteger(target) || target < 0 || target >= this.length) {
            throw new RangeError(`Step ${index} does not exist; the trace has ${this.length} steps`);
        }
        while (this.position < target) {
            this.position++;
            this.steps[this.position].changes.forEach(change => this.state.apply(change));
        }
        while (this.position > target) {
            const changes = this.steps[this.position].changes;
            for (let i = changes.length - 1; i >= 0; i--) {
                this.state.undo(changes[i]);
            }
            this.position--;
        }

        const { message, focus } = this.steps[target];
        const { maps, lists } = this.state;
        return {
            message,
            focus,
            points: maps.points as ReadonlyMap<string, PointMark>,
            edges: maps.edges as ReadonlyMap<string, EdgeMark>,
            labels: maps.labels,
            lists: [...lists].map(([name, { stored, newestFirst, keep }]) => ({
                name,
                newestFirst,
                keep,
                get items() {
                    return newestFirst ? [...stored].reverse() : stored;
                },
            })),
        };
    }
}

export class Tracer {
    private readonly steps: RecordedStep[] = [];
    private readonly state = new State();
    private readonly lists: ListShape[] = [];
    private changes: Change[] = [];
    // past maxSteps: how many steps went into the last one, its latest message,
    // and where each key's combined change is in `changes`
    private skipped = 0;
    private latest: { message: string; focus: Focus } | null = null;
    private readonly combined = new Map<string, number>();

    constructor(private readonly directed: boolean, private readonly maxSteps: number = MAX_STEPS) {}

    markPoint(name: string, mark: PointMark): this {
        return this.set("points", name, mark);
    }

    markEdge(from: string, to: string, mark: EdgeMark): this {
        return this.set("edges", edgeKey(from, to, this.directed), mark);
    }

    edgeMark(from: string, to: string): EdgeMark | undefined {
        return this.state.maps.edges.get(edgeKey(from, to, this.directed)) as EdgeMark | undefined;
    }

    label(name: string, text: string): this {
        return this.set("labels", name, text);
    }

    // Creates an empty list. Lists are shown in the order they are created.
    // A newest-first list gets its items at the front, like the order of a topological sort.
    // `keep` is the end shown when the list is too long to show whole: by default the newest items,
    // "front" for a queue, whose next items out matter most.
    list(name: string, { newestFirst = false, keep }: { newestFirst?: boolean; keep?: "front" | "back" } = {}): this {
        if (this.state.lists.has(name)) {
            throw new Error(`Trace list ${name} already exists`);
        }
        const shape = { name, newestFirst, keep: keep ?? (newestFirst ? "front" : "back") };
        this.state.lists.set(name, { stored: [], newestFirst, keep: shape.keep });
        this.lists.push(shape);
        return this;
    }

    // adds an item: at the end, or at the front of a newest-first list
    add(list: string, item: string): this {
        return this.record({ kind: "add", list, item });
    }

    // removes the newest item, like popping a stack
    removeNewest(list: string): this {
        const { stored } = this.state.list(list);
        if (stored.length === 0) {
            throw new Error(`Trace list ${list} is empty`);
        }
        return this.record({ kind: "remove", list, item: stored[stored.length - 1] });
    }

    // puts an item at a position, counted from the front; for keeping a queue in order
    insert(list: string, index: number, item: string): this {
        const { stored, newestFirst } = this.state.list(list);
        if (newestFirst || index < 0 || index > stored.length) {
            throw new Error(`Can't insert at ${index} in trace list ${list}`);
        }
        return this.record({ kind: "insert", list, index, item });
    }

    // takes out the item at a position, counted from the front
    removeAt(list: string, index: number): this {
        const { stored, newestFirst } = this.state.list(list);
        if (newestFirst || index < 0 || index >= stored.length) {
            throw new Error(`Can't remove item ${index} of trace list ${list}`);
        }
        return this.record({ kind: "removeAt", list, index, item: stored[index] });
    }

    step(message: string, focus: Focus = {}): this {
        if (this.steps.length < this.maxSteps) {
            this.steps.push({ message, focus, changes: this.changes });
            this.changes = [];
        } else {
            this.skipped++;
            this.latest = { message, focus };
        }
        return this;
    }

    // the recorded steps; changes made after the last step are not part of it
    trace(): Trace {
        if (!this.latest) {
            return new Trace(this.steps, this.lists);
        }
        const last = {
            message: `${this.skipped.toLocaleString("en-US")} more steps, not kept one by one. ${this.latest.message}`,
            focus: this.latest.focus,
            changes: this.changes,
        };
        return new Trace([...this.steps, last], this.lists);
    }

    private set(map: MapName, key: string, after: string): this {
        const before = this.state.maps[map].get(key);
        return before === after ? this : this.record({ kind: "set", map, key, before, after });
    }

    private record(change: Change): this {
        this.state.apply(change);
        if (this.steps.length >= this.maxSteps && change.kind === "set") {
            // in the combined last step, a point or edge changed many times needs only its first
            // and last value, so the step grows with the size of the graph, not the number of steps
            const id = `${change.map} ${change.key}`;
            const index = this.combined.get(id);
            if (index !== undefined) {
                this.changes[index] = { ...(this.changes[index] as typeof change), after: change.after };
                return this;
            }
            this.combined.set(id, this.changes.length);
        }
        this.changes.push(change);
        return this;
    }
}

// "A, B, C" for a short list; a long one is cut, so a message stays readable for a big graph
export function nameList(names: readonly string[], separator = ", ", max = 20): string {
    if (names.length <= max) {
        return names.join(separator);
    }
    return `${names.slice(0, max).join(separator)}${separator}… (${(names.length - max).toLocaleString("en-US")} more)`;
}
