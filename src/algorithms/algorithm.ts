// Common description of a graph algorithm, so a UI can list algorithms, ask for the
// right input and replay any of them without knowing how each one works.
// To add an algorithm: implement it with a Tracer and add an entry to ./index.ts.

import Graph from "../graph/interfaces/graph";
import { Step } from "./trace";

export interface AlgorithmInput {
    readonly start?: string;
    readonly target?: string;
}

export interface Algorithm {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly start: "required" | "none";
    readonly target: "optional" | "none";
    readonly directedOnly: boolean;
    run(graph: Graph, input: AlgorithmInput): Step[];
}
