import { describe, expect, it } from "vitest";
import { algorithms } from "../src/algorithms";
import { count, formatBytes, plural, texts } from "../ui/src/i18n";
import { structureExplainers } from "../ui/src/structure-explainers";

describe("two languages", () => {
    it("pick the Ukrainian word for a number: 1 вершина, 2 вершини, 5 вершин, 21 вершина, 25 вершин", () => {
        const forms = { one: "вершина", few: "вершини", many: "вершин" };
        expect([1, 2, 4, 5, 11, 12, 21, 22, 25, 101].map(n => plural(n, "uk", forms))).toEqual([
            "вершина", "вершини", "вершини", "вершин", "вершин", "вершин", "вершина", "вершини", "вершин", "вершина",
        ]);
    });

    it("write numbers and sizes the way each language does", () => {
        expect(count(1_000_000, "en")).toBe("1,000,000");
        expect(count(1_000_000, "uk")).toMatch(/^1\s000\s000$/);
        expect(count(33.3, "uk")).toBe("33,3");
        expect(formatBytes(392, "en")).toBe("392\u00a0bytes");
        expect(formatBytes(392, "uk")).toBe("392\u00a0байти");
        expect(formatBytes(1_300, "uk")).toBe("1,3\u00a0КБ");
        expect(formatBytes(80_000_000_000, "en")).toBe("80\u00a0GB");
    });

    it("describe every algorithm in Ukrainian", () => {
        for (const { id } of algorithms) {
            expect(texts.uk.algorithmDescriptions[id]).toBeTruthy();
        }
    });

    it("explain every structure as fully in both languages", () => {
        for (const id of ["matrix", "list", "incidence"] as const) {
            for (const part of ["idea", "goodFor", "badFor"] as const) {
                expect(structureExplainers.uk[id][part].length).toBe(structureExplainers.en[id][part].length);
            }
        }
    });

    it("count in the Ukrainian sentences", () => {
        expect(texts.uk.listCost(1, 2)).toBe("1 список, у них разом 2 записи.");
        expect(texts.uk.matrixCost(7)).toBe("7 × 7 = 49 клітинок, хоч би скільки було ребер.");
        expect(texts.uk.flatArray(49)).toBe("Зберігається як один плаский масив із 49 чисел");
    });
});
