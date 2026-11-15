// Example graphs to start from. Positions are in the 800 × 560 drawing area.

import { GraphData } from "./model";

export interface Preset {
    id: string;
    name: string;
    data: GraphData;
}

const edge = (from: string, to: string, weight = 1) => ({ from, to, weight });

export const presets: Preset[] = [
    {
        id: "network",
        name: "Small network",
        data: {
            directed: false,
            points: [
                { name: "A", x: 130, y: 150 },
                { name: "B", x: 360, y: 90 },
                { name: "C", x: 170, y: 400 },
                { name: "D", x: 400, y: 320 },
                { name: "E", x: 600, y: 170 },
                { name: "F", x: 660, y: 430 },
                { name: "G", x: 740, y: 70 },
            ],
            edges: [
                edge("A", "B", 4), edge("A", "C", 2), edge("B", "D", 5), edge("C", "D", 8),
                edge("B", "E", 3), edge("D", "E", 1), edge("E", "F", 6),
            ],
        },
    },
    {
        id: "tree",
        name: "Binary tree",
        data: {
            directed: false,
            points: [
                { name: "A", x: 400, y: 80 },
                { name: "B", x: 230, y: 230 },
                { name: "C", x: 570, y: 230 },
                { name: "D", x: 140, y: 400 },
                { name: "E", x: 320, y: 400 },
                { name: "F", x: 480, y: 400 },
                { name: "G", x: 660, y: 400 },
            ],
            edges: [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("B", "E"), edge("C", "F"), edge("C", "G")],
        },
    },
    {
        id: "islands",
        name: "Two islands",
        data: {
            directed: false,
            points: [
                { name: "A", x: 120, y: 160 },
                { name: "B", x: 300, y: 120 },
                { name: "C", x: 210, y: 360 },
                { name: "D", x: 500, y: 200 },
                { name: "E", x: 690, y: 160 },
                { name: "F", x: 700, y: 400 },
                { name: "G", x: 520, y: 430 },
            ],
            edges: [edge("A", "B"), edge("B", "C"), edge("C", "A"), edge("D", "E"), edge("E", "F"), edge("F", "G"), edge("G", "D")],
        },
    },
    {
        // the classic topological sort example: what to put on before what
        id: "dressing",
        name: "Getting dressed",
        data: {
            directed: true,
            points: [
                { name: "shorts", x: 200, y: 80 },
                { name: "socks", x: 70, y: 260 },
                { name: "pants", x: 250, y: 220 },
                { name: "shoes", x: 150, y: 420 },
                { name: "shirt", x: 520, y: 80 },
                { name: "belt", x: 400, y: 330 },
                { name: "tie", x: 650, y: 230 },
                { name: "jacket", x: 560, y: 470 },
                { name: "watch", x: 730, y: 80 },
            ],
            edges: [
                edge("shorts", "pants"), edge("shorts", "shoes"), edge("pants", "belt"), edge("pants", "shoes"),
                edge("socks", "shoes"), edge("shirt", "belt"), edge("shirt", "tie"), edge("belt", "jacket"),
                edge("tie", "jacket"),
            ],
        },
    },
    {
        id: "cycle",
        name: "Directed cycle",
        data: {
            directed: true,
            points: [
                { name: "A", x: 120, y: 280 },
                { name: "B", x: 330, y: 130 },
                { name: "C", x: 580, y: 160 },
                { name: "D", x: 500, y: 410 },
                { name: "E", x: 260, y: 440 },
            ],
            edges: [edge("A", "B"), edge("B", "C"), edge("C", "D"), edge("D", "B"), edge("A", "E"), edge("E", "D")],
        },
    },
];
