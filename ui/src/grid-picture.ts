// A matrix too big for a table of numbers, drawn as a picture: every cell is a pixel, dark where
// the cell holds a number other than 0. A matrix with more cells than the picture has pixels on
// screen gets one pixel for several cells, dark if any of them is, so no edge is lost.
//
// The picture of the cells changes only with the graph, so it is kept between renders. What the
// algorithm reads and what is selected is drawn on a second canvas on top, with a minimum size,
// so a single cell of a 1,000 × 1,000 matrix can still be seen. Hovering a cell names it,
// clicking it selects its edge, or its point when the cell is 0.

import { h } from "./dom";

export interface GridSource {
    readonly rows: number;
    readonly columns: number;
    // calls `visit` for every cell that is not 0
    forEachNonZero(visit: (row: number, column: number, value: number) => void): void;
    value(row: number, column: number): number;
    // "A, column B: 4" for hovering
    describe(row: number, column: number): string;
}

export interface GridMarks {
    readonly readRow?: number;
    readonly readColumn?: number;
    readonly readCells?: readonly (readonly [number, number])[];
    readonly selectedRows?: readonly number[];
    readonly selectedColumns?: readonly number[];
    readonly selectedCells?: readonly (readonly [number, number])[];
}

// the widest the picture is on the page, in CSS pixels (see .picture in style.css)
const DISPLAY_WIDTH = 480;

export class GridPicture {
    private base: { key: string; image: ImageData } | null = null;

    // `key` names the graph and its colours: the picture of the cells is drawn again only when it changes
    element(key: string, source: GridSource, marks: GridMarks, pick: (row: number, column: number) => void): HTMLElement {
        // the picture keeps the matrix's shape, but no wider than 4 : 1 and no taller than 1 : 2
        const ratio = Math.min(4, Math.max(0.5, source.columns / Math.max(1, source.rows)));
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.min(source.columns, Math.round(DISPLAY_WIDTH * dpr)));
        const height = Math.max(1, Math.min(source.rows, Math.round(DISPLAY_WIDTH / ratio * dpr)));
        const colors = readColors();
        const baseKey = `${key} ${width}×${height} ${colors.key}`;
        if (this.base?.key !== baseKey) {
            this.base = { key: baseKey, image: drawCells(source, width, height, colors) };
        }

        const cells = h("canvas", { class: "picture-cells", width, height });
        cells.getContext("2d")!.putImageData(this.base.image, 0, 0);
        const overlay = h("canvas", { class: "picture-marks" });
        const frame = h("div", { class: "picture", style: `aspect-ratio: ${ratio}` }, [cells, overlay]);

        const cellAt = (event: MouseEvent): [number, number] => {
            const box = overlay.getBoundingClientRect();
            return [
                Math.min(source.rows - 1, Math.floor((event.clientY - box.top) / box.height * source.rows)),
                Math.min(source.columns - 1, Math.floor((event.clientX - box.left) / box.width * source.columns)),
            ];
        };
        overlay.addEventListener("mousemove", event => {
            const [row, column] = cellAt(event);
            overlay.title = source.describe(row, column);
        });
        overlay.addEventListener("click", event => pick(...cellAt(event)));

        // the marks are drawn once the picture has its size on the page
        requestAnimationFrame(() => drawMarks(overlay, source, marks, colors));
        return frame;
    }
}

interface Colors {
    key: string;
    empty: [number, number, number];
    full: [number, number, number];
    negative: [number, number, number];
    highlighter: string;
    soft: string;
    ink: string;
}

function readColors(): Colors {
    const style = getComputedStyle(document.documentElement);
    const value = (name: string) => style.getPropertyValue(name).trim();
    const names = ["--paper-raised", "--ink", "--blue", "--highlighter", "--highlighter-soft"];
    return {
        key: names.map(value).join(),
        empty: rgb(value("--paper-raised")),
        full: rgb(value("--ink")),
        negative: rgb(value("--blue")),
        highlighter: value("--highlighter"),
        soft: value("--highlighter-soft"),
        ink: value("--ink"),
    };
}

// any CSS colour as red, green and blue
function rgb(color: string): [number, number, number] {
    const canvas = h("canvas", { width: 1, height: 1 });
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
}

function drawCells(source: GridSource, width: number, height: number, colors: Colors): ImageData {
    const image = new ImageData(width, height);
    const pixels = image.data;
    for (let i = 0; i < width * height; i++) {
        pixels.set(colors.empty, i * 4);
        pixels[i * 4 + 3] = 255;
    }
    source.forEachNonZero((row, column, value) => {
        const x = Math.floor(column * width / source.columns);
        const y = Math.floor(row * height / source.rows);
        pixels.set(value < 0 ? colors.negative : colors.full, (y * width + x) * 4);
    });
    return image;
}

function drawMarks(overlay: HTMLCanvasElement, source: GridSource, marks: GridMarks, colors: Colors): void {
    const box = overlay.getBoundingClientRect();
    if (box.width === 0) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(box.width * dpr);
    overlay.height = Math.round(box.height * dpr);
    const context = overlay.getContext("2d")!;
    context.scale(dpr, dpr);

    const cellWidth = box.width / source.columns;
    const cellHeight = box.height / source.rows;
    // a mark is never thinner than this, so one cell of a big matrix stays visible
    const MIN = 4;
    const band = (start: number, cell: number, total: number) => {
        const size = Math.max(MIN, cell);
        const from = Math.max(0, Math.min(total - size, start * cell + cell / 2 - size / 2));
        return [from, size] as const;
    };
    const row = (r: number) => band(r, cellHeight, box.height);
    const column = (c: number) => band(c, cellWidth, box.width);

    context.globalAlpha = 0.55;
    context.fillStyle = colors.soft;
    if (marks.readRow !== undefined) {
        const [y, size] = row(marks.readRow);
        context.fillRect(0, y, box.width, size);
    }
    if (marks.readColumn !== undefined) {
        const [x, size] = column(marks.readColumn);
        context.fillRect(x, 0, size, box.height);
    }
    context.globalAlpha = 1;

    context.lineWidth = 1.5;
    context.strokeStyle = colors.ink;
    context.setLineDash([4, 3]);
    for (const r of marks.selectedRows ?? []) {
        const [y, size] = row(r);
        context.strokeRect(0.75, y, box.width - 1.5, size);
    }
    for (const c of marks.selectedColumns ?? []) {
        const [x, size] = column(c);
        context.strokeRect(x, 0.75, size, box.height - 1.5);
    }
    context.setLineDash([]);

    const cellBox = ([r, c]: readonly [number, number]) => {
        const [y, height] = band(r, cellHeight, box.height);
        const [x, width] = band(c, cellWidth, box.width);
        // cells smaller than a few pixels get a box around them, so they can be found
        const pad = cellWidth < 8 ? 3 : 0;
        return [x - pad, y - pad, width + 2 * pad, height + 2 * pad] as const;
    };
    for (const cell of marks.selectedCells ?? []) {
        context.strokeRect(...cellBox(cell));
    }
    context.fillStyle = colors.highlighter;
    context.lineWidth = 2;
    for (const cell of marks.readCells ?? []) {
        const [x, y, width, height] = cellBox(cell);
        context.fillRect(x, y, width, height);
        context.strokeRect(x, y, width, height);
    }
}
