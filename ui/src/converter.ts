// The converter, under the app: a graph pasted in as text or JSON is read and checked by src/io/parse.ts
// and written out as another structure by src/io/format.ts. Nothing here is drawn.
// Whatever is pasted reaches the page only as the value of a textarea or the text of an element, never
// as markup, and the parser lets through only names made of letters, digits, "_", "." and "-".

import { formatGraph, OutputStyle } from "../../src/io/format";
import { GraphFormat, ParsedGraph, parseGraph } from "../../src/io/parse";
import { FormatError, problemText } from "../../src/io/problems";
import { App } from "./app";
import { converterTexts } from "./converter-texts";
import { h } from "./dom";
import { formatBytes } from "./i18n";

const FORMATS: readonly GraphFormat[] = ["list", "matrix", "incidence", "edges"];
const STYLES: readonly OutputStyle[] = ["text", "json", "typescript"];
// the parser takes up to 4 million characters, and most text has at most two bytes a character;
// a bigger file is not even read
const MAX_FILE_BYTES = 8_000_000;
// the examples are this graph, written in each format
const EXAMPLE = "A B 4\nA C 2\nB C 1\nB D 5\nC D 8\nC E 10\nD E 2\nD F 6\nE F 3\n";
const FILE_NAMES: Record<GraphFormat, string> = { edges: "edge-list", list: "adjacency-list", matrix: "adjacency-matrix", incidence: "incidence-matrix" };
const EXTENSIONS: Record<OutputStyle, string> = { text: "txt", json: "json", typescript: "ts" };

