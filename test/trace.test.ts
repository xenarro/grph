import { describe, expect, it } from "vitest";
import { edgeKey, nameList, Step, Tracer } from "../src/algorithms/trace";

// a plain copy of a step, which stays the same when the trace moves on
const copy = (step: Step) => ({
    message: step.message,
    focus: step.focus,
    points: Object.fromEntries(step.points),
    edges: Object.fromEntries(step.edges),
    labels: Object.fromEntries(step.labels),
    lists: step.lists.map(({ name, items }) => ({ name, items: [...items] })),
});

describe("Tracer and Trace", () => {
    const record = () => new Tracer(false)
        .list("Stack").list("Order", { newestFirst: true })
        .markPoint("A", "current").add("Stack", "A").step("first", { point: "A" })
        .markPoint("A", "active").markPoint("B", "current").markEdge("B", "A", "tree").add("Stack", "B").step("second")
        .markPoint("B", "done").label("B", "1").removeNewest("Stack").add("Order", "B").step("third")
        .markPoint("A", "done").removeNewest("Stack").add("Order", "A").step("fourth")
        .trace();

    const expected = [
        { message: "first", focus: { point: "A" }, points: { A: "current" }, edges: {}, labels: {},
          lists: [{ name: "Stack", items: ["A"] }, { name: "Order", items: [] }] },
        { message: "second", focus: {}, points: { A: "active", B: "current" }, edges: { [edgeKey("A", "B", false)]: "tree" }, labels: {},
          lists: [{ name: "Stack", items: ["A", "B"] }, { name: "Order", items: [] }] },
        { message: "third", focus: {}, points: { A: "active", B: "done" }, edges: { [edgeKey("A", "B", false)]: "tree" }, labels: { B: "1" },
          lists: [{ name: "Stack", items: ["A"] }, { name: "Order", items: ["B"] }] },
        { message: "fourth", focus: {}, points: { A: "done", B: "done" }, edges: { [edgeKey("A", "B", false)]: "tree" }, labels: { B: "1" },
          lists: [{ name: "Stack", items: [] }, { name: "Order", items: ["A", "B"] }] },
    ];

    it("replays every step forwards", () => {
        const trace = record();
        expect(trace.length).toBe(4);
        expected.forEach((step, i) => expect(copy(trace.at(i))).toEqual(step));
    });

    it("undoes the changes when moving backwards and jumps in both directions", () => {
        const trace = record();
        for (const i of [3, 0, 2, 1, 3, 0, -1, -4]) {
            expect(copy(trace.at(i))).toEqual(expected.at(i));
        }
    });

    it("shows the newest item of a newest-first list first", () => {
        const order = record().at(-1).lists[1];
        expect(order.newestFirst).toBe(true);
        expect(order.items).toEqual(["A", "B"]);
    });

    it("keeps the steps past the limit as one last step with combined changes", () => {
        const tracer = new Tracer(false, 2).list("Visited");
        tracer.markPoint("A", "current").add("Visited", "A").step("one");
        tracer.markPoint("A", "done").step("two");
        // past the limit: these three steps become one
        tracer.markPoint("B", "current").add("Visited", "B").step("three");
        tracer.markPoint("B", "active").markEdge("A", "B", "tree").step("four", { point: "B" });
        tracer.markPoint("B", "done").markPoint("A", "result").step("five");
        const trace = tracer.trace();

        expect(trace.length).toBe(3);
        const last = copy(trace.at(2));
        expect(last.message).toBe("3 more steps, not kept one by one. five");
        expect(last.points).toEqual({ A: "result", B: "done" });
        expect(last.edges).toEqual({ [edgeKey("A", "B", false)]: "tree" });
        expect(last.lists).toEqual([{ name: "Visited", items: ["A", "B"] }]);

        // and back: the combined changes undo to the state after step two
        expect(copy(trace.at(1))).toMatchObject({ points: { A: "done" }, edges: {}, lists: [{ name: "Visited", items: ["A"] }] });
    });

    it("inserts and removes items anywhere in a list, and undoes it", () => {
        const trace = new Tracer(false).list("Queue")
            .add("Queue", "B").add("Queue", "D").step("one")
            .insert("Queue", 1, "C").insert("Queue", 0, "A").step("two")
            .removeAt("Queue", 0).removeAt("Queue", 1).step("three")
            .trace();
        const items = (i: number) => [...trace.at(i).lists[0].items];
        expect(items(0)).toEqual(["B", "D"]);
        expect(items(1)).toEqual(["A", "B", "C", "D"]);
        expect(items(2)).toEqual(["B", "D"]);
        expect(items(1)).toEqual(["A", "B", "C", "D"]);
        expect(items(0)).toEqual(["B", "D"]);
        expect(() => new Tracer(false).list("Q").insert("Q", 1, "A")).toThrow(/Can't insert/);
        expect(() => new Tracer(false).list("Q").removeAt("Q", 0)).toThrow(/Can't remove/);
    });

    it("throws for a step that does not exist", () => {
        const trace = record();
        expect(() => trace.at(4)).toThrow(RangeError);
        expect(() => trace.at(-5)).toThrow(RangeError);
    });

    it("rejects list mistakes while recording", () => {
        expect(() => new Tracer(false).list("Stack").list("Stack")).toThrow(/already exists/);
        expect(() => new Tracer(false).list("Stack").removeNewest("Stack")).toThrow(/empty/);
        expect(() => new Tracer(false).add("Nope", "A")).toThrow(/was not created/);
    });

    it("uses one key for both directions of an undirected edge only", () => {
        expect(edgeKey("A", "B", false)).toBe(edgeKey("B", "A", false));
        expect(edgeKey("A", "B", true)).not.toBe(edgeKey("B", "A", true));
    });

    it("reads back edge marks in either direction when undirected", () => {
        const tracer = new Tracer(false).markEdge("A", "B", "tree");
        expect(tracer.edgeMark("B", "A")).toBe("tree");
    });

    it("cuts a long list of names in a message", () => {
        expect(nameList(["A", "B", "C"])).toBe("A, B, C");
        const many = Array.from({ length: 25 }, (_, i) => "P" + i);
        expect(nameList(many, ", ", 3)).toBe("P0, P1, P2, … (22 more)");
    });
});
