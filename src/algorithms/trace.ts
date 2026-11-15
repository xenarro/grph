// An algorithm records its work as a list of steps so it can be replayed one step at a time.
// Each step is a full snapshot, so a viewer can jump to any step without replaying the earlier ones.

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
}

export interface Step {
    readonly message: string;
    readonly focus: Focus;
    readonly points: Readonly<Record<string, PointMark>>;
    readonly edges: Readonly<Record<string, EdgeMark>>; // keyed by edgeKey()
    readonly labels: Readonly<Record<string, string>>;  // short text shown next to a point
    readonly lists: readonly TraceList[];
}

// The same key for both directions of an undirected edge.
export function edgeKey(from: string, to: string, directed: boolean): string {
    const [x, y] = directed || from < to ? [from, to] : [to, from];
    return JSON.stringify([x, y]);
}

export class Tracer {
    readonly steps: Step[] = [];
    private readonly points = new Map<string, PointMark>();
    private readonly edges = new Map<string, EdgeMark>();
    private readonly labels = new Map<string, string>();
    private readonly lists = new Map<string, string[]>();

    constructor(private readonly directed: boolean) {}

    markPoint(name: string, mark: PointMark): this {
        this.points.set(name, mark);
        return this;
    }

    markEdge(from: string, to: string, mark: EdgeMark): this {
        this.edges.set(edgeKey(from, to, this.directed), mark);
        return this;
    }

    edgeMark(from: string, to: string): EdgeMark | undefined {
        return this.edges.get(edgeKey(from, to, this.directed));
    }

    label(name: string, text: string): this {
        this.labels.set(name, text);
        return this;
    }

    // lists are shown in the order they are first set
    list(name: string, items: readonly string[]): this {
        this.lists.set(name, [...items]);
        return this;
    }

    step(message: string, focus: Focus = {}): this {
        this.steps.push({
            message,
            focus,
            points: Object.fromEntries(this.points),
            edges: Object.fromEntries(this.edges),
            labels: Object.fromEntries(this.labels),
            lists: [...this.lists].map(([name, items]) => ({ name, items: [...items] })),
        });
        return this;
    }
}
