// Colours as numbers, for code that writes pixels itself instead of asking the canvas to draw.

type Rgb = [number, number, number];

const cache = new Map<string, Rgb>();
let probe: CanvasRenderingContext2D | null = null;

// Any CSS colour as red, green and blue, found by painting one pixel. Each colour is worked out
// once: a canvas made for every call would pile up, and Safari limits the memory all canvases take.
export function rgb(color: string): Rgb {
    let value = cache.get(color);
    if (!value) {
        if (!probe) {
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            probe = canvas.getContext("2d", { willReadFrequently: true })!;
        }
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "#000";
        probe.fillStyle = color;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        value = [r, g, b];
        cache.set(color, value);
    }
    return value;
}

// `amount` of a over b
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
    return [0, 1, 2].map(i => Math.round(a[i] * amount + b[i] * (1 - amount))) as Rgb;
}

// One opaque pixel of an ImageData read as a Uint32Array: the bytes are red, green, blue, alpha
// in memory, which makes alpha the highest byte on the little-endian machines browsers run on.
export function pack([r, g, b]: Rgb): number {
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
