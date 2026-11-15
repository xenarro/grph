// Rules shared by every graph representation:
// - a point name is a non-empty string;
// - an edge connects two different points (no self-loops);
// - an edge weight is a positive number. 0 cannot be used because the matrices store 0 for "no edge".

export class GraphError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GraphError";
    }
}

export function edgeLabel(nameX: string, nameY: string, directed: boolean): string {
    return `${nameX}${directed ? "→" : "–"}${nameY}`;
}

export function assertPointName(name: string): void {
    if (typeof name !== "string" || name.trim() === "") {
        throw new GraphError("Point name must be a non-empty string");
    }
}

export function assertEdge(nameX: string, nameY: string, weight: number): void {
    assertPointName(nameX);
    assertPointName(nameY);
    if (nameX === nameY) {
        throw new GraphError(`An edge must connect two different points, got ${nameX} and ${nameY}`);
    }
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
        throw new GraphError(`Edge weight must be a positive number, got ${weight}`);
    }
}

export function missingPoint(name: string): GraphError {
    return new GraphError(`Point ${name} does not exist`);
}

export function missingEdge(nameX: string, nameY: string, directed: boolean): GraphError {
    return new GraphError(`Edge ${edgeLabel(nameX, nameY, directed)} does not exist`);
}
