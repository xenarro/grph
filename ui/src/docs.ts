// The docs under the app, across the whole page: how the algorithm chosen above works, and how
// the three structures store a graph and compare on the graph on the page. The header links here.

import { App } from "./app";
import { h } from "./dom";
import { mountExplainer } from "./explainer";
import { texts } from "./i18n";
import { comparisonView, STRUCTURES, structureExplainerView } from "./structure-guide";

export function mountDocs(root: HTMLElement, app: App): void {
    const title = h("h2", { id: "docs-title" });
    const intro = h("p", { class: "docs-intro" });
    const algorithm = h("article", { class: "doc explainer" });
    const structures = h("article", { class: "doc" });
    root.append(h("header", { class: "docs-head" }, [title, intro]), h("div", { class: "docs-columns" }, [algorithm, structures]));
    mountExplainer(algorithm, app);

    // the structures' part changes with the graph and the language, not with every step of a run
    let shown = "";
    let graphChanges = 0;
    const render = () => {
        const key = `${app.lang} ${graphChanges}`;
        if (key === shown) {
            return;
        }
        shown = key;
        const t = texts[app.lang];
        root.lang = app.lang;
        title.textContent = t.docsTitle;
        intro.textContent = t.docsIntro;
        structures.replaceChildren(
            h("p", { class: "doc-kicker" }, [t.theStructures]),
            comparisonView(app),
            ...STRUCTURES.map(id => structureExplainerView(id, app.lang)),
        );
    };
    app.on(change => {
        if (change === "graph") {
            graphChanges++;
        }
        if (change !== "positions") {
            render();
        }
    });
    render();
}
