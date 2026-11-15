// A point reachable from another point by a single edge.
export default interface Neighbor {
    readonly name: string;
    readonly weight: number;
}
