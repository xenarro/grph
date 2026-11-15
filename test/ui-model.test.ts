import { describe, expect, it } from "vitest";
import { GraphModel, VIEW } from "../ui/src/model";
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

    it.each(presets)("loads the $name preset", preset => {
        const model = new GraphModel();
        model.load(preset.data);
        expect(model.points().length).toBe(preset.data.points.length);
        expect(model.edges().length).toBe(preset.data.edges.length);
        expect(model.toData().directed).toBe(preset.data.directed);
    });
});
