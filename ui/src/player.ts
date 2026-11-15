// Runs an algorithm on the chosen representation and replays its steps.

import { algorithms, getAlgorithm } from "../../src/algorithms";
import { Trace, TraceList } from "../../src/algorithms/trace";
import { App } from "./app";
import { classes, h } from "./dom";
import { RepresentationId, representationNames } from "./model";

const SPEEDS = [
    { label: "Slow", ms: 1600 },
    { label: "Normal", ms: 900 },
    { label: "Fast", ms: 350 },
];

export function mountPlayer(root: HTMLElement, app: App): void {
    let steps: Trace | null = null;
    let index = 0;
    let timer: number | undefined;
    let note = "";

    // ---- setup row

    const algorithm = h("select", { id: "algorithm" }, algorithms.map(a => h("option", { value: a.id }, [a.name])));
    const start = h("select", { id: "start" });
    const target = h("select", { id: "target" });
    const readFrom = h("select", { id: "read-from" });
    const run = h("button", { type: "button", class: "primary" }, ["Run"]);

    const field = (label: string, control: HTMLElement) =>
        h("div", { class: "field" }, [h("label", { for: control.id }, [label]), control]);
    const startField = field("Start", start);
    const targetField = field("Target", target);

    const description = h("p", { class: "algorithm-description" });
    const notice = h("p", { class: "notice", role: "status" });

    // ---- transport row

    const first = iconButton("First step", "M5 4h2v12H5z M15 4v12L8 10z");
    const back = iconButton("Previous step", "M14 4v12L6 10z");
    const play = h("button", { type: "button", class: "play" }, ["Play"]);
    const forward = iconButton("Next step", "M6 4v12l8-6z");
    const last = iconButton("Last step", "M13 4h2v12h-2z M5 4v12l7-6z");
    const slider = h("input", { type: "range", min: "0", value: "0", "aria-label": "Step" });
    const counter = h("span", { class: "counter" });
    const speed = h("select", { "aria-label": "Speed" }, SPEEDS.map((s, i) => h("option", { value: s.ms, selected: i === 1 }, [s.label])));

    const message = h("p", { class: "step-message", "aria-live": "polite" });
    const lists = h("div", { class: "trace-lists" });
    const transport = h("div", { class: "transport" }, [first, back, play, forward, last, slider, counter, speed]);
    const replay = h("div", { class: "replay" }, [transport, message, lists, legend()]);

    root.append(
        h("div", { class: "setup" }, [
            field("Algorithm", algorithm), startField, targetField, field("Read neighbors from", readFrom), run,
        ]),
        description,
        notice,
        replay,
    );

    // ---- behaviour

    const selected = () => getAlgorithm(algorithm.value);

    const stop = () => {
        window.clearInterval(timer);
        timer = undefined;
        play.textContent = "Play";
    };

    const clearRun = (reason = "") => {
        stop();
        steps = null;
        note = reason;
        if (app.step) {
            app.showStep(null);
        }
        render();
    };

    const show = (i: number) => {
        if (!steps) {
            return;
        }
        index = Math.max(0, Math.min(steps.length - 1, i));
        app.showStep(steps.at(index));
        render();
    };

    const fillPointOptions = () => {
        const points = app.model.points();
        const keep = (select: HTMLSelectElement, fallback: string) =>
            points.includes(select.value) ? select.value : fallback;
        const startValue = keep(start, points[0] ?? "");
        const targetValue = keep(target, "");
        start.replaceChildren(...points.map(p => h("option", { value: p }, [p])));
        target.replaceChildren(h("option", { value: "" }, ["None"]), ...points.map(p => h("option", { value: p }, [p])));
        start.value = startValue;
        target.value = targetValue;
    };

    // a matrix the graph is too big for can't be chosen
    const fillReadFromOptions = () => {
        readFrom.replaceChildren(...(Object.keys(representationNames) as RepresentationId[]).map(id => {
            const available = app.model.representation(id) !== null;
            return h("option", { value: id, disabled: !available }, [
                representationNames[id] + (available ? "" : " (graph too big)"),
            ]);
        }));
        readFrom.value = app.readFrom;
    };

    // why the selected algorithm cannot run on the current graph, if it cannot
    const blocker = (): string => {
        const chosen = selected();
        if (app.model.points().length === 0) {
            return "Add points to the drawing first.";
        }
        if (chosen.directedOnly && !app.model.directed) {
            return `${chosen.name} needs a directed graph. Switch to Directed above or load the Getting dressed example.`;
        }
        return "";
    };

    const render = () => {
        const chosen = selected();
        description.textContent = chosen.description;
        startField.hidden = chosen.start === "none";
        targetField.hidden = chosen.target === "none";

        const blocked = blocker();
        run.disabled = blocked !== "";
        notice.textContent = blocked || note;

        replay.hidden = steps === null;
        if (!steps) {
            return;
        }
        const step = steps.at(index);
        const atStart = index === 0;
        const atEnd = index === steps.length - 1;
        first.disabled = back.disabled = atStart;
        forward.disabled = last.disabled = atEnd;
        slider.max = String(steps.length - 1);
        slider.value = String(index);
        counter.textContent = `Step ${index + 1} of ${steps.length}`;
        message.textContent = step.message;
        lists.replaceChildren(...step.lists.map(list => h("div", { class: "trace-list" }, [
            h("span", { class: "trace-list-name" }, [list.name]),
            list.items.length === 0
                ? h("span", { class: "hint" }, ["empty"])
                : h("ol", { class: classes({ chips: true, stack: list.name === "Stack" }) }, chips(list)),
        ])));
    };

    run.addEventListener("click", () => {
        stop();
        note = "";
        try {
            steps = selected().run(app.model.representation(app.readFrom) ?? app.model.list, {
                start: start.value || undefined,
                target: target.value || undefined,
            });
            show(0);
        } catch (error) {
            clearRun(error instanceof Error ? error.message : String(error));
        }
    });

    play.addEventListener("click", () => {
        if (!steps) {
            return;
        }
        if (timer !== undefined) {
            stop();
            return;
        }
        if (index === steps.length - 1) {
            show(0);
        }
        play.textContent = "Pause";
        timer = window.setInterval(() => {
            if (steps && index < steps.length - 1) {
                show(index + 1);
            }
            if (!steps || index >= steps.length - 1) {
                stop();
            }
        }, Number(speed.value));
    });

    speed.addEventListener("change", () => {
        if (timer !== undefined) {
            stop();
            play.click();
        }
    });

    first.addEventListener("click", () => { stop(); show(0); });
    back.addEventListener("click", () => { stop(); show(index - 1); });
    forward.addEventListener("click", () => { stop(); show(index + 1); });
    last.addEventListener("click", () => { stop(); show(Infinity); });
    slider.addEventListener("input", () => { stop(); show(Number(slider.value)); });

    algorithm.addEventListener("change", () => clearRun());
    start.addEventListener("change", () => clearRun());
    target.addEventListener("change", () => clearRun());
    readFrom.addEventListener("change", () => {
        app.setReadFrom(readFrom.value as RepresentationId);
        clearRun(steps ? "Run again to read the neighbors from the other representation. The visiting order can change." : "");
    });

    // left and right arrows step through a run, space plays and pauses,
    // as long as no control has the keyboard focus
    document.addEventListener("keydown", event => {
        const active = document.activeElement;
        if (!steps || (active && active !== document.body && active.id !== "canvas")) {
            return;
        }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            back.click();
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            forward.click();
        } else if (event.key === " ") {
            event.preventDefault();
            play.click();
        }
    });

    app.on(change => {
        if (change === "graph") {
            fillPointOptions();
            fillReadFromOptions();
            clearRun(steps ? "The graph changed. Run the algorithm again." : "");
        }
    });

    fillPointOptions();
    fillReadFromOptions();
    render();
}

