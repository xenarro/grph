// Random graphs of any size, to try the structures and the algorithms on big graphs.
//
// The points sit on a slightly shaken grid, and each point connects to some of its grid neighbors:
// the one to the right, the one below, now and then the one diagonally below. So the drawing
// looks like a map of roads instead of a tangle of lines across the whole paper, and a search
// spreads over it like a wave. In a directed graph every edge goes right or down, so the graph
// has no cycles and has a topological order.
//
// The same recipe always gives the same graph, so a big graph can be saved as its recipe.

import { GraphData } from "./model";

export interface Recipe {
    readonly points: number;
    readonly seed: number;
    readonly directed: boolean;
}

export const GENERATED_SIZES = [100, 1_000, 10_000, 100_000];

const SPACING = 80;

export function generate({ points, seed, directed }: Recipe): GraphData {
    const random = mulberry32(seed);
    // a grid a little wider than tall, like the drawing area
    const columns = Math.max(1, Math.ceil(Math.sqrt(points * 1.4)));
    const name = (i: number) => String(i + 1);

    const data: GraphData = { directed, points: [], edges: [] };
    for (let i = 0; i < points; i++) {
        data.points.push({
            name: name(i),
            x: 60 + (i % columns) * SPACING + (random() - 0.5) * SPACING * 0.5,
            y: 60 + Math.floor(i / columns) * SPACING + (random() - 0.5) * SPACING * 0.5,
        });
    }
    const connect = (i: number, j: number, chance: number) => {
        if (j < points && random() < chance) {
            data.edges.push({ from: name(i), to: name(j), weight: 1 });
        }
    };
    for (let i = 0; i < points; i++) {
        const lastColumn = i % columns === columns - 1;
        if (!lastColumn) {
            connect(i, i + 1, 0.8);
        }
        connect(i, i + columns, 0.6);
        if (!lastColumn) {
            connect(i, i + columns + 1, 0.15);
        }
    }
    return data;
}

export function randomSeed(): number {
    return Math.floor(Math.random() * 2 ** 32);
}

// a small, fast pseudo-random generator: the same seed gives the same numbers
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
