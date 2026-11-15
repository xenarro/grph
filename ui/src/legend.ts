// What the colours of the drawing mean. It is shown under the drawing while a run is on display.

import { h } from "./dom";

export function legend(): HTMLElement {
    const item = (swatch: string, text: string) =>
        h("li", {}, [h("span", { class: `swatch ${swatch}`, "aria-hidden": "true" }), text]);
    return h("ul", { class: "legend", "aria-label": "What the colours mean" }, [
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