export function mountConverter(root: HTMLElement, app: App): void {
    const title = h("h2", { id: "convert-title" });
    const intro = h("p", { class: "docs-intro" });

    // ---- the graph pasted in
    const inputLabel = h("label", { for: "convert-input", class: "pane-title" });
    const from = h("select", { id: "convert-from" });
    const fromLabel = h("label", { for: "convert-from" });
    const directed = h("input", { type: "checkbox", id: "convert-directed" });
    const directedLabel = h("label", { for: "convert-directed" });
    const input = h("textarea", {
        id: "convert-input", class: "convert-text", spellcheck: "false", autocapitalize: "off", autocomplete: "off", wrap: "off",
    });
    const tryLabel = h("span", { class: "convert-try" });
    const examples = FORMATS.map(format => {
        const button = h("button", { type: "button", class: "small" });
        button.addEventListener("click", () => {
            input.value = formatGraph(parseGraph(EXAMPLE), format, "text");
            from.value = "auto";
            directed.checked = false;
            if (to.value === format) {
                to.value = format === "list" ? "matrix" : "list";
            }
            convert();
        });
        return { format, button };
    });
    const file = h("input", { type: "file", accept: ".txt,.json,.csv,.tsv,.ts,.js,text/plain,application/json", hidden: true });
    const open = h("button", { type: "button", class: "small" });
    open.addEventListener("click", () => file.click());
    const status = h("div", { class: "convert-status", role: "status", "aria-live": "polite" });

    // ---- the graph written out
    const outputLabel = h("label", { for: "convert-output", class: "pane-title" });
    const to = h("select", { id: "convert-to" });
    const toLabel = h("label", { for: "convert-to" });
    const styleLegend = h("legend", { class: "visually-hidden" });
    const styleInputs = STYLES.map(style => h("input", { type: "radio", name: "convert-style", value: style, id: `convert-style-${style}`, checked: style === "text" }));
    const styleLabels = STYLES.map(style => h("label", { for: `convert-style-${style}` }));
    const styles = h("fieldset", { class: "segmented" }, [styleLegend, ...STYLES.flatMap((_, i) => [styleInputs[i], styleLabels[i]])]);
    const output = h("textarea", {
        id: "convert-output", class: "convert-text", readonly: true, spellcheck: "false", wrap: "off",
    });
    const copy = h("button", { type: "button", class: "small" });
    const download = h("button", { type: "button", class: "small" });
    const copyNote = h("span", { class: "convert-note", "aria-live": "polite" });

    const help = h("dl");
    const helpTitle = h("summary");

    root.append(
        h("header", { class: "docs-head" }, [title, intro]),
        h("div", { class: "convert-panes" }, [
            h("div", { class: "convert-pane" }, [
                h("div", { class: "pane-head" }, [
                    inputLabel,
                    h("span", { class: "pane-field" }, [fromLabel, from]),
                    h("span", { class: "pane-field" }, [directed, directedLabel]),
                ]),
                input,
                h("div", { class: "pane-foot" }, [tryLabel, ...examples.map(example => example.button), open, file, status]),
            ]),
            h("div", { class: "convert-pane" }, [
                h("div", { class: "pane-head" }, [
                    outputLabel,
                    h("span", { class: "pane-field" }, [toLabel, to]),
                    styles,
                ]),
                output,
                h("div", { class: "pane-foot" }, [copy, download, copyNote]),
            ]),
        ]),
        h("details", { class: "convert-help" }, [helpTitle, help]),
    );

    // ---- reading and writing

    const style = () => (styleInputs.find(radio => radio.checked)?.value ?? "text") as OutputStyle;

    const showProblems = (heading: string, error: FormatError) => {
        const t = converterTexts[app.lang];
        status.className = "convert-status failed";
        status.replaceChildren(
            h("p", {}, [heading]),
            h("ul", { class: "convert-problems" }, error.problems.map(problem => h("li", {}, [problemText(problem, t.problems)]))),
        );
    };

    const setOutput = (text: string) => {
        output.value = text;
        output.scrollTop = 0;
        copy.disabled = download.disabled = text === "";
        copyNote.textContent = "";
    };

    function convert(): void {
        window.clearTimeout(pending);
        const t = converterTexts[app.lang];
        if (input.value.trim() === "") {
            setOutput("");
            status.className = "convert-status";
            status.replaceChildren(h("p", {}, [t.hint]));
            return;
        }
        let graph: ParsedGraph;
        try {
            graph = parseGraph(input.value, { format: from.value as GraphFormat | "auto", directed: directed.checked });
        } catch (error) {
            if (!(error instanceof FormatError)) {
                throw error;
            }
            setOutput("");
            showProblems(t.cantRead, error);
            return;
        }
        try {
            setOutput(formatGraph(graph, to.value as GraphFormat, style()));
        } catch (error) {
            if (!(error instanceof FormatError)) {
                throw error;
            }
            setOutput("");
            showProblems(t.cantWrite, error);
            return;
        }
        status.className = "convert-status";
        status.replaceChildren(h("p", {}, [t.read(graph.format, graph.directed, graph.points.length, graph.edges.length)]));
    }

    // typing converts a moment after it stops, longer for long text
    let pending = 0;
    input.addEventListener("input", () => {
        window.clearTimeout(pending);
        pending = window.setTimeout(convert, input.value.length > 100_000 ? 500 : 150);
    });
    for (const control of [from, directed, to, ...styleInputs]) {
        control.addEventListener("change", convert);
    }

    file.addEventListener("change", async () => {
        const chosen = file.files?.[0];
        file.value = "";
        if (!chosen) {
            return;
        }
        const t = converterTexts[app.lang];
        if (chosen.size > MAX_FILE_BYTES) {
            status.className = "convert-status failed";
            status.replaceChildren(h("p", {}, [t.fileTooBig(formatBytes(MAX_FILE_BYTES, app.lang))]));
            return;
        }
        try {
            input.value = await chosen.text();
        } catch {
            status.className = "convert-status failed";
            status.replaceChildren(h("p", {}, [t.fileUnreadable]));
            return;
        }
        convert();
    });

    copy.addEventListener("click", async () => {
        const t = converterTexts[app.lang];
        try {
            await navigator.clipboard.writeText(output.value);
            copyNote.textContent = t.copied;
        } catch {
            output.select();
            copyNote.textContent = t.copyFailed;
        }
    });

    download.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([output.value], { type: "text/plain;charset=utf-8" }));
        const link = h("a", { href: url, download: `graph-${FILE_NAMES[to.value as GraphFormat]}.${EXTENSIONS[style()]}` });
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    // ---- words, in the chosen language

    let shownLang = "";
    const relabel = () => {
        if (shownLang === app.lang) {
            return;
        }
        shownLang = app.lang;
        const t = converterTexts[app.lang];
        root.lang = app.lang;
        title.textContent = t.title;
        intro.textContent = t.intro;
        inputLabel.textContent = t.input;
        input.placeholder = t.placeholder;
        fromLabel.textContent = t.readAs;
        const fromValue = from.value || "auto";
        from.replaceChildren(
            h("option", { value: "auto" }, [t.workItOut]),
            ...(["edges", "list", "matrix", "incidence"] as const).map(format => h("option", { value: format }, [t.formats[format]])),
        );
        from.value = fromValue;
        directedLabel.textContent = t.directed;
        tryLabel.textContent = t.examples;
        examples.forEach(({ format, button }) => button.textContent = t.formats[format]);
        open.textContent = t.openFile;
        outputLabel.textContent = t.output;
        toLabel.textContent = t.convertTo;
        const toValue = to.value || "list";
        to.replaceChildren(...FORMATS.map(format => h("option", { value: format }, [t.formats[format]])));
        to.value = toValue;
        styleLegend.textContent = t.writeAs;
        STYLES.forEach((name, i) => styleLabels[i].textContent = t.styles[name]);
        copy.textContent = t.copy;
        download.textContent = t.download;
        helpTitle.textContent = t.helpTitle;
        help.replaceChildren(...t.help.flatMap(({ term, text }) => [h("dt", {}, [term]), h("dd", {}, [text])]));
        convert();
    };
    app.on(change => change === "view" && relabel());
    relabel();
}
