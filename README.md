# grph

Українською: [README.uk.md](README.uk.md)

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

- **Find your way.** The page has three parts: the visualizer, the converter and the docs. The header links to each, stays at the top while you scroll (on screens 1,000 pixels wide or more), and marks the part in view.
- **Build a graph.** Click empty paper to add a point. Drag a point to move it. Click a point and then another point to connect them. Click an edge to change its weight, and press Delete to remove the selected point or edge. The bar right over the drawing switches between undirected and directed edges, loads one of the examples, generates a random graph of 100 to 100,000 points, or clears the graph. The examples include big graphs of 10,000 and 100,000 points: only their recipes are in the code, and each is generated when you choose it.
- **Move around.** Scroll, pinch on a trackpad or use two fingers to zoom, and drag empty paper to move the view. **Fit** shows the whole graph. Points show their names when they are big enough on screen, and become dots when a whole big graph is in view.
- **See how it is stored.** The adjacency matrix (and the flat array it is stored in), the adjacency list and the incidence matrix update on every edit. Each one shows how many cells or entries it uses. Clicking a point or edge in a structure selects it in the drawing.
- **Read the docs.** Under the app, across the page, the docs explain the chosen algorithm and the three structures; **Docs** in the header scrolls there.
- **Compare the structures.** In the docs, **Which structure for what** works out, for the graph on the page, the memory each structure takes and the work it does to check an edge, list a point's neighbors, add a point or an edge, and search the whole graph, with the least in each row highlighted.
- **Find a shortest path.** Click a point and press **Start here**, click another and press **Target here**, then run **Shortest path (Dijkstra)** for the lightest path, or **Breadth-first search** for the one with the fewest edges. The path turns blue and every point shows its distance.
- **Learn how it works.** The docs explain the chosen algorithm: what it is for, the idea, pseudocode, the same algorithm in TypeScript, what it costs in each structure, when to use it and when not, and what to try here. While it runs, the pseudocode line of the current step is highlighted. Each structure is explained there too: the idea, a small piece of TypeScript, and what it is good and not good for.
- **Convert a graph you already have.** Under the app, **Convert a graph** (**Converter** in the header) takes an edge list, adjacency list, adjacency matrix or incidence matrix, pasted as text or JSON or opened from a file, and writes it out as any of the four, as text, JSON or TypeScript. It works out the format itself, or you choose it. Nothing is drawn and nothing is sent anywhere. Everything pasted is checked first (see [Converting](#converting)), and each problem is reported with its line.
- **Read it in Ukrainian.** The language select at the top switches the explanations, descriptions and the converter to Ukrainian; buttons and step messages stay in English. The code examples are the same in both.
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
import { AdjacencyList, bfs, dfs, dijkstra, topologicalSort } from "grph";

const graph = new AdjacencyList().addEdge("A", "B").addEdge("A", "C").addEdge("B", "D");
dfs(graph, "A").order;          // ["A", "B", "D", "C"]
dfs(graph, "A", "D").path;      // ["A", "B", "D"]

// A–B–C weighs 1 + 1, the direct edge A–C weighs 5
const roads = new AdjacencyList().addEdge("A", "B", 1).addEdge("B", "C", 1).addEdge("A", "C", 5);
dijkstra(roads, "A", "C").path; // ["A", "B", "C"], the lightest: total weight 2
bfs(roads, "A", "C").path;      // ["A", "C"], the fewest edges

const tasks = new AdjacencyList(true).addEdge("shirt", "tie").addEdge("tie", "jacket");
topologicalSort(tasks).order;   // ["shirt", "tie", "jacket"]
```

- **Depth-first search** (`src/algorithms/dfs.ts`) starts at one point and goes as deep as possible before going back. If you give a target, it stops there and returns the path.
- **Breadth-first search** (`src/algorithms/bfs.ts`) visits points in rings around the start, so it finds the path with the fewest edges. Weights are ignored.
- **Dijkstra's algorithm** (`src/algorithms/dijkstra.ts`) finds the lightest path from the start to every point. It keeps the reached points in a priority queue (a binary heap, `src/algorithms/priority-queue.ts`) and each round finishes the nearest one. With a target it stops there and returns the path and its total weight.
- **Topological sort** (`src/algorithms/topological-sort.ts`) orders the points of a directed graph so that every edge goes forward. If the graph has a cycle, it returns that cycle instead, because then no such order exists.

Each algorithm also returns `steps`, a `Trace`: `steps.at(i)` gives the point and edge marks at step i, its stack or result lists, and what it is reading. A step stores only what changed, with the old values, so the trace moves forwards and backwards by applying or undoing changes. The depth-first searches keep their own stack instead of calling themselves, so they work on graphs far deeper than JavaScript's call stack. To add an algorithm, record its steps with a `Tracer` (`src/algorithms/trace.ts`) and add it to the list in `src/algorithms/index.ts`. The visualizer picks it up from there.

## Converting

```ts
import { formatGraph, parseGraph } from "grph";

const graph = parseGraph("A B 4\nB C 2");     // the format is worked out: an edge list
formatGraph(graph, "list", "text");            // "A: B(4)\nB: A(4), C(2)\nC: B(2)\n"
formatGraph(graph, "matrix", "json");          // { "points": [...], "matrix": [[0, 4, 0], ...] }
parseGraph("0 1\n0 0", { format: "matrix", directed: true }).edges; // [{ from: "0", to: "1", weight: 1 }]
```

`parseGraph` (`src/io/parse.ts`) reads text it can't trust, so it checks everything before it uses it, and throws a `FormatError` with up to 8 problems, each with its line:

- A point name is 1 to 32 letters of any alphabet, digits, `_`, `.` or `-`. So a name can't hold markup (`<`, `>`, quotes, `&`), spaces or control characters, and `__proto__`, `constructor` and `prototype` are refused, so no name reaches an object's prototype.
- A weight is a plain decimal number above 0 and at most 10¹²; `Infinity`, `0x10` or `1; alert(1)` are not.
- The text is at most 4,000,000 characters, with at most 100,000 points and 300,000 edges, and a matrix at most 2,000 rows. The length is checked before anything is read.
- An adjacency matrix is square with zeros on its diagonal, and symmetric unless it is directed. Every column of an incidence matrix has exactly two numbers other than 0: the weight twice, or −weight and +weight for a directed edge. An edge given twice with two different weights is a problem, not a silent overwrite.

`formatGraph` (`src/io/format.ts`) builds the target with this library's own classes and `convert()`, and writes a matrix out only up to a million cells. Every format it writes, `parseGraph` reads back as the same graph. Problems are codes with values (`src/io/problems.ts`), so the visualizer tells them in English or Ukrainian.

In the visualizer, pasted text only ever reaches the page as a textarea's value or an element's text, never as HTML: no code uses `innerHTML`, and `test/security.test.ts` checks that. The built page also carries a Content-Security-Policy (`vite.config.mts`, and the same as a header in `docker/nginx.conf`) that allows only the page's own scripts, so even markup that got onto the page could not run.

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
├── io/
│   ├── parse.ts              reads and checks a graph pasted as text or JSON
│   ├── format.ts             writes a graph in any of the four formats
│   └── problems.ts           what can be wrong with the input, in English
└── algorithms/
    ├── dfs.ts
    ├── bfs.ts
    ├── dijkstra.ts
    ├── priority-queue.ts     a binary heap, for Dijkstra's queue
    ├── topological-sort.ts
    ├── trace.ts              step recording for replay
    ├── algorithm.ts          the interface the visualizer runs
    └── index.ts              the list of algorithms
ui/                           the visualizer (Vite, no framework)
└── src/
    ├── model.ts              the list, and the matrices while the graph fits them
    ├── canvas.ts             drawing on a canvas, zooming and editing
    ├── structures.ts         the three structure views
    ├── structure-guide.ts    "Which structure for what" and how each structure works
    ├── structure-explainers.ts  their text and TypeScript
    ├── grid-picture.ts       a big matrix as a picture, a pixel per cell
    ├── list-window.ts        a big list, only the rows in view
    ├── player.ts             running and replaying algorithms
    ├── converter.ts          "Convert a graph", under the app
    ├── converter-texts.ts    its words and problems in English and Ukrainian
    ├── nav.ts                the header: links to the three parts, the language
    ├── toolbar.ts            the bar over the drawing: edges, examples, random graphs
    ├── docs.ts               the docs under the app
    ├── explainer.ts          how the chosen algorithm works
    ├── explainers.ts         its text, pseudocode and TypeScript
    ├── i18n.ts               the explanations' languages, English and Ukrainian
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
