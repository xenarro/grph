// Graph-wide controls: kind of edges, examples, clearing.

import { App } from "./app";
import { h } from "./dom";
import { presets } from "./presets";

export function mountToolbar(root: HTMLElement, app: App): void {
    const undirected = h("input", { type: "radio", name: "edges", value: "undirected", id: "edges-undirected" });
    const directed = h("input", { type: "radio", name: "edges", value: "directed", id: "edges-directed" });

    const kind = h("fieldset", { class: "segmented" }, [
        h("legend", { class: "visually-hidden" }, ["Edges"]),
        undirected, h("label", { for: "edges-undirected" }, ["Undirected"]),
        directed, h("label", { for: "edges-directed" }, ["Directed"]),
    ]);
    kind.addEventListener("change", () => app.setDirected(directed.checked));

    const example = h("select", { "aria-label": "Load an example graph" }, [
        h("option", { value: "" }, ["Load an example…"]),
        ...presets.map(preset => h("option", { value: preset.id }, [preset.name])),
    ]);
    example.addEventListener("change", () => {
        const preset = presets.find(p => p.id === example.value);
        if (preset) {
            app.load(preset.data);
        }
        example.value = "";
    });

    const clear = h("button", { type: "button" }, ["Clear"]);
    clear.addEventListener("click", () => app.clear());

    root.append(kind, example, clear);

    const update = () => {
        directed.checked = app.model.directed;
        undirected.checked = !app.model.directed;
    };
    app.on(change => change === "graph" && update());
    update();
}
