import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App, notices } from "../ui/src/app";
import { GraphModel, MAX_EDGES, MAX_POINTS } from "../ui/src/model";
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
        const app = new App();
        app.clear();
        for (let i = 0; i < MAX_POINTS; i++) {
            app.addPoint({ x: 100, y: 100 });
        }
        expect(app.notice).toBeNull();

        app.addPoint({ x: 100, y: 100 });
        expect(app.model.points().length).toBe(MAX_POINTS);
        expect(app.notice).toBe(notices.tooManyPoints);

        // the next action clears the notice
        app.select(null);
        expect(app.notice).toBeNull();
    });

    it("does not add an edge past the limit and keeps the first point selected", () => {
        const app = new App();
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
        expect(app.notice).toBe(notices.tooManyEdges);
        expect(app.selection).toEqual({ kind: "point", name: "A" });
    });

    it("reads from the list again when the graph outgrows the chosen matrix", () => {
        const app = new App(new GraphModel({ matrix: { points: 2 }, incidence: { points: 2, cells: 2 } }));
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

        const app = new App();
        expect(app.model.points().length).toBe(presets[0].data.points.length);
        expect(app.notice).toBe(notices.savedTooBig);
        expect(JSON.parse(store.get(STORAGE_KEY)!).points.length).toBe(presets[0].data.points.length);
    });

    it("restores a saved graph within the limits", () => {
        store.set(STORAGE_KEY, JSON.stringify({ directed: true, points: [{ name: "X", x: 100, y: 100 }], edges: [] }));
        const app = new App();
        expect(app.model.points()).toEqual(["X"]);
        expect(app.model.directed).toBe(true);
        expect(app.notice).toBeNull();
    });
});
