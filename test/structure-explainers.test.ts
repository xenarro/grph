// The TypeScript in each structure's "How it works", run for real.
import { stripTypeScriptTypes } from "node:module";
import { describe, expect, it } from "vitest";
import { structureExplainers } from "../ui/src/structure-explainers";

const run = (code: string, names: string[]): any =>
    new Function(`${stripTypeScriptTypes(code)}\nreturn { ${names.join(", ")} };`)();

describe("the code in each structure's How it works", () => {
    it("adjacency matrix: one cell answers an edge, a row gives the neighbors", () => {
        const { hasEdge, neighbors } = run(structureExplainers.matrix.typescript, ["hasEdge", "neighbors"]);
        expect(hasEdge(0, 1)).toBe(true);
        expect(hasEdge(1, 0)).toBe(true);
        expect(hasEdge(0, 2)).toBe(false);
        expect(neighbors(1)).toEqual([0, 2]);
        expect(neighbors(2)).toEqual([1]);
    });

    it("adjacency list: a point's list is its neighbors", () => {
        const { hasEdge, neighbors } = run(structureExplainers.list.typescript, ["hasEdge", "neighbors"]);
        expect(neighbors("B")).toEqual([{ name: "A", weight: 4 }, { name: "C", weight: 2 }]);
        expect(hasEdge("A", "B")).toBe(true);
        expect(hasEdge("A", "C")).toBe(false);
        expect(neighbors("Z")).toEqual([]);
    });

    it("incidence matrix: a column gives an edge's ends, a row and its columns the neighbors", () => {
        const { ends, neighbors } = run(structureExplainers.incidence.typescript, ["ends", "neighbors"]);
        expect(ends(0)).toEqual([0, 1]);
        expect(ends(1)).toEqual([1, 2]);
        expect(neighbors(1)).toEqual([0, 2]);
        expect(neighbors(0)).toEqual([1]);
    });
});
