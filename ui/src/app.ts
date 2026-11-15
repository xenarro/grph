// State shared by every part of the page: the graph, the selection and the algorithm step on display.

import { algorithms, getAlgorithm } from "../../src/algorithms";
import { edgeKey, Step } from "../../src/algorithms/trace";
import { generate, randomSeed, Recipe } from "./generate";
import { GraphData, GraphModel, GraphTooBigError, Limits, Position, RepresentationId } from "./model";
import { bigExamples, presets } from "./presets";

const count = (n: number) => n.toLocaleString("en-US");

export const notices = {
    tooManyPoints: ({ graph }: Limits) => `A graph here can have at most ${count(graph.points)} points. Delete a point to add another.`,
    tooManyEdges: ({ graph }: Limits) => `A graph here can have at most ${count(graph.edges)} edges. Delete an edge to add another.`,
    savedTooBig: ({ graph }: Limits) => `The saved graph was too big to show (the limit is ${count(graph.points)} points and ${count(graph.edges)} edges), so an example is shown instead.`,
};

export type Selection =
    | { kind: "point"; name: string }
    | { kind: "edge"; from: string; to: string }
    | null;

// graph: points or edges changed; positions: a point moved; view: selection or step changed
export type Change = "graph" | "positions" | "view";

const STORAGE_KEY = "grph:graph";

// Graphs up to this size are saved point by point. A bigger one does not fit in the browser's storage
// (about 5 MB), so a generated graph is saved as its recipe instead, and edits to it are not kept.
export const SAVE_POINTS = 5_000;

export class App {
    readonly model: GraphModel;
    selection: Selection = null;
    // the algorithm step on display, null when no algorithm has run
    step: Step | null = null;
    // the representation the algorithm reads neighbors from
    readFrom: RepresentationId = "list";
    // why the last action did nothing, shown until the next action
    notice: string | null = null;
    // how many graphs have been loaded, so the drawing can fit each new one in view
    loads = 1;
    // the recipe of a generated graph, until the graph is edited
    recipe: Recipe | null = null;
    // the algorithm chosen in the player, whose explanation is shown
    algorithm: string = algorithms[0].id;
    // the point a search ends at, null for none; see `start` for where it begins
    target: string | null = null;
    private chosenStart: string | null = null;
    private saveTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly listeners: ((change: Change) => void)[] = [];

    constructor(model: GraphModel = new GraphModel()) {
        this.model = model;
        const saved = loadSaved();
        try {
            if (saved && "recipe" in saved) {
                this.model.load(generate(saved.recipe));
                this.recipe = saved.recipe;
            } else {
                this.model.load(saved ?? presets[0].data);
            }
        } catch (error) {
            // The saved graph is not a valid graph, or too big to show without freezing the page.
            // Replace it, so the next visit doesn't load it again.
            this.model.load(presets[0].data);
            store(this.model.toData());
            if (error instanceof GraphTooBigError) {
                this.notice = notices.savedTooBig(this.model.limits);
            }
        }
    }

    on(listener: (change: Change) => void): void {
        this.listeners.push(listener);
    }

    // `loaded` is true when a whole new graph was loaded, false for an edit
    private emit(change: Change, notice: string | null = null, loaded = false): void {
        if (change === "graph") {
            // a recorded run no longer matches the changed graph
            this.step = null;
            // a matrix the graph has outgrown can't be read any more
            if (!this.model.representation(this.readFrom)) {
                this.readFrom = "list";
            }
            if (this.target !== null && !this.model.list.hasPoint(this.target)) {
                this.target = null;
            }
        }
        if (change !== "positions") {
            this.notice = notice;
        }
        if (change !== "view") {
            if (!loaded) {
                // an edited graph is no longer the graph its recipe makes
                this.recipe = null;
            }
            if (change === "positions") {
                // a dragged point moves many times a second: save once it has stopped for a moment
                clearTimeout(this.saveTimer);
                this.saveTimer = setTimeout(() => this.save(), 300);
            } else {
                this.save();
            }
        }
        this.listeners.forEach(listener => listener(change));
    }

