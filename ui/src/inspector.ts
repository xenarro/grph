// The strip under the drawing: how to edit, or the selected point or edge with its actions.

import { edgeLabel } from "../../src/graph/validation";
import { App } from "./app";
import { h } from "./dom";

export function mountInspector(root: HTMLElement, app: App): void {
    const render = () => {
        const selected = app.selection;
        // why the last click did nothing, for example a limit was reached
        const notice = app.notice && h("p", { class: "error", role: "alert" }, [app.notice]);

        if (!selected) {
            root.replaceChildren(
                notice || h("p", { class: "hint" }, [
                    "Click empty paper to add a point. Drag a point to move it. Click a point, then another one, to connect them.",
                ]),
            );
            return;
        }

        if (selected.kind === "point") {
            const remove = h("button", { type: "button" }, ["Delete point"]);
            remove.addEventListener("click", () => app.deleteSelection());
            root.replaceChildren(
                h("strong", {}, ["Point ", h("em", { class: "math" }, [selected.name])]),
                notice || h("p", { class: "hint" }, [`Click another point to connect ${selected.name} to it.`]),
                remove,
            );
            return;
        }

        const { from, to } = selected;
        const weight = h("input", {
            type: "number", id: "edge-weight", min: "0", step: "any", inputmode: "decimal",
            value: app.model.weight(from, to) ?? 1,
        });
        const error = h("p", { class: "error", role: "alert" });
        weight.addEventListener("change", () => {
            const value = Number(weight.value);
            if (weight.value.trim() === "" || !Number.isFinite(value) || value <= 0) {
                error.textContent = "Weight must be a number greater than 0.";
                return;
            }
            app.setWeight(from, to, value);
        });

        const remove = h("button", { type: "button" }, ["Delete edge"]);
        remove.addEventListener("click", () => app.deleteSelection());

        root.replaceChildren(
            h("strong", { class: "math" }, ["Edge ", h("em", {}, [edgeLabel(from, to, app.model.directed)])]),
            h("label", { for: "edge-weight" }, ["Weight"]),
            weight,
            remove,
            error,
        );
    };

    app.on(change => change !== "positions" && render());
    render();
}
