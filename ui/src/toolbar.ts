// Graph-wide controls: kind of edges, examples, clearing.

import { App } from "./app";
import { h } from "./dom";
import { GENERATED_SIZES } from "./generate";
import { Lang, LANGUAGES, texts } from "./i18n";
import { bigExamples, presets } from "./presets";

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
        h("optgroup", { label: "Big graphs" }, bigExamples.map(big => h("option", { value: big.id }, [big.name]))),
    ]);
    example.addEventListener("change", () => {
        app.loadExample(example.value);
        example.value = "";
    });

    const random = h("select", { "aria-label": "Generate a random graph" }, [
        h("option", { value: "" }, ["Random graph…"]),
        ...GENERATED_SIZES.map(size => h("option", { value: size }, [`${size.toLocaleString("en-US")} points`])),
    ]);
    random.addEventListener("change", () => {
        if (random.value) {
            app.generate(Number(random.value));
        }
        random.value = "";
    });

    const clear = h("button", { type: "button" }, ["Clear"]);
    clear.addEventListener("click", () => app.clear());

    // the language of the explanations; each name is written in its own language
    const language = h("select", { "aria-label": texts[app.lang].explanationsLanguage },
        LANGUAGES.map(({ id, name }) => h("option", { value: id, lang: id, selected: id === app.lang }, [name])));
    language.addEventListener("change", () => {
        app.setLang(language.value as Lang);
        language.setAttribute("aria-label", texts[app.lang].explanationsLanguage);
    });

    root.append(kind, example, random, clear, language);

    const update = () => {
        directed.checked = app.model.directed;
        undirected.checked = !app.model.directed;
    };
    app.on(change => change === "graph" && update());
    update();
}
