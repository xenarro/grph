// The header: the subtitle, links to the three parts of the page (the visualizer, the converter and
// the docs) with the one in view marked, and the language select.

import { App } from "./app";
import { h } from "./dom";
import { Lang, LANGUAGES, texts } from "./i18n";

const PARTS = ["visualizer", "converter", "docs"] as const;
const TARGETS: Record<(typeof PARTS)[number], string> = { visualizer: "visualizer", converter: "convert", docs: "docs" };

export function mountNav(tagline: HTMLElement, nav: HTMLElement, end: HTMLElement, app: App): void {
    const links = PARTS.map(part => h("a", { href: `#${TARGETS[part]}` }));
    nav.append(...links);

    // each language's name is written in that language
    const language = h("select", {}, LANGUAGES.map(({ id, name }) => h("option", { value: id, lang: id, selected: id === app.lang }, [name])));
    language.addEventListener("change", () => app.setLang(language.value as Lang));
    end.append(language);

    let shown = "";
    const relabel = () => {
        if (shown === app.lang) {
            return;
        }
        shown = app.lang;
        const t = texts[app.lang];
        tagline.textContent = t.tagline;
        nav.setAttribute("aria-label", t.sections);
        PARTS.forEach((part, i) => links[i].textContent = t.nav[part]);
        language.setAttribute("aria-label", t.language);
        tagline.lang = nav.lang = app.lang;
    };
    app.on(change => change === "view" && relabel());
    relabel();

    // the part in view is the last one whose top has passed a third of the way down the window
    const sections = PARTS.map(part => document.getElementById(TARGETS[part])!);
    let frame = 0;
    const mark = () => {
        frame = 0;
        const line = window.innerHeight / 3;
        let current = 0;
        sections.forEach((section, i) => {
            if (section.getBoundingClientRect().top <= line) {
                current = i;
            }
        });
        links.forEach((link, i) => i === current ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current"));
    };
    const schedule = () => {
        if (!frame) {
            frame = requestAnimationFrame(mark);
        }
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mark();
}
