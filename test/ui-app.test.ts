import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App, notices } from "../ui/src/app";
import { generate } from "../ui/src/generate";
import { GraphModel, LIMITS } from "../ui/src/model";
import { SAVE_POINTS } from "../ui/src/app";

// a small graph limit, so the limit tests stay quick
const small = { ...LIMITS, graph: { points: 40, edges: 120 } };
const MAX_POINTS = small.graph.points;
const MAX_EDGES = small.graph.edges;
import { presets } from "../ui/src/presets";

const STORAGE_KEY = "grph:graph";

// a stand-in for the browser's localStorage, which Node doesn't have
function stubStorage(): Map<string, string> {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
    };
    return store;
}

describe("App", () => {
    let store: Map<string, string>;
    beforeEach(() => store = stubStorage());
    afterEach(() => delete (globalThis as { localStorage?: unknown }).localStorage);

    it("does not add a point past the limit and says why", () => {
        const app = new App(new GraphModel(small));
        app.clear();
        for (let i = 0; i < MAX_POINTS; i++) {
            app.addPoint({ x: 100, y: 100 });
        }
        expect(app.notice).toBeNull();

        app.addPoint({ x: 100, y: 100 });
        expect(app.model.points().length).toBe(MAX_POINTS);
        expect(app.notice).toBe(notices.tooManyPoints(small));

        // the next action clears the notice
        app.select(null);
        expect(app.notice).toBeNull();
    });

    it("does not add an edge past the limit and keeps the first point selected", () => {
        const app = new App(new GraphModel(small));
        app.clear();
        for (let i = 0; i < 20; i++) {
            app.addPoint({ x: 100, y: 100 });
        }
        const points = app.model.points();
        for (let i = 0; app.model.edges().length < MAX_EDGES; i++) {
            app.clickPoint(points[i % 20]);
            app.clickPoint(points[(i + 1 + Math.floor(i / 20)) % 20]);
        }

        app.clickPoint("A");
        app.clickPoint(points.find(name => name !== "A" && !app.model.hasEdge("A", name))!);
        expect(app.model.edges().length).toBe(MAX_EDGES);
        expect(app.notice).toBe(notices.tooManyEdges(small));
        expect(app.selection).toEqual({ kind: "point", name: "A" });
    });

    it("reads from the list again when the graph outgrows the chosen matrix", () => {
        const app = new App(new GraphModel({ ...LIMITS, matrix: { points: 2 }, incidence: { points: 2, cells: 2 } }));
        app.clear();
        app.addPoint({ x: 100, y: 100 });
        app.addPoint({ x: 200, y: 100 });
        app.setReadFrom("matrix");
        expect(app.readFrom).toBe("matrix");

        app.addPoint({ x: 300, y: 100 });
        expect(app.readFrom).toBe("list");
        app.setReadFrom("matrix");
        expect(app.readFrom).toBe("list");
    });

    it("shows an example instead of a saved graph that is too big, and forgets that graph", () => {
        const points = Array.from({ length: 600 }, (_, i) => ({ name: "P" + i, x: 100, y: 100 }));
        store.set(STORAGE_KEY, JSON.stringify({ directed: false, points, edges: [] }));

        const app = new App(new GraphModel(small));
        expect(app.model.points().length).toBe(presets[0].data.points.length);
        expect(app.notice).toBe(notices.savedTooBig(small));
        expect(JSON.parse(store.get(STORAGE_KEY)!).points.length).toBe(presets[0].data.points.length);
    });

    it("restores a saved graph within the limits", () => {
        store.set(STORAGE_KEY, JSON.stringify({ directed: true, points: [{ name: "X", x: 100, y: 100 }], edges: [] }));
        const app = new App();
        expect(app.model.points()).toEqual(["X"]);
        expect(app.model.directed).toBe(true);
        expect(app.notice).toBeNull();
    });

    it("saves a big generated graph as its recipe and makes the same graph again", () => {
        const app = new App();
        app.generate(SAVE_POINTS + 1);
        const saved = JSON.parse(store.get(STORAGE_KEY)!);
        expect(Object.keys(saved)).toEqual(["recipe"]);
        expect(saved.recipe.points).toBe(SAVE_POINTS + 1);

        const again = new App();
        expect(again.model.toData()).toEqual(app.model.toData());
        expect(again.recipe).toEqual(app.recipe);
    });

    it("stops following the recipe once the graph is edited", () => {
        const app = new App();
        app.generate(SAVE_POINTS + 1);
        const recipe = store.get(STORAGE_KEY);
        app.movePoint("1", { x: 5, y: 5 });
        expect(app.recipe).toBeNull();
        // the edited big graph is not saved, so the recipe saved before stays
        expect(store.get(STORAGE_KEY)).toBe(recipe);
    });

    it("saves a small generated graph point by point", () => {
        const app = new App();
        app.generate(100);
        expect(JSON.parse(store.get(STORAGE_KEY)!).points.length).toBe(100);
    });

    it("makes a generated graph directed by generating it again with the same points", () => {
        const app = new App();
        app.generate(100);
        const before = app.model.toData();
        const loads = app.loads;
        app.setDirected(true);
        expect(app.model.directed).toBe(true);
        expect(app.model.toData().points).toEqual(before.points);
        expect(app.model.edgeCount()).toBe(before.edges.length);
        expect(app.loads).toBe(loads); // the view stays where it is
    });

    it("generates a big example when it is chosen, and saves only its recipe", () => {
        const app = new App();
        app.loadExample("big-10k");
        expect(app.model.pointCount()).toBe(10_000);
        expect(app.model.matrix).toBeNull();
        expect(JSON.parse(store.get(STORAGE_KEY)!)).toEqual({ recipe: { points: 10_000, seed: 2026, directed: false } });

        // the same example is the same graph every time
        const again = new App();
        again.loadExample("big-10k");
        expect(again.model.toData()).toEqual(app.model.toData());
    });

    it("loads a small example point by point", () => {
        const app = new App();
        app.loadExample(presets[1].id);
        expect(app.model.points()).toEqual(presets[1].data.points.map(p => p.name));
        expect(app.recipe).toBeNull();
    });

    it("starts a search at the first point until another one is chosen, and at no target", () => {
        const app = new App();
        app.loadExample(presets[0].id);
        const [first, second, third] = app.model.points();
        expect(app.start).toBe(first);
        expect(app.target).toBeNull();

        app.chooseStart(second);
        app.chooseTarget(third);
        expect([app.start, app.target]).toEqual([second, third]);

        // a name that is not a point is ignored
        app.chooseStart("nope");
        app.chooseTarget("nope");
        expect([app.start, app.target]).toEqual([second, third]);

        // deleting the chosen points gives the first point back as the start, and no target
        app.select({ kind: "point", name: second });
        app.deleteSelection();
        app.select({ kind: "point", name: third });
        app.deleteSelection();
        expect([app.start, app.target]).toEqual([first, null]);
    });

    it("clears the selection when a selected point becomes the start or target, so the next click doesn't connect", () => {
        const app = new App();
        app.loadExample(presets[0].id);
        const [, second, third] = app.model.points();
        app.clickPoint(second);
        app.chooseStart(second, true);
        app.clickPoint(third);
        expect(app.model.hasEdge(second, third)).toBe(false);
        expect(app.selection).toEqual({ kind: "point", name: third });
        app.chooseTarget(third, true);
        expect(app.selection).toBeNull();
        expect([app.start, app.target]).toEqual([second, third]);
    });
});
