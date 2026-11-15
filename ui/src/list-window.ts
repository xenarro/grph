// The adjacency list of a big graph. Its thousands of rows can't all be on the page, so only the rows
// in view are made, inside a scrolling window of fixed height. While an algorithm runs, the window
// scrolls to the list the algorithm reads.

import { h } from "./dom";

const ROW_HEIGHT = 40;
// rows made above and below the ones in view, so fast scrolling doesn't show gaps
const SPARE_ROWS = 6;

export class ListWindow {
    private scrollTop = 0;
    private focused: string | undefined;

    // `row` makes the row of one point; it is called only for rows in view
    element(points: readonly string[], focus: string | undefined, row: (name: string) => HTMLElement): { element: HTMLElement; attached(): void } {
        const rows = h("div", { class: "list-window-rows", style: `height: ${points.length * ROW_HEIGHT}px` });
        const box = h("div", { class: "list-window", role: "list" }, [rows]);

        const fill = () => {
            const first = Math.max(0, Math.floor(box.scrollTop / ROW_HEIGHT) - SPARE_ROWS);
            const last = Math.min(points.length, Math.ceil((box.scrollTop + box.clientHeight) / ROW_HEIGHT) + SPARE_ROWS);
            const made: HTMLElement[] = [];
            for (let i = first; i < last; i++) {
                const element = row(points[i]);
                element.style.top = `${i * ROW_HEIGHT}px`;
                element.setAttribute("role", "listitem");
                made.push(element);
            }
            rows.replaceChildren(...made);
        };

        let frame = 0;
        box.addEventListener("scroll", () => {
            this.scrollTop = box.scrollTop;
            if (!frame) {
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    fill();
                });
            }
        });

        // the scroll position is restored once the window is on the page
        const attached = () => {
            box.scrollTop = this.scrollTop;
            if (focus !== undefined && focus !== this.focused) {
                const index = points.indexOf(focus);
                const top = index * ROW_HEIGHT;
                if (index >= 0 && (top < box.scrollTop || top + ROW_HEIGHT > box.scrollTop + box.clientHeight)) {
                    box.scrollTop = top - box.clientHeight / 2 + ROW_HEIGHT / 2;
                }
            }
            this.focused = focus;
            this.scrollTop = box.scrollTop;
            fill();
        };
        return { element: box, attached };
    }
}
