import { describe, expect, it } from "vitest";
import { GraphModel, GraphTooBigError, LIMITS, VIEW } from "../ui/src/model";

// a small graph limit, so the limit tests stay quick
const small = { ...LIMITS, graph: { points: 40, edges: 120 } };
const MAX_POINTS = small.graph.points;
const MAX_EDGES = small.graph.edges;
import { presets } from "../ui/src/presets";

describe("GraphModel", () => {
    it("applies every edit to all three representations", () => {
        const model = new GraphModel();
        model.addPoint("A", { x: 100, y: 100 });
        model.addEdge("A", "B", 3);
        model.removePoint("A");
        model.addEdge("B", "C");

        for (const id of ["matrix", "list", "incidence"] as const) {
            const graph = model.representation(id)!;
            expect(graph.getPoints()).toEqual(["B", "C"]);
            expect(graph.hasEdge("C", "B")).toBe(true);
        }
    });

    it("keeps a point anywhere on the paper, but not at a broken position", () => {
        const model = new GraphModel();
        model.addPoint("A", { x: -50, y: VIEW.height + 50 });
        expect(model.position("A")).toEqual({ x: -50, y: VIEW.height + 50 });
        model.movePoint("A", { x: NaN, y: 3 });
        expect(model.position("A")).toEqual({ x: VIEW.width / 2, y: 3 });
    });

    it("switches between undirected and directed edges", () => {
        const model = new GraphModel();
        model.addEdge("A", "B", 2);
        model.setDirected(true);
        expect(model.directed).toBe(true);
        expect(model.edges()).toEqual([{ from: "A", to: "B", weight: 2 }]);
        expect(model.incidence!.directed).toBe(true);

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
        const model = new GraphModel(small);
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
        const model = new GraphModel(small);
        model.load(presets[0].data);
        const points = Array.from({ length: MAX_POINTS + 1 }, (_, i) => ({ name: "P" + i, x: 0, y: 0 }));
        expect(() => model.load({ directed: false, points, edges: [] })).toThrow(GraphTooBigError);

        const edges = Array.from({ length: MAX_EDGES + 1 }, (_, i) => ({ from: "A", to: "B", weight: i + 1 }));
        expect(() => model.load({ directed: false, points: [], edges })).toThrow(GraphTooBigError);

        expect(model.points().length).toBe(presets[0].data.points.length);
    });

    describe("matrices past their limits", () => {
        const tiny = { ...LIMITS, matrix: { points: 3 }, incidence: { points: 3, cells: 4 } };

        it("drops a matrix the graph outgrows and builds it again from the list", () => {
            const model = new GraphModel(tiny);
            model.addEdge("A", "B", 2);
            model.addEdge("B", "C", 3);
            expect(model.matrix).not.toBeNull();
            expect(model.incidence).toBeNull(); // 3 points × 2 edges = 6 cells, over 4
            expect(model.size("incidence")).toEqual({ cells: 6, bytes: 72, fits: false });

            model.addPoint("D", { x: 0, y: 0 });
            expect(model.matrix).toBeNull();
            expect(model.representation("matrix")).toBeNull();
            expect(model.representation("list")).toBe(model.list);
            expect(model.size("matrix")).toEqual({ cells: 16, bytes: 128, fits: false });

            model.removePoint("D");
            model.removeEdge("B", "C");
            expect(model.matrix!.getPoints()).toEqual(["A", "B", "C"]);
            expect(model.matrix!.getNeighbors("A")).toEqual([{ name: "B", weight: 2 }]);
            expect(model.incidence!.getEdges()).toEqual([{ from: "A", to: "B", weight: 2 }]);
        });

        it("loads a graph into the list only when it is too big for the matrices", () => {
            const model = new GraphModel(tiny);
            const points = ["A", "B", "C", "D"].map(name => ({ name, x: 0, y: 0 }));
            model.load({ directed: true, points, edges: [{ from: "A", to: "D", weight: 1 }] });
            expect(model.matrix).toBeNull();
            expect(model.incidence).toBeNull();
            expect(model.list.getNeighbors("A")).toEqual([{ name: "D", weight: 1 }]);
            expect(model.edgeCount()).toBe(1);
        });

        it("builds the matrices for a thousand points", () => {
            const model = new GraphModel();
            const names = Array.from({ length: 1000 }, (_, i) => "P" + i);
            names.forEach(name => model.addPoint(name, { x: 0, y: 0 }));
            names.forEach((name, i) => model.addEdge(name, names[(i + 1) % 1000]));
            expect(model.matrix!.getPoints()).toEqual(names);
            expect(model.matrix!.getNeighbors("P0")).toEqual([{ name: "P1", weight: 1 }, { name: "P999", weight: 1 }]);
            expect(model.incidence!.edges.length).toBe(1000);

            model.addPoint("one too many", { x: 0, y: 0 });
            expect(model.matrix).toBeNull();
            expect(model.incidence).toBeNull();
        });
    });

    it.each(presets)("loads the $name preset", preset => {
        const model = new GraphModel();
        model.load(preset.data);
        expect(model.points().length).toBe(preset.data.points.length);
        expect(model.edges().length).toBe(preset.data.edges.length);
        expect(model.toData().directed).toBe(preset.data.directed);
    });
});
