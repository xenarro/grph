// "How it works" for the algorithm chosen in the player: what it is for, the idea, pseudocode
// and TypeScript, what it costs, when to use it, and how to try it here. During a run the
// pseudocode line of the current step is highlighted, so each step can be matched to the code.

import { App } from "./app";
import { h } from "./dom";
import { algorithmCode, Explainer, explainers } from "./explainers";
import { Texts, texts } from "./i18n";

const OPEN_KEY = "grph:explainer-open";

export function mountExplainer(root: HTMLElement, app: App): void {
    // what is on the page: the algorithm and the language
    let shown = "";
    let lines: { element: HTMLElement; steps: readonly string[] }[] = [];

    const build = () => {
        shown = `${app.algorithm} ${app.lang}`;
        const explainer = explainers[app.lang][app.algorithm];
        const t = texts[app.lang];
        lines = [];
        if (!explainer) {
            root.replaceChildren();
            return;
        }
        const box = h("details", { class: "explainer-box", open: readOpen(), lang: app.lang }, [
            h("summary", { "data-show": t.show, "data-hide": t.hide }, [
                h("span", { class: "explainer-kicker" }, [t.howItWorks]),
                h("h2", {}, [explainer.title]),
            ]),
            ...content(explainer, algorithmCode[app.algorithm], t, lines),
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
        if (`${app.algorithm} ${app.lang}` !== shown) {
            build();
        }
        highlight();
    });
    build();
    highlight();
}

function content(explainer: Explainer, code: string, t: Texts, lines: { element: HTMLElement; steps: readonly string[] }[]): HTMLElement[] {
    const pseudocode = h("pre", { class: "pseudocode" }, explainer.pseudocode.map(line => {
        const element = h("span", { class: "line" }, [line.text || " "]);
        lines.push({ element, steps: line.steps ?? [] });
        return element;
    }));

    return [
        h("p", { class: "explainer-question" }, inline(explainer.question)),
        section(t.whatFor, [bullets(explainer.uses)]),
        section(t.idea, explainer.idea.map(paragraph)),
        section(t.pseudocode, [
            pseudocode,
            h("p", { class: "explainer-note" }, [t.pseudocodeNote]),
            explainer.pseudocodeNote ? paragraph(explainer.pseudocodeNote) : null,
        ]),
        section(t.inTypeScript, [typescript(code)]),
        section(t.costs, explainer.cost.map(paragraph)),
        h("div", { class: "explainer-columns" }, [
            section(t.useWhen, [bullets(explainer.useWhen)]),
            section(t.avoidWhen, [bullets(explainer.avoidWhen)]),
        ]),
        section(t.tryIt, [bullets(explainer.tryIt)]),
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
