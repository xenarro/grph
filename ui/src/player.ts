// Runs an algorithm on the chosen representation and replays its steps.

import { algorithms, getAlgorithm } from "../../src/algorithms";
import { Trace, TraceList } from "../../src/algorithms/trace";
import { App } from "./app";
import { classes, h } from "./dom";
import { texts } from "./i18n";
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
    // A select with a hundred thousand options would be slow and useless,
    // so for a big graph the start and target are typed in instead.
    const start = new PointField("start", "Start", false);
    const target = new PointField("target", "Target", true);
    const readFrom = h("select", { id: "read-from" });
    const run = h("button", { type: "button", class: "primary" }, ["Run"]);

    const field = (label: string, control: HTMLElement) =>
        h("div", { class: "field" }, [h("label", { for: control.id }, [label]), control]);
    const startField = start.field;
    const targetField = target.field;

    const description = h("p", { class: "algorithm-description" });

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
    const replay = h("div", { class: "replay" }, [transport, message, lists]);

    root.append(
        h("div", { class: "setup" }, [
            field("Algorithm", algorithm), startField, targetField, field("Read neighbors from", readFrom), run,
        ]),
        description,
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
        start.fill(points, app.start ?? "");
        target.fill(points, app.target ?? "");
    };

    // The start, target or algorithm was chosen elsewhere, for example on a point in the drawing:
    // show it here. A run with other points or another algorithm is out of date.
    const showChoices = () => {
        const changed = start.value() !== (app.start ?? "") || target.value() !== (app.target ?? "");
        start.setValue(app.start ?? "");
        target.setValue(app.target ?? "");
        if (algorithm.value !== app.algorithm) {
            algorithm.value = app.algorithm;
            clearRun();
        } else if (changed && steps) {
            clearRun("The start or target changed. Run the algorithm again.");
        }
    };

    // a matrix the graph is too big for can't be chosen
    const fillReadFromOptions = () => {
        readFrom.replaceChildren(...(Object.keys(representationNames) as RepresentationId[]).map(id => {
            const available = app.model.representation(id) !== null;
            return h("option", { value: id, disabled: !available }, [
                representationNames[id] + (available ? "" : " (too big)"),
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
        description.textContent = texts[app.lang].algorithmDescriptions[chosen.id] ?? chosen.description;
        description.lang = app.lang;
        // fields an algorithm doesn't use are turned off, not hidden, so the row keeps its shape
        start.setDisabled(chosen.start === "none");
        target.setDisabled(chosen.target === "none");

        const blocked = blocker();
        run.disabled = blocked !== "";

        // The replay is always there, so nothing on the page moves when a run starts or ends.
        // Without a run its controls are off and the message says what to do.
        message.classList.toggle("idle", !steps);
        if (!steps) {
            first.disabled = back.disabled = play.disabled = forward.disabled = last.disabled = slider.disabled = true;
            slider.max = "0";
            slider.value = "0";
            counter.textContent = "No run yet";
            message.textContent = blocked || note || "Press Run to watch the algorithm step by step.";
            lists.replaceChildren();
            return;
        }
        play.disabled = slider.disabled = false;
        const step = steps.at(index);
        const atStart = index === 0;
        const atEnd = index === steps.length - 1;
        first.disabled = back.disabled = atStart;
        forward.disabled = last.disabled = atEnd;
        slider.max = String(steps.length - 1);
        slider.value = String(index);
        counter.textContent = `Step ${index + 1} of ${steps.length}`;
        message.textContent = step.message;
        // one row per list, its size by its name; a long list shows the end that matters and cuts the rest
        lists.replaceChildren(...step.lists.map(list => h("div", { class: "trace-list" }, [
            h("span", { class: "trace-list-name" }, [list.name, h("span", { class: "trace-list-count" }, [list.items.length.toLocaleString("en-US")])]),
            list.items.length === 0
                ? h("span", { class: "hint" }, ["empty"])
                : h("ol", { class: classes({ chips: true, stack: list.name === "Stack", "keep-back": list.keep === "back" }) }, chips(list)),
        ])));
    };

    run.addEventListener("click", () => {
        stop();
        note = "";
        try {
            steps = selected().run(app.model.representation(app.readFrom) ?? app.model.list, {
                start: start.value() || undefined,
                target: target.value() || undefined,
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

    algorithm.addEventListener("change", () => {
        app.setAlgorithm(algorithm.value);
        clearRun();
    });
    // a typed name that is not a point is not taken: the field goes back to the chosen point
    const missing = (name: string) => name !== "" && !app.model.list.hasPoint(name) ? `There is no point ${name}.` : "";
    start.onChange(() => {
        const note = missing(start.value());
        app.chooseStart(start.value());
        clearRun(note);
    });
    target.onChange(() => {
        const note = missing(target.value());
        app.chooseTarget(target.value() || null);
        clearRun(note);
    });
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
        } else if (change === "view") {
            showChoices();
            // the description follows the language of the explanations
            render();
        }
    });

    algorithm.value = app.algorithm;
    fillPointOptions();
    fillReadFromOptions();
    render();
}

const MAX_OPTIONS = 1_000;

// A labelled choice of a point: a select for a small graph, a text box for a big one.
class PointField {
    readonly field: HTMLElement;
    private readonly select: HTMLSelectElement;
    private readonly input: HTMLInputElement;
    private readonly label: HTMLLabelElement;
    private typed = false;

    constructor(id: string, label: string, private readonly optional: boolean) {
        this.select = h("select", { id });
        this.input = h("input", {
            id: `${id}-name`, type: "text", autocomplete: "off", spellcheck: "false",
            placeholder: optional ? "None" : "Point name", size: 8, hidden: true,
        });
        this.label = h("label", { for: id }, [label]);
        this.field = h("div", { class: "field" }, [this.label, this.select, this.input]);
    }

    // shows the graph's points, with `value` chosen
    fill(points: string[], value: string): void {
        this.typed = points.length > MAX_OPTIONS;
        this.select.hidden = this.typed;
        this.input.hidden = !this.typed;
        this.label.htmlFor = this.typed ? this.input.id : this.select.id;
        if (this.typed) {
            this.select.replaceChildren();
        } else {
            this.select.replaceChildren(
                ...(this.optional ? [h("option", { value: "" }, ["None"])] : []),
                ...points.map(p => h("option", { value: p }, [p])),
            );
        }
        this.setValue(value);
    }

    setValue(value: string): void {
        if (this.typed) {
            this.input.value = value;
        } else {
            this.select.value = value;
        }
    }

    value(): string {
        return this.typed ? this.input.value.trim() : this.select.value;
    }

    setDisabled(disabled: boolean): void {
        this.select.disabled = disabled;
        this.input.disabled = disabled;
        this.field.classList.toggle("off", disabled);
    }

    onChange(listener: () => void): void {
        this.select.addEventListener("change", listener);
        this.input.addEventListener("change", listener);
    }
}

// A list of a big graph can hold thousands of points: only the end that matters is made into chips,
// as many as can fill a row.
const MAX_CHIPS = 30;
function chips({ items, keep }: TraceList): HTMLElement[] {
    const shown = keep === "front" ? items.slice(0, MAX_CHIPS) : items.slice(-MAX_CHIPS);
    return shown.map(item => h("li", {}, [item]));
}

function iconButton(label: string, path: string): HTMLButtonElement {
    const button = h("button", { type: "button", class: "icon", "aria-label": label, title: label });
    button.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="${path}" fill="currentColor"/></svg>`;
    return button;
}
