// State shared by every part of the page: the graph, the selection and the algorithm step on display.

import { edgeKey, Step } from "../../src/algorithms/trace";
import { GraphData, GraphModel, GraphTooBigError, MAX_EDGES, MAX_POINTS, Position, RepresentationId } from "./model";
import { presets } from "./presets";

export const notices = {
    tooManyPoints: `A graph here can have at most ${MAX_POINTS} points. Delete a point to add another.`,
    tooManyEdges: `A graph here can have at most ${MAX_EDGES} edges. Delete an edge to add another.`,
    savedTooBig: `The saved graph was too big to show (the limit is ${MAX_POINTS} points and ${MAX_EDGES} edges), so an example is shown instead.`,
};

export type Selection =
    | { kind: "point"; name: string }
    | { kind: "edge"; from: string; to: string }
    | null;

// graph: points or edges changed; positions: a point moved; view: selection or step changed
export type Change = "graph" | "positions" | "view";

const STORAGE_KEY = "grph:graph";

export class App {
    readonly model = new GraphModel();
    selection: Selection = null;
    // the algorithm step on display, null when no algorithm has run
    step: Step | null = null;
    // the representation the algorithm reads neighbors from
    readFrom: RepresentationId = "list";
    // why the last action did nothing, shown until the next action
    notice: string | null = null;
    private readonly listeners: ((change: Change) => void)[] = [];

    constructor() {
        const saved = loadSaved();
        try {
            this.model.load(saved ?? presets[0].data);
        } catch (error) {
            // The saved graph is not a valid graph, or too big to show without freezing the page.
            // Replace it, so the next visit doesn't load it again.
            this.model.load(presets[0].data);
            save(this.model.toData());
            if (error instanceof GraphTooBigError) {
                this.notice = notices.savedTooBig;
            }
        }
    }

    on(listener: (change: Change) => void): void {
        this.listeners.push(listener);
    }

    private emit(change: Change, notice: string | null = null): void {
        if (change === "graph") {
            // a recorded run no longer matches the changed graph
            this.step = null;
        }
        if (change !== "positions") {
            this.notice = notice;
        }
        if (change !== "view") {
            save(this.model.toData());
        }
        this.listeners.forEach(listener => listener(change));
    }

    // ---- editing

    addPoint(position: Position): void {
        if (!this.model.canAddPoint()) {
            this.emit("view", notices.tooManyPoints);
            return;
        }
        this.model.addPoint(this.model.nextPointName(), position);
        this.emit("graph");
    }

    movePoint(name: string, position: Position): void {
        this.model.movePoint(name, position);
        this.emit("positions");
    }

    // Clicking a point selects it. Clicking a second point connects the two and selects the new edge.
    clickPoint(name: string): void {
        const selected = this.selection;
        if (selected?.kind !== "point") {
            this.select({ kind: "point", name });
        } else if (selected.name === name) {
            this.select(null);
        } else {
            if (this.model.hasEdge(selected.name, name)) {
                this.selection = { kind: "edge", from: selected.name, to: name };
                this.emit("view");
            } else if (!this.model.canAddEdge()) {
                // keep the first point selected, so deleting an edge and clicking again works
                this.emit("view", notices.tooManyEdges);
            } else {
                this.selection = { kind: "edge", from: selected.name, to: name };
                this.model.addEdge(selected.name, name);
                this.emit("graph");
            }
        }
    }

    // throws a GraphError when the weight is not a positive number
    setWeight(from: string, to: string, weight: number): void {
        this.model.addEdge(from, to, weight);
        this.emit("graph");
    }

    deleteSelection(): void {
        const selected = this.selection;
        if (!selected) {
            return;
        }
        this.selection = null;
        if (selected.kind === "point") {
            this.model.removePoint(selected.name);
        } else {
            this.model.removeEdge(selected.from, selected.to);
        }
        this.emit("graph");
    }

    setDirected(directed: boolean): void {
        this.model.setDirected(directed);
        this.selection = null;
        this.emit("graph");
    }

    load(data: GraphData): void {
        this.model.load(data);
        this.selection = null;
        this.emit("graph");
    }

    clear(): void {
        this.load({ directed: this.model.directed, points: [], edges: [] });
    }

    // ---- viewing

    select(selection: Selection): void {
        this.selection = selection;
        this.emit("view");
    }

    isSelectedPoint(name: string): boolean {
        return this.selection?.kind === "point" && this.selection.name === name;
    }

    isSelectedEdge(from: string, to: string): boolean {
        const selected = this.selection;
        return selected?.kind === "edge" &&
            edgeKey(selected.from, selected.to, this.model.directed) === edgeKey(from, to, this.model.directed);
    }

    showStep(step: Step | null): void {
        this.step = step;
        this.emit("view");
    }

    setReadFrom(id: RepresentationId): void {
        this.readFrom = id;
        this.emit("view");
    }
}

// The graph is kept in this browser between visits. Storage can be unavailable
// (private windows, blocked site data), so failures fall back to the default example.
// The App constructor checks that the saved data is a graph it can show.
function save(data: GraphData): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // nothing to do: the graph just won't be restored next time
    }
}

function loadSaved(): GraphData | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as GraphData : null;
    } catch {
        return null;
    }
}
