# grph

A small TypeScript library for learning graph theory. It builds the same graph in three standard ways, lets you add and remove vertices and edges, and prints each one as text so you can compare them.

Graph algorithms (depth-first search, topological sort) are planned to run on top of these representations.

## Graph representations

Each representation implements the shared `Graph` interface (`src/graph/interfaces/graph.ts`):

```ts
interface Graph {
    addPoint(name: string): this;
    removePoint(name: string): this;
    addEdge(nameX: string, nameY: string, weight?: number): this;
    removeEdge(nameX: string, nameY: string): this;
}
```

Every method returns the graph, so calls can be chained. `addEdge` creates any vertex that doesn't exist yet. Each class also has a `print()` method that returns the graph as a string.

| Class | File | Storage | Weighted | Directed |
|---|---|---|---|---|
| `AdjacencyMatrix` | `src/graph/adjacency-matrix.ts` | A flat `number[]` of size V×V. The cell `[x][y]` holds the edge weight, or `0` if there is no edge | Yes | Optional (`new AdjacencyMatrix([], true)`) |
| `IncidenceMatrix` | `src/graph/incidence-matrix.ts` | A `number[][]` with one row per vertex and one column per edge. Both endpoints of an edge hold its weight | Yes | No |
| `AdjacencyList` | `src/graph/adjacency-list.ts` | A `Map` from each vertex to the list of its neighbours | No (`weight` is ignored) | No |

Vertices are called "points" in the code. In the matrix classes they are `Point` objects (`src/graph/point.ts`) that store a name and the vertex's row/column index.

## Getting started

Requirements: Node.js and npm.

```sh
npm install
npm run build   # compiles src/ to dist/ with tsc
```

## Usage

```js
const { default: AdjacencyMatrix } = require("./dist/graph/adjacency-matrix");

const graph = new AdjacencyMatrix();   // undirected by default

graph
    .addPoint("BAAD")
    .addPoint("A")
    .addPoint("B")
    .addEdge("BAAD", "B", 2)
    .addEdge("C", "D", 3)   // C and D are created automatically
    .addEdge("A", "C", 4)
    .addEdge("A", "D", 5)
    .addPoint("E")
    .addPoint("F");

console.log(graph.print());
```

### Example output

**Adjacency matrix** (`test/manual-adjacency-m.js`): each row is labelled on the right and each column at the top. Cells hold edge weights.

```
BAAD | A | B | C | D | E | F | 
   0 | 0 | 2 | 0 | 0 | 0 | 0 | BAAD
   0 | 0 | 0 | 4 | 5 | 0 | 0 | A
   2 | 0 | 0 | 0 | 0 | 0 | 0 | B
   0 | 4 | 0 | 0 | 3 | 0 | 0 | C
   0 | 5 | 0 | 3 | 0 | 0 | 0 | D
   0 | 0 | 0 | 0 | 0 | 0 | 0 | E
   0 | 0 | 0 | 0 | 0 | 0 | 0 | F
```

**Incidence matrix** (`test/manual-incidence-m.js`): one row per vertex and one column per edge. The first edge joins A–D with weight 1, and the second joins D–E with weight 2.

```
         AAAA 0 0
            B 0 0
            C 0 0
            A 1 0
            D 1 2
SomeLongPoint 0 0
            E 0 2
            F 0 0
```

**Adjacency list** (`test/manual-adjacency-l.js`): each vertex followed by its neighbours.

```
  B: D -> G
  C: G
  D: B
  G: C -> B
DDF: 
```

## Running the examples

There is no automated test suite yet (`npm test` is a placeholder). The scripts in `test/` are manual checks that load the compiled code from `dist/`, so build first:

```sh
npm run build
node test/manual-adjacency-m.js
node test/manual-incidence-m.js
node test/manual-adjacency-l.js
```

## Project structure

```
src/
├── dfs.ts                    # depth-first search (stub)
├── topological-sort.ts       # topological sort (placeholder)
└── graph/
    ├── adjacency-matrix.ts
    ├── incidence-matrix.ts
    ├── adjacency-list.ts
    ├── point.ts              # vertex: name + index
    └── interfaces/
        ├── graph.ts          # common Graph interface
        ├── point.ts
        └── edge.ts
test/                         # manual example scripts (run against dist/)
```

## Status

This project is a work in progress. Known gaps:

- **Algorithms:** `dfs` returns the graph it is given unchanged, and `topological-sort.ts` holds only a reference link.
- **`AdjacencyMatrix.removePoint`** removes the vertex from the name lookup but doesn't shrink the matrix or remove its edges.
- **`IncidenceMatrix.removePoint`** removes the vertex's row but doesn't remove its edges or update the indexes of the remaining vertices.
- **`IncidenceMatrix.removeEdge`** does nothing yet.
- **`AdjacencyList`** is always undirected and ignores edge weights.
- No input validation is done on graphs passed to the constructors.

## References

- [Graph and its representations (GeeksforGeeks)](https://www.geeksforgeeks.org/graph-and-its-representations/)
- [Graph theory: applications (Wikipedia)](https://en.wikipedia.org/wiki/Graph_theory#Applications)
- [Depth-first search (Wikipedia)](https://en.wikipedia.org/wiki/Depth-first_search)
- [Topological sort kata (Codewars)](https://www.codewars.com/kata/55f10facf351f5e236000014)

## License

ISC