    // The graph is kept in this browser between visits: a small one point by point, a big generated one
    // as its recipe. A big graph that was edited is not saved, so the graph saved before it stays.
    private save(): void {
        clearTimeout(this.saveTimer);
        if (this.model.pointCount() <= SAVE_POINTS) {
            store(this.model.toData());
        } else if (this.recipe) {
            store({ recipe: this.recipe });
        }
    }

    // ---- editing

    addPoint(position: Position): void {
        if (!this.model.canAddPoint()) {
            this.emit("view", notices.tooManyPoints(this.model.limits));
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
                this.emit("view", notices.tooManyEdges(this.model.limits));
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
        if (this.recipe) {
            // a generated graph is generated again, so a directed one gets edges without cycles
            const recipe = { ...this.recipe, directed };
            this.load(generate(recipe), recipe, false);
            return;
        }
        this.model.setDirected(directed);
        this.selection = null;
        this.emit("graph");
    }

    // `fit` shows the whole new graph; a graph generated again in place keeps the view
    load(data: GraphData, recipe: Recipe | null = null, fit = true): void {
        this.model.load(data);
        this.selection = null;
        this.recipe = recipe;
        if (fit) {
            this.loads++;
        }
        this.emit("graph", null, true);
    }

    // a small example point by point, or a big one generated from its recipe
    loadExample(id: string): void {
        const preset = presets.find(p => p.id === id);
        const big = bigExamples.find(b => b.id === id);
        if (preset) {
            this.load(preset.data);
        } else if (big) {
            this.load(generate(big.recipe), big.recipe);
        }
    }

    // a random graph of this many points, with edges or arrows as the current graph has them
    generate(points: number): void {
        const recipe = { points, seed: randomSeed(), directed: this.model.directed };
        this.load(generate(recipe), recipe);
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

    // The point a search starts at: the one chosen while it exists, otherwise the first point.
    get start(): string | null {
        if (this.chosenStart !== null && this.model.list.hasPoint(this.chosenStart)) {
            return this.chosenStart;
        }
        return this.model.list.graph.keys().next().value ?? null;
    }

    // Ignored for a name that is not a point of the graph. `picked` is true when the point was picked
    // on the drawing: the selection is cleared, so the next click on a point picks it instead of
    // connecting the two.
    chooseStart(name: string, picked = false): void {
        if (this.model.list.hasPoint(name)) {
            this.chosenStart = name;
        }
        if (picked) {
            this.selection = null;
        }
        this.emit("view");
    }

    // null for no target; otherwise like chooseStart. Picking a target on the drawing means
    // "find the way there", so an algorithm that doesn't find the shortest path gives way to one that does.
    chooseTarget(name: string | null, picked = false): void {
        if (name === null || this.model.list.hasPoint(name)) {
            this.target = name;
        }
        let notice: string | null = null;
        const shortest = ["bfs", "dijkstra"];
        if (this.target !== null && (getAlgorithm(this.algorithm).target === "none" || (picked && !shortest.includes(this.algorithm)))) {
            notice = `${getAlgorithm(this.algorithm).name} doesn't find the shortest path, so the algorithm is now ` +
                `${getAlgorithm("dijkstra").name}. Pick another one in the list to compare.`;
            this.algorithm = "dijkstra";
        }
        if (picked) {
            this.selection = null;
        }
        this.emit("view", notice);
    }

    // throws for an id no algorithm has
    setAlgorithm(id: string): void {
        this.algorithm = getAlgorithm(id).id;
        this.emit("view");
    }

    // ignored for a matrix the graph is too big for
    setReadFrom(id: RepresentationId): void {
        if (this.model.representation(id)) {
            this.readFrom = id;
        }
        this.emit("view");
    }
}

// Storage can be unavailable (private windows, blocked site data) or full, so failures
// fall back to the default example. The App constructor checks that saved data is a graph it can show.
type Saved = GraphData | { recipe: Recipe };

function store(saved: Saved): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
        // nothing to do: the graph just won't be restored next time
    }
}

function loadSaved(): Saved | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as Saved : null;
    } catch {
        return null;
    }
}
