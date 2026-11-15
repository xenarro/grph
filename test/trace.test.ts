import { describe, expect, it } from "vitest";
import { edgeKey, Tracer } from "../src/algorithms/trace";

describe("Tracer", () => {
    it("records independent snapshots", () => {
        const tracer = new Tracer(false);
        tracer.markPoint("A", "current").list("Stack", ["A"]).step("first", { point: "A" });
        tracer.markPoint("A", "done").markEdge("B", "A", "tree").label("A", "1").list("Stack", []).step("second");

        const [first, second] = tracer.steps;
        expect(first).toEqual({
            message: "first",
            focus: { point: "A" },
            points: { A: "current" },
            edges: {},
            labels: {},
            lists: [{ name: "Stack", items: ["A"] }],
        });
        expect(second.points).toEqual({ A: "done" });
        expect(second.edges).toEqual({ [edgeKey("A", "B", false)]: "tree" });
        expect(second.labels).toEqual({ A: "1" });
        expect(second.lists).toEqual([{ name: "Stack", items: [] }]);
    });

    it("uses one key for both directions of an undirected edge only", () => {
        expect(edgeKey("A", "B", false)).toBe(edgeKey("B", "A", false));
        expect(edgeKey("A", "B", true)).not.toBe(edgeKey("B", "A", true));
    });

    it("reads back edge marks in either direction when undirected", () => {
        const tracer = new Tracer(false).markEdge("A", "B", "tree");
        expect(tracer.edgeMark("B", "A")).toBe("tree");
    });
});
