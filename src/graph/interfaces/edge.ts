// An edge between two points.
// In an undirected graph "from" and "to" are interchangeable.
export default interface Edge {
    readonly from: string;
    readonly to: string;
    readonly weight: number;
}
