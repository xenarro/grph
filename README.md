# grph

A TypeScript project for learning how graphs work. It stores a graph in three standard ways and runs graph searches on them. A browser visualizer lets you build a graph and watch each structure change as you edit. You can also step through a search and see which part of each structure the algorithm reads at every step.

![The visualizer during a depth-first search: the drawing on the left, the adjacency matrix and adjacency list on the right, with the row being read highlighted](docs/screenshot.png)

## The visualizer

Try it online: **https://xenarro.github.io/grph/**

Every push to `master` type-checks the code, runs the tests and publishes the visualizer to GitHub Pages (`.github/workflows/pages.yml`).

To run it locally:

```sh
npm install
npm run dev     # then open the printed address, usually http://localhost:5173
```

- **Build a graph.** Click empty paper to add a point. Drag a point to move it. Click a point and then another point to connect them. Click an edge to change its weight, and press Delete to remove the selected point or edge. Switch between undirected and directed edges, load one of the examples, or generate a random graph of 100 to 100,000 points. The examples include big graphs of 10,000 and 100,000 points: only their recipes are in the code, and each is generated when you choose it.
- **Move around.** Scroll, pinch on a trackpad or use two fingers to zoom, and drag empty paper to move the view. **Fit** shows the whole graph. Points show their names when they are big enough on screen, and become dots when a whole big graph is in view.
- **See how it is stored.** The adjacency matrix (and the flat array it is stored in), the adjacency list and the incidence matrix update on every edit. Each one shows how many cells or entries it uses. Clicking a point or edge in a structure selects it in the drawing.
- **Step through an algorithm.** Pick an algorithm, its start and target, and which representation it reads neighbours from, then press Run. You can step back and forward, play automatically, or use ← → and Space. Each step says what is happening. Points are coloured the way textbooks colour them: white = not reached, gray = reached, black = finished. A highlighter marks what the algorithm is reading, both in the drawing and in all three structures.

### Big graphs

The adjacency list grows with points + edges; the two matrices grow with points × points and points × edges. So the list holds the graph, and the matrices are built from it only while the graph fits them:

| Structure | Built for | At the limit |
|---|---|---|
| Adjacency list | up to 100,000 points and 300,000 edges | about 50 MB |
| Adjacency matrix | up to 1,000 points | 1,000,000 cells, 8 MB |
| Incidence matrix | up to 1,000 points and 3,000,000 cells | about 36 MB |

A bigger graph shows what the matrix would cost instead (100,000 points would need 10,000,000,000 cells, about 80 GB), and the algorithm can't read from it. Past 40 points a matrix is drawn as a picture with a pixel per cell, and past 200 points the list shows only the rows in view.

A run keeps its first 100,000 steps one by one and the rest as one last step, so a search over 100,000 points stays small.

The graph is saved in your browser, so it is still there after a reload. A graph of more than 5,000 points doesn't fit in the browser's storage, so a generated one is saved as the recipe it was made from, and edits to it are not kept.

## Run with Docker

You only need Docker; Node.js doesn't have to be installed.

```sh
docker compose up --build        # http://localhost:8080
```

This type-checks the code, runs the tests and builds the visualizer, then serves it with nginx. The image won't build if a check fails.

```sh
docker compose up --build dev    # http://localhost:5173, reloads when you edit files
```

This runs the Vite dev server on your local source files.

Set `WEB_PORT` or `DEV_PORT` to use other ports, for example `WEB_PORT=3000 docker compose up --build`. Stop with Ctrl+C, or with `docker compose down` when the app runs in the background (`-d`). After changing dependencies, add `--renew-anon-volumes` to the dev command so the container installs them again.

There is no separate backend: the graph library in `src/` is bundled into the visualizer and runs in the browser.

## Graph representations

All three classes implement the same `Graph` interface (`src/graph/interfaces/graph.ts`):

```ts
interface Graph {
    readonly directed: boolean;

    addPoint(name: string): this;
    removePoint(name: string): this;
    hasPoint(name: string): boolean;
    getPoints(): string[];

    addEdge(nameX: string, nameY: string, weight?: number): this;
    removeEdge(nameX: string, nameY: string): this;
    hasEdge(nameX: string, nameY: string): boolean;
    getEdges(): Edge[];

    getNeighbors(name: string): Neighbor[];
    print(): string;
}
```

| Class | How the graph is stored | Memory |
|---|---|---|
| `AdjacencyMatrix` | A row and a column per point, in one flat `Float64Array`. Cell `[x][y]` holds the weight of edge x→y, or 0 | points² × 8 bytes |
| `AdjacencyList` | A `Map` from each point to its neighbours and the edge weights | points + edge ends |
| `IncidenceMatrix` | A row per point and a column per edge. Undirected: the weight in both rows. Directed: −weight where the edge leaves, +weight where it enters | points × edges |

