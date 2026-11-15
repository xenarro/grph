import { describe, expect, it } from "vitest";
import { GraphModel, GraphTooBigError, MAX_EDGES, MAX_POINTS, VIEW } from "../ui/src/model";
import { presets } from "../ui/src/presets";

describe("GraphModel", () => {
    it("applies every edit to all three representations", () => {
        const model = new GraphModel();
        model.addPoint("A", { x: 100, y: 100 });
        model.addEdge("A", "B", 3);
        model.removePoint("A");
        model.addEdge("B", "C");

        for (const id of ["matrix", "list", "incidence"] as const) {
            const graph = model.representation(id);
            expect(graph.getPoints()).toEqual(["B", "C"]);
            expect(graph.hasEdge("C", "B")).toBe(true);
        }
    });

    it("keeps points inside the drawing area", () => {
        const model = new GraphModel();
        model.addPoint("A", { x: -50, y: VIEW.height + 50 });
        const { x, y } = model.position("A");
        expect(x).toBeGreaterThan(0);
        expect(y).toBeLessThan(VIEW.height);
    });

    it("switches between undirected and directed edges", () => {
        const model = new GraphModel();
        model.addEdge("A", "B", 2);
        model.setDirected(true);
        expect(model.directed).toBe(true);
        expect(model.edges()).toEqual([{ from: "A", to: "B", weight: 2 }]);
        expect(model.incidence.directed).toBe(true);

        model.addEdge("B", "A", 5);
        model.setDirected(false);
        expect(model.edges()).toEqual([{ from: "A", to: "B", weight: 5 }]);
    });

    it("names new points with the first free letter", () => {
        const model = new GraphModel();
        expect(model.nextPointName()).toBe("A");
        model.addPoint("A", { x: 0, y: 0 });
        model.addPoint("C", { x: 0, y: 0 });
        expect(model.nextPointName()).toBe("B");
    });

    it("stops adding points and edges at the limits", () => {
        const model = new GraphModel();
        for (let i = 0; i < MAX_POINTS; i++) {
            expect(model.canAddPoint()).toBe(true);
            model.addPoint(model.nextPointName(), { x: 0, y: 0 });
        }
        expect(model.canAddPoint()).toBe(false);

        const points = model.points();
        for (let i = 0; i < points.length && model.edges().length < MAX_EDGES; i++) {
            for (let j = i + 1; j < points.length && model.edges().length < MAX_EDGES; j++) {
                expect(model.canAddEdge()).toBe(true);
                model.addEdge(points[i], points[j]);
            }
        }
        expect(model.edges().length).toBe(MAX_EDGES);
        expect(model.canAddEdge()).toBe(false);
    });

    it("refuses to load a graph over the limits without changing the current one", () => {
        const model = new GraphModel();
        model.load(presets[0].data);
        const points = Array.from({ length: MAX_POINTS + 1 }, (_, i) => ({ name: "P" + i, x: 0, y: 0 }));
        expect(() => model.load({ directed: false, points, edges: [] })).toThrow(GraphTooBigError);

        const edges = Array.from({ length: MAX_EDGES + 1 }, (_, i) => ({ from: "A", to: "B", weight: i + 1 }));
        expect(() => model.load({ directed: false, points: [], edges })).toThrow(GraphTooBigError);

        expect(model.points().length).toBe(presets[0].data.points.length);
    });

    it.each(presets)("loads the $name preset", preset => {
        const model = new GraphModel();
        model.load(preset.data);
        expect(model.points().length).toBe(preset.data.points.length);
        expect(model.edges().length).toBe(preset.data.edges.length);
        expect(model.toData().directed).toBe(preset.data.directed);
    });
});