// A list of a big graph can hold thousands of points: only the newest ones are shown as chips,
// and one more chip says how many are left out.
const MAX_CHIPS = 30;
function chips({ items, newestFirst }: TraceList): HTMLElement[] {
    const shown = newestFirst ? items.slice(0, MAX_CHIPS) : items.slice(-MAX_CHIPS);
    const chips = shown.map(item => h("li", {}, [item]));
    const hidden = items.length - shown.length;
    if (hidden > 0) {
        const more = h("li", { class: "more" }, [`… ${hidden.toLocaleString("en-US")} more`]);
        newestFirst ? chips.push(more) : chips.unshift(more);
    }
    return chips;
}

function iconButton(label: string, path: string): HTMLButtonElement {
    const button = h("button", { type: "button", class: "icon", "aria-label": label, title: label });
    button.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="${path}" fill="currentColor"/></svg>`;
    return button;
}

function legend(): HTMLElement {
    const item = (swatch: string, text: string) =>
        h("li", {}, [h("span", { class: `swatch ${swatch}`, "aria-hidden": "true" }), text]);
    return h("ul", { class: "legend", "aria-label": "Legend" }, [
        item("point", "not reached"),
        item("point active", "reached"),
        item("point done", "finished"),
        item("point current", "being read"),
        item("line tree", "edge followed"),
        item("line skipped", "edge skipped"),
        item("point result", "result"),
        item("point cycle", "cycle"),
    ]);
}
