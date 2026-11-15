import { describe, expect, it } from "vitest";
import { assertEdge, assertPointName, edgeLabel, GraphError } from "../src/graph/validation";

describe("validation", () => {
    it("accepts valid names, edges and weights", () => {
        expect(() => assertPointName("A")).not.toThrow();
        expect(() => assertEdge("A", "B", 1)).not.toThrow();
        expect(() => assertEdge("A", "B", 0.5)).not.toThrow();
    });

    it("rejects empty point names", () => {
        expect(() => assertPointName("")).toThrow(GraphError);
        expect(() => assertPointName("  ")).toThrow(GraphError);
    });

    it("rejects self-loops", () => {
        expect(() => assertEdge("A", "A", 1)).toThrow(/two different points/);
    });

    it("rejects zero, negative and non-finite weights", () => {
        for (const weight of [0, -1, NaN, Infinity]) {
            expect(() => assertEdge("A", "B", weight)).toThrow(/positive number/);
        }
    });

    it("labels edges by direction", () => {
        expect(edgeLabel("A", "B", true)).toBe("A→B");
        expect(edgeLabel("A", "B", false)).toBe("A–B");
    });
});
