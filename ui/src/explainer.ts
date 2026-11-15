// "How it works" for the algorithm chosen in the player: what it is for, the idea, pseudocode
// and TypeScript, what it costs, when to use it, and how to try it here. During a run the
// pseudocode line of the current step is highlighted, so each step can be matched to the code.

import { App } from "./app";
import { h } from "./dom";
import { Explainer, explainers } from "./explainers";

const OPEN_KEY = "grph:explainer-open";

export function mountExplainer(root: HTMLElement, app: App): void {
    let shown: string | null = null;
    let lines: { element: HTMLElement; steps: readonly string[] }[] = [];

    const build = () => {
        shown = app.algorithm;
        const explainer = explainers[app.algorithm];
        lines = [];
        if (!explainer) {
            root.replaceChildren();
            return;
        }
        const box = h("details", { class: "explainer-box", open: readOpen() }, [
            h("summary", {}, [
                h("span", { class: "explainer-kicker" }, ["How it works"]),
                h("h2", {}, [explainer.title]),
            ]),
            ...content(explainer, lines),
        ]);
        box.addEventListener("toggle", () => saveOpen(box.open));
        root.replaceChildren(box);
    };

    const highlight = () => {
        const current = app.step?.line;
        for (const { element, steps } of lines) {
            element.classList.toggle("current", current !== undefined && steps.includes(current));
        }
    };

    app.on(change => {
        if (change === "positions") {
            return;
        }
        if (app.algorithm !== shown) {
            build();
        }
        highlight();
    });
    build();
    highlight();
}

function content(explainer: Explainer, lines: { element: HTMLElement; steps: readonly string[] }[]): HTMLElement[] {
    const pseudocode = h("pre", { class: "pseudocode" }, explainer.pseudocode.map(line => {
        const element = h("span", { class: "line" }, [line.text || " "]);
        lines.push({ element, steps: line.steps ?? [] });
        return element;
    }));

    return [
        h("p", { class: "explainer-question" }, inline(explainer.question)),
        section("What it is for", [bullets(explainer.uses)]),
        section("The idea", explainer.idea.map(paragraph)),
        section("Pseudocode", [
            pseudocode,
            h("p", { class: "explainer-note" }, ["While an algorithm runs, the line of the current step is highlighted."]),
            explainer.pseudocodeNote ? paragraph(explainer.pseudocodeNote) : null,
        ]),
        section("In TypeScript", [typescript(explainer.typescript)]),
        section("What it costs", explainer.cost.map(paragraph)),
        h("div", { class: "explainer-columns" }, [
            section("Use it when", [bullets(explainer.useWhen)]),
            section("Don't use it when", [bullets(explainer.avoidWhen)]),
        ]),
        section("Try it here", [bullets(explainer.tryIt)]),
    ];
}

export function section(title: string, children: (HTMLElement | null)[]): HTMLElement {
    return h("section", { class: "explainer-section" }, [h("h3", {}, [title]), ...children]);
}

export const paragraph = (text: string) => h("p", {}, inline(text));
export const bullets = (items: readonly string[]) => h("ul", {}, items.map(item => h("li", {}, inline(item))));

// text with `code` in backticks
export function inline(text: string): (string | HTMLElement)[] {
    return text.split("`").map((part, i) => i % 2 === 1 ? h("code", {}, [part]) : part);
}

// TypeScript with its comments set apart
export function typescript(code: string): HTMLElement {
    return h("pre", { class: "code" }, [h("code", {}, code.split("\n").flatMap(line => {
        const comment = line.indexOf("//");
        return comment === -1
            ? [line, "\n"]
            : [line.slice(0, comment), h("span", { class: "comment" }, [line.slice(comment)]), "\n"];
    }))]);
}

// open unless it was closed before; the browser may not allow storage
function readOpen(): boolean {
    try {
        return localStorage.getItem(OPEN_KEY) !== "closed";
    } catch {
        return true;
    }
}

function saveOpen(open: boolean): void {
    try {
        localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
    } catch {
        // the choice just won't be remembered
    }
}