Every representation follows the same rules:

- Graphs can be undirected or directed: `new AdjacencyList(true)`.
- There is at most one edge between two points (one per direction in a directed graph). Adding an edge that already exists replaces its weight.
- Weights are positive numbers. They can't be 0 because the matrices use 0 to mean "no edge". Self-loops are not allowed.
- `addEdge` creates missing points. The other methods throw a `GraphError` when a point or edge doesn't exist.
- `addPoints` adds many points at once; a matrix grows once for all of them instead of once per point.
- `convert(source, target)` copies a graph into another representation: `convert(list, new AdjacencyMatrix(list.directed))`.
- `getNeighbors` returns neighbours in the order the structure stores them. A matrix row is read in point order, while a list is read in the order the edges were added. Because of this, a search can visit points in a different order depending on the representation.

## Algorithms

```ts
import { AdjacencyList, dfs, topologicalSort } from "grph";

const graph = new AdjacencyList().addEdge("A", "B").addEdge("A", "C").addEdge("B", "D");
dfs(graph, "A").order;          // ["A", "B", "D", "C"]
dfs(graph, "A", "D").path;      // ["A", "B", "D"]

const tasks = new AdjacencyList(true).addEdge("shirt", "tie").addEdge("tie", "jacket");
topologicalSort(tasks).order;   // ["shirt", "tie", "jacket"]
```

- **Depth-first search** (`src/algorithms/dfs.ts`) starts at one point and goes as deep as possible before going back. If you give a target, it stops there and returns the path.
- **Topological sort** (`src/algorithms/topological-sort.ts`) orders the points of a directed graph so that every edge goes forward. If the graph has a cycle, it returns that cycle instead, because then no such order exists.

Each algorithm also returns `steps`, a `Trace`: `steps.at(i)` gives the point and edge marks at step i, its stack or result lists, and what it is reading. A step stores only what changed, with the old values, so the trace moves forwards and backwards by applying or undoing changes. Both algorithms keep their own stack instead of calling themselves, so they work on graphs far deeper than JavaScript's call stack. To add an algorithm (BFS and Dijkstra are next), record its steps with a `Tracer` (`src/algorithms/trace.ts`) and add it to the list in `src/algorithms/index.ts`. The visualizer picks it up from there.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the visualizer with live reload |
| `npm test` | Runs the tests (Vitest) |
| `npm run build` | Compiles the library from `src/` to `dist/` |
| `npm run build:ui` | Builds the visualizer as a static site in `dist-ui/` |
| `npm run typecheck` | Type-checks the library and the visualizer |

The scripts in `test/manual-*.js` print each structure to the terminal. Run `npm run build` first, then for example `node test/manual-adjacency-m.js`.

## Project structure

```
src/                          the library
├── index.ts                  everything it exports
├── graph/
│   ├── adjacency-matrix.ts
│   ├── adjacency-list.ts
│   ├── incidence-matrix.ts
│   ├── convert.ts            copies a graph into another representation
│   ├── point.ts              a named point with its row/column index
│   ├── validation.ts         shared rules and GraphError
│   └── interfaces/           Graph, Edge, Neighbor, Point
└── algorithms/
    ├── dfs.ts
    ├── topological-sort.ts
    ├── trace.ts              step recording for replay
    ├── algorithm.ts          the interface the visualizer runs
    └── index.ts              the list of algorithms
ui/                           the visualizer (Vite, no framework)
└── src/
    ├── model.ts              the list, and the matrices while the graph fits them
    ├── canvas.ts             drawing on a canvas, zooming and editing
    ├── structures.ts         the three structure views
    ├── grid-picture.ts       a big matrix as a picture, a pixel per cell
    ├── list-window.ts        a big list, only the rows in view
    ├── player.ts             running and replaying algorithms
    ├── generate.ts           random graphs of any size
    └── presets.ts            example graphs
test/                         Vitest tests and manual print scripts
```

## References

- [Graph and its representations (GeeksforGeeks)](https://www.geeksforgeeks.org/graph-and-its-representations/)
- [Graph theory: applications (Wikipedia)](https://en.wikipedia.org/wiki/Graph_theory#Applications)
- [Depth-first search (Wikipedia)](https://en.wikipedia.org/wiki/Depth-first_search)
- [Topological sorting (Wikipedia)](https://en.wikipedia.org/wiki/Topological_sorting)
- [Topological sort kata (Codewars)](https://www.codewars.com/kata/55f10facf351f5e236000014)

## License

ISC
