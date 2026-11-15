import { describe, expect, it } from "vitest";
import { GraphFormat, PARSE_LIMITS, ParsedGraph, parseGraph } from "../src/io/parse";
import { formatGraph, OutputStyle } from "../src/io/format";
import { FormatError, problemText } from "../src/io/problems";

// the edges of a graph as sorted "from to weight" strings, an undirected edge always with the smaller name first
function edgesOf(graph: ParsedGraph): string[] {
    return graph.edges.map(({ from, to, weight }) => {
        const [x, y] = graph.directed || from < to ? [from, to] : [to, from];
        return `${x} ${y} ${weight}`;
    }).sort();
}

function problems(run: () => unknown): string[] {
    try {
        run();
    } catch (error) {
        expect(error).toBeInstanceOf(FormatError);
        return (error as FormatError).problems.map(problem => problemText(problem));
    }
    throw new Error("expected a FormatError");
}

describe("parseGraph: text", () => {
    it("reads an edge list with weights, arrows, commas and a lone point", () => {
        const graph = parseGraph("A B 4\nB -> C 2\nC, D\n# a comment\nE // no edges\n");
        expect(graph.format).toBe("edges");
        expect(graph.points).toEqual(["A", "B", "C", "D", "E"]);
        expect(edgesOf(graph)).toEqual(["A B 4", "B C 2", "C D 1"]);
    });

    it("reads an adjacency list in its different spellings", () => {
        const graph = parseGraph("A: B(4), C\nB -> C 2,\nD: E:3 F=5\nG:", { directed: true });
        expect(graph.format).toBe("list");
        expect(graph.points).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
        expect(edgesOf(graph)).toEqual(["A B 4", "A C 1", "B C 2", "D E 3", "D F 5"]);
    });

    it("reads an undirected list that has every edge twice", () => {
        const graph = parseGraph("A: B(4)\nB: A(4), C\nC: B");
        expect(edgesOf(graph)).toEqual(["A B 4", "B C 1"]);
    });

    it("reads an adjacency matrix with and without names", () => {
        const plain = parseGraph("0 4 0\n4 0 2\n0 2 0");
        expect(plain.format).toBe("matrix");
        expect(plain.points).toEqual(["0", "1", "2"]);
        expect(edgesOf(plain)).toEqual(["0 1 4", "1 2 2"]);

        const named = parseGraph("   A  B  C\nA [0, 4, 0]\nB [4, 0, 2]\nC [0, 2, 0]");
        expect(named.points).toEqual(["A", "B", "C"]);
        expect(edgesOf(named)).toEqual(["A B 4", "B C 2"]);
    });

    it("reads an incidence matrix, undirected and directed", () => {
        const undirected = parseGraph("A 4 0\nB 4 2\nC 0 2");
        expect(undirected.format).toBe("incidence");
        expect(edgesOf(undirected)).toEqual(["A B 4", "B C 2"]);

        const directed = parseGraph("A -4 0\nB 4 -2\nC 0 2", { directed: true });
        expect(edgesOf(directed)).toEqual(["A B 4", "B C 2"]);
    });

    it("guesses an edge list for rows of numbers that are not a matrix", () => {
        const graph = parseGraph("0 1\n1 2\n2 0");
        expect(graph.format).toBe("edges");
        expect(edgesOf(graph)).toEqual(["0 1 1", "0 2 1", "1 2 1"]);
    });

    it("reads the format it is told to", () => {
        expect(parseGraph("0 1\n1 0", { format: "edges" }).format).toBe("edges");
        expect(parseGraph("1 1\n1 1", { format: "incidence" }).points).toEqual(["0", "1"]);
    });

    it("rejects an asymmetric matrix unless it is directed", () => {
        expect(problems(() => parseGraph("0 1\n0 0", { format: "matrix" })).join()).toMatch(/symmetric/);
        expect(edgesOf(parseGraph("0 1\n0 0", { format: "matrix", directed: true }))).toEqual(["0 1 1"]);
    });

    it("rejects a matrix that is not square, has a diagonal or a negative cell", () => {
        expect(problems(() => parseGraph("0 1 0\n1 0 1", { format: "matrix" })).join()).toMatch(/as many columns as rows/);
        expect(problems(() => parseGraph("1 1\n1 0", { format: "matrix" })).join()).toMatch(/itself/);
        expect(problems(() => parseGraph("0 -1\n-1 0", { format: "matrix" })).join()).toMatch(/0 or a weight/);
    });

    it("rejects an incidence column that does not join two points", () => {
        expect(problems(() => parseGraph("1\n1\n1", { format: "incidence" })).join()).toMatch(/column 1 has 3/);
        expect(problems(() => parseGraph("1\n2", { format: "incidence" })).join()).toMatch(/same weight/);
        expect(problems(() => parseGraph("1\n1", { format: "incidence", directed: true })).join()).toMatch(/−weight/);
    });

    it("rejects self-loops, bad weights and conflicting weights, with line numbers", () => {
        const found = problems(() => parseGraph("A A\nA B 0\nA C x\nA D 2\nD A 3"));
        expect(found).toEqual([
            "Line 1: an edge must join two different points; this one goes from A to itself.",
            expect.stringMatching(/^Line 2: "0" can't be a weight/),
            expect.stringMatching(/^Line 3: "x" can't be a weight/),
            expect.stringMatching(/^Line 5: the edge D–A is given twice/),
        ]);
    });

    it("rejects rows of different lengths", () => {
        expect(problems(() => parseGraph("0 1 0\n1 0\n0 1 0", { format: "matrix" })).join()).toMatch(/Line 2: this row has 2 numbers/);
    });

    it("reports at most 8 problems", () => {
        const text = Array.from({ length: 50 }, () => "A A").join("\n");
        expect(problems(() => parseGraph(text))).toHaveLength(8);
    });
});

describe("parseGraph: JSON", () => {
    it("reads an adjacency list as objects, arrays and pairs", () => {
        const graph = parseGraph('{ "A": { "B": 4 }, "B": ["C"], "C": [["D", 2]], "D": [{ "name": "E", "weight": 3 }] }');
        expect(graph.format).toBe("list");
        expect(edgesOf(graph)).toEqual(["A B 4", "B C 1", "C D 2", "D E 3"]);
    });

    it("reads an edge list, with its own directed flag and lone points", () => {
        const graph = parseGraph('{ "directed": true, "points": ["A", "B", "C", "Z"], "edges": [["A", "B", 4], { "from": "B", "to": "C" }] }');
        expect(graph.directed).toBe(true);
        expect(graph.points).toEqual(["A", "B", "C", "Z"]);
        expect(edgesOf(graph)).toEqual(["A B 4", "B C 1"]);
    });

    it("reads matrices, plain or with names", () => {
        expect(edgesOf(parseGraph("[[0, 4], [4, 0]]"))).toEqual(["0 1 4"]);
        expect(edgesOf(parseGraph('{ "points": ["X", "Y"], "matrix": [[0, 4], [4, 0]] }'))).toEqual(["X Y 4"]);
        expect(edgesOf(parseGraph('{ "points": ["X", "Y", "Z"], "incidence": [[4, 0], [4, 2], [0, 2]] }'))).toEqual(["X Y 4", "Y Z 2"]);
    });

    it("takes brackets on several lines that are not JSON as a matrix", () => {
        expect(parseGraph("[0 4]\n[4 0]").format).toBe("matrix");
    });

    it("reports broken JSON", () => {
        expect(problems(() => parseGraph('{ "A": ["B", }')).join()).toMatch(/not valid JSON/);
    });

    it("rejects weights that are not numbers", () => {
        expect(problems(() => parseGraph('{ "A": { "B": "4; alert(1)" } }')).join()).toMatch(/can't be a weight/);
        expect(problems(() => parseGraph('[["A", "B", -1]]')).join()).toMatch(/can't be a weight/);
    });
});

describe("parseGraph: input from outside", () => {
    const hostile = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        "\"><svg/onload=alert(1)>",
        "javascript:alert(1)",
        "A&amp;B",
        "a'b",
        "a`b",
        "a b‮c",
        "a\u0000b",
    ];

    it.each(hostile)("rejects the name %j everywhere", name => {
        const asJson = JSON.stringify(name);
        expect(() => parseGraph(`${name}: B`, { format: "list" })).toThrow(FormatError);
        expect(() => parseGraph(`{ ${asJson}: ["B"] }`)).toThrow(FormatError);
        expect(() => parseGraph(`[[${asJson}, "B"]]`)).toThrow(FormatError);
        expect(() => parseGraph(`{ "points": [${asJson}, "B"], "matrix": [[0, 1], [1, 0]] }`)).toThrow(FormatError);
    });

    it("never lets markup through: every name of a parsed graph is only letters, digits, _ . -", () => {
        const graph = parseGraph("Київ Львів 540\nnode_1 node.2\nα-β γ");
        graph.points.forEach(name => expect(name).toMatch(/^[\p{L}\p{N}_.-]+$/u));
    });

    it.each(["__proto__", "constructor", "prototype"])("rejects the reserved name %s", name => {
        expect(problems(() => parseGraph(`{ "${name}": ["B"] }`)).join()).toMatch(/reserved/);
        expect(problems(() => parseGraph(`A ${name}`)).join()).toMatch(/reserved/);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("does not touch Object.prototype through a __proto__ key", () => {
        expect(() => parseGraph('{ "A": { "__proto__": 1, "polluted": 1 } }')).toThrow(FormatError);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("rejects names longer than 32 characters", () => {
        expect(problems(() => parseGraph(`${"x".repeat(33)} B`)).join()).toMatch(/can't be a point name/);
    });

    it("accepts only text", () => {
        expect(() => parseGraph(42)).toThrow(FormatError);
        expect(() => parseGraph({ A: ["B"] })).toThrow(FormatError);
        expect(() => parseGraph("   \n ")).toThrow(/nothing to convert/);
    });

    it("refuses text over the size limit before reading it", () => {
        expect(problems(() => parseGraph("A B\n".repeat(PARSE_LIMITS.characters / 4 + 1))).join()).toMatch(/too long/);
    });

    it("refuses too many points", () => {
        const text = Array.from({ length: PARSE_LIMITS.points + 1 }, (_, i) => `p${i}`).join("\n");
        expect(problems(() => parseGraph(text)).join()).toMatch(/Too many points/);
    });

    it("refuses a matrix with too many rows", () => {
        const rows = Array.from({ length: PARSE_LIMITS.matrixRows + 1 }, () => "0").join("\n");
        expect(problems(() => parseGraph(rows, { format: "matrix" })).join()).toMatch(/Too many rows/);
    });

    it("refuses absurd weights", () => {
        expect(problems(() => parseGraph("A B 1e300")).join()).toMatch(/can't be a weight/);
        expect(problems(() => parseGraph("A B Infinity")).join()).toMatch(/can't be a weight/);
        expect(problems(() => parseGraph("A B 0x10")).join()).toMatch(/can't be a weight/);
    });
});

describe("formatGraph", () => {
    const formats: GraphFormat[] = ["edges", "list", "matrix", "incidence"];
    const styles: OutputStyle[] = ["text", "json", "typescript"];
    const graphs = {
        undirected: parseGraph("A B 4\nB C 2\nC A 1\nD"),
        directed: parseGraph("A B 4\nB C 2\nC A 1\nD", { directed: true }),
        unweighted: parseGraph("Київ Львів\nЛьвів Одеса"),
        "numbered": parseGraph("0 4 0 1\n4 0 2 0\n0 2 0 0\n1 0 0 0"),
        "oddly named": parseGraph("directed edges 2\nedges matrix\nmatrix incidence 3\npoints directed"),
    };

    describe.each(Object.entries(graphs))("a %s graph", (_, graph) => {
        it.each(formats.flatMap(to => styles.filter(s => s !== "typescript").map(style => [to, style] as const)))(
            "comes back the same from %s as %s",
            (to, style) => {
                const back = parseGraph(formatGraph(graph, to, style), { format: style === "json" ? "auto" : to, directed: graph.directed });
                expect(back.directed).toBe(graph.directed);
                expect(new Set(back.points)).toEqual(new Set(graph.points));
                expect(edgesOf(back)).toEqual(edgesOf(graph));
            },
        );

        it.each(formats)("writes %s as TypeScript that runs", to => {
            const code = formatGraph(graph, to, "typescript").replace(/: [^=]+ =/g, " =");
            expect(() => new Function(code)).not.toThrow();
        });
    });

    it("reads back a matrix whose names are numbers, its first line one shorter than the rest", () => {
        const text = formatGraph(graphs.numbered, "matrix", "text");
        expect(text.split("\n")[0]).toBe("   0  1  2  3");
        expect(parseGraph(text).format).toBe("matrix");
    });

    it("takes keys like \"edges\" or \"directed\" in an adjacency list as points", () => {
        const back = parseGraph(formatGraph(graphs["oddly named"], "list", "json"));
        expect(back.format).toBe("list");
        expect(back.points.sort()).toEqual(["directed", "edges", "incidence", "matrix", "points"]);
    });

    it("writes an adjacency list as text and JSON", () => {
        expect(formatGraph(graphs.undirected, "list", "text")).toBe("A: B(4), C(1)\nB: A(4), C(2)\nC: B(2), A(1)\nD:\n");
        expect(JSON.parse(formatGraph(graphs.undirected, "list", "json"))).toEqual({
            A: { B: 4, C: 1 }, B: { A: 4, C: 2 }, C: { B: 2, A: 1 }, D: {},
        });
        expect(formatGraph(graphs.unweighted, "list", "text")).toBe("Київ: Львів\nЛьвів: Київ, Одеса\nОдеса: Львів\n");
    });

    it("writes an adjacency matrix as a table with names", () => {
        expect(formatGraph(graphs.directed, "matrix", "text")).toBe([
            "   A  B  C  D",
            "A  0  4  0  0",
            "B  0  0  2  0",
            "C  1  0  0  0",
            "D  0  0  0  0",
            "",
        ].join("\n"));
    });

    it("writes an incidence matrix with −weight where a directed edge leaves", () => {
        expect(JSON.parse(formatGraph(graphs.directed, "incidence", "json"))).toEqual({
            directed: true,
            points: ["A", "B", "C", "D"],
            incidence: [[-4, 0, 1], [4, -2, 0], [0, 2, -1], [0, 0, 0]],
        });
    });

    it("writes an empty graph", () => {
        const empty = parseGraph("A");
        formats.forEach(to => styles.forEach(style => expect(formatGraph(empty, to, style)).toBeTypeOf("string")));
        expect(JSON.parse(formatGraph(empty, "incidence", "json")).incidence).toEqual([[]]);
    });

    it("refuses to write a matrix that is too big, but not a list", () => {
        const many = parseGraph(Array.from({ length: 1001 }, (_, i) => `p${i} p${i + 1}`).join("\n"));
        expect(() => formatGraph(many, "matrix", "text")).toThrow(/too many to write out/);
        expect(() => formatGraph(many, "incidence", "text")).toThrow(/too many to write out/);
        expect(formatGraph(many, "list", "text").split("\n")).toHaveLength(1003);
    });

    it("quotes names in JSON and TypeScript, so a name can never end the string", () => {
        const graph = parseGraph("a.b c-d");
        expect(formatGraph(graph, "edges", "typescript")).toContain('["a.b", "c-d", 1]');
    });
});
