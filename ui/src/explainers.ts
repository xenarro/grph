// How each algorithm works, shown under the player for the chosen algorithm.
//
// Text in `backticks` is shown as code. Each pseudocode line lists the step kinds it belongs to:
// the names the algorithms give their steps (the `line` of Tracer.step), so during a run the line
// of the current step is highlighted. test/explainers.test.ts checks that every step kind has a line.

export interface PseudocodeLine {
    readonly text: string;
    readonly steps?: readonly string[];
}

export interface Explainer {
    readonly title: string;
    // the question the algorithm answers, in one line
    readonly question: string;
    readonly uses: readonly string[];
    readonly idea: readonly string[];
    readonly pseudocode: readonly PseudocodeLine[];
    readonly pseudocodeNote?: string;
    readonly typescript: string;
    readonly cost: readonly string[];
    readonly useWhen: readonly string[];
    readonly avoidWhen: readonly string[];
    readonly tryIt: readonly string[];
}

const line = (text: string, ...steps: string[]): PseudocodeLine => ({ text, steps });

export const explainers: Readonly<Record<string, Explainer>> = {
    dfs: {
        title: "Depth-first search",
        question: "Which points can I reach from here, and by what path?",
        uses: [
            "Solving a maze: follow one corridor to its end, then back up to the last fork and try the next one.",
            "Finding everything connected to a point: the files under a folder, the pages reachable from a link, the pixels a paint bucket fills.",
            "Finding cycles and ordering tasks: topological sort is a depth-first search.",
        ],
        idea: [
            "Go as deep as you can. From the current point, follow the first edge to a point you haven't visited, and keep going. When every neighbor of a point is visited, the point is done: go back to the point you came from and try its next edge.",
            "The points you are inside form a stack, the newest on top. Going deeper puts a point on the stack, finishing one takes it off. When the target is reached, the stack is the path from the start to it.",
            "That path is a path, not the shortest one: it depends on which edges happen to be tried first.",
        ],
        pseudocode: [
            line("dfs(start)", "start"),
            line(""),
            line("dfs(point):"),
            line("    mark point as visited", "visit", "target"),
            line("    if point is the target: stop", "target"),
            line("    for each neighbor of point:"),
            line("        if neighbor is visited: skip it", "skip"),
            line("        else: dfs(neighbor)", "deeper"),
            line("    point is done: go back", "back"),
        ],
        pseudocodeNote: "The pseudocode calls itself for every point. This page runs the same steps with a stack of its own, because a function that calls itself 100,000 levels deep runs out of JavaScript's call stack.",
        typescript: `// every point reachable from start, in visiting order
function dfs(graph: Graph, start: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (point: string) => {
        visited.add(point);
        order.push(point);
        for (const { name } of graph.getNeighbors(point)) {
            if (!visited.has(name)) {
                visit(name);
            }
        }
    };

    visit(start);
    return order;
}`,
        cost: [
            "Every point is visited once and every edge looked at once, twice in an undirected graph: O(V + E) time with an adjacency list, for V points and E edges.",
            "The structure matters. Reading a point's neighbors in an adjacency matrix means reading its whole row of V cells, so the search costs O(V²) however few edges there are. An incidence matrix scans a column for every edge in the row: O(V × E).",
            "Memory: O(V), for the visited points and the stack.",
        ],
        useWhen: [
            "You need to know whether one point can be reached from another, or everything that can.",
            "Any path will do, or you want to explore deep first: puzzles, mazes, game moves.",
            "You are looking for cycles or ordering dependencies.",
        ],
        avoidWhen: [
            "You need the shortest path. A depth-first search can wander far before it finds the target: use breadth-first search for the fewest edges, or Dijkstra's algorithm for the least total weight.",
        ],
        tryIt: [
            "Load `Small network`, make A the start and C the target, and run it: it goes A → B → D → C, although A–C is a single edge. Then run `Breadth-first search` on the same two points.",
            "Switch `Read neighbors from` to the adjacency matrix and run it again: the matrix gives the neighbors in point order, so the visiting order can change.",
        ],
    },

    bfs: {
        title: "Breadth-first search",
        question: "What is the path with the fewest edges from here?",
        uses: [
            "Degrees of separation in a social network: friends, then friends of friends, and so on.",
            "The fewest moves in a puzzle or on a game board, where every move counts the same.",
            "Visiting a website or a network level by level, nearest first.",
        ],
        idea: [
            "Spread out in rings, like ripples on water: first every neighbor of the start, 1 edge away; then all their new neighbors, 2 edges away; and so on.",
            "A queue keeps the order. A newly reached point joins at the back, the next point to visit leaves from the front. So the points come out in order of distance, and the first time a point is reached, it is by a path with the fewest edges.",
            "Each reached point remembers which point it was reached from, in `came_from`. Following those links back from the target gives the path.",
        ],
        pseudocode: [
            line("distance[start] = 0; queue = [start]", "start"),
            line("while the queue is not empty:"),
            line("    point = take the first point from the queue", "take"),
            line("    for each neighbor of point:"),
            line("        if neighbor has a distance: skip it", "skip"),
            line("        distance[neighbor] = distance[point] + 1", "reach", "target"),
            line("        came_from[neighbor] = point", "reach", "target"),
            line("        if neighbor is the target: stop", "target"),
            line("        put neighbor at the back of the queue", "reach"),
            line("path = follow came_from back from the target", "path"),
        ],
        typescript: `// the path with the fewest edges, or null
function bfs(graph: Graph, start: string, target: string) {
    const cameFrom = new Map<string, string>();
    const reached = new Set([start]);
    const queue = [start];

    // an index reads the queue from the front:
    // shift() would move every item each time
    for (let i = 0; i < queue.length; i++) {
        const point = queue[i];
        if (point === target) {
            const path = [target];
            while (path[0] !== start) {
                path.unshift(cameFrom.get(path[0])!);
            }
            return path;
        }
        for (const { name } of graph.getNeighbors(point)) {
            if (!reached.has(name)) {
                reached.add(name);
                cameFrom.set(name, point);
                queue.push(name);
            }
        }
    }
    return null;
}`,
        cost: [
            "O(V + E) time with an adjacency list, like depth-first search, and O(V²) with an adjacency matrix.",
            "Memory: O(V). The queue can hold a whole ring of points at once.",
        ],
        useWhen: [
            "Every edge counts the same, or you only care about the number of steps.",
            "You want the points in order of how many edges away they are.",
        ],
        avoidWhen: [
            "Edges have different weights, such as distances, times or prices: the path with the fewest edges can be the heavier one. Use Dijkstra's algorithm.",
        ],
        tryIt: [
            "Load `Detour`, make A the start and D the target, and run it: it takes the single edge A–D, of weight 9. Then run `Shortest path (Dijkstra)`: it goes round through B and C, for a total of 6.",
            "On the `10,000 points` example, pick a start in the middle and play the first few hundred steps: the reached points spread out ring by ring.",
        ],
    },

    dijkstra: {
        title: "Dijkstra's algorithm",
        question: "What is the lightest path from here: the shortest distance, the least time, the lowest price?",
        uses: [
            "Route planners: roads weighted by kilometres or by minutes.",
            "Internet routing: routers work out the cheapest way through the network (OSPF).",
            "Finding a way in games and robots. A*, used in most games, is Dijkstra's algorithm with a hint about which way the target lies.",
        ],
        idea: [
            "Every point gets a distance: the weight of the lightest path to it found so far. The start is at 0, every other point at ∞.",
            "Each round, take the nearest point that is not finished. Its distance is final: any other way to it goes through a point that is at least as far already, and weights are never negative, so that way can only be heavier.",
            "Then try its edges. If going through it makes a neighbor nearer, when `distance[point] + weight < distance[neighbor]`, the neighbor gets the smaller distance and remembers where it was reached from. This is called relaxing the edge.",
            "The points waiting to be finished are kept in a priority queue, nearest first. When the target comes out of the queue, the lightest path to it is known.",
        ],
        pseudocode: [
            line("distance[start] = 0; every other distance = ∞", "start"),
            line("queue = [start], nearest first", "start"),
            line("while the queue is not empty:"),
            line("    point = take the nearest point from the queue", "take", "target"),
            line("    if point is the target: stop", "target"),
            line("    for each edge from point to neighbor, weight w:"),
            line("        if neighbor is finished: skip it", "skip"),
            line("        d = distance[point] + w", "nearer", "keep"),
            line("        if d < distance[neighbor]:", "nearer", "keep"),
            line("            distance[neighbor] = d", "nearer"),
            line("            came_from[neighbor] = point", "nearer"),
            line("            put neighbor in the queue at distance d", "nearer"),
            line("path = follow came_from back from the target", "path"),
        ],
        typescript: `// the lightest path from start to target, or null
// (no weight may be negative)
function dijkstra(graph: Graph, start: string, target: string) {
    const distance = new Map([[start, 0]]);
    const cameFrom = new Map<string, string>();
    const finished = new Set<string>();
    const queue = new Set([start]); // waiting to be finished
    const dist = (p: string) => distance.get(p) ?? Infinity;

    while (queue.size > 0) {
        // the nearest waiting point: a scan here,
        // a binary heap in this app
        const point = [...queue].reduce(
            (a, b) => (dist(a) <= dist(b) ? a : b));
        queue.delete(point);
        finished.add(point);
        if (point === target) {
            break;
        }
        const edges = graph.getNeighbors(point);
        for (const { name, weight } of edges) {
            const d = dist(point) + weight;
            if (!finished.has(name) && d < dist(name)) {
                distance.set(name, d);
                cameFrom.set(name, point);
                queue.add(name);
            }
        }
    }
    if (!finished.has(target)) {
        return null;
    }
    const path = [target];
    while (path[0] !== start) {
        path.unshift(cameFrom.get(path[0])!);
    }
    return { path, weight: distance.get(target)! };
}`,
        cost: [
            "With a binary heap and an adjacency list: O((V + E) log V). Taking the nearest point costs about log₂ V steps, 17 for 100,000 points, instead of a look at every waiting point. This app keeps its queue that way (`priority-queue.ts`).",
            "With the simple scan in the code above: O(V²). For a dense graph, where E is close to V², that is just as good, and an adjacency matrix suits it well.",
            "Memory: O(V), for the distances, the links back and the queue.",
        ],
        useWhen: [
            "Edges have weights that are zero or positive: lengths, times, costs.",
            "You want the lightest path to one target, or to every point at once: without a target, the dark edges at the end form a tree of lightest paths from the start.",
        ],
        avoidWhen: [
            "Every edge counts the same: breadth-first search gives the same answer more simply.",
            "Some weights are negative, like a refund or a gain: a finished point could still get lighter later, and the answer can be wrong. Use the Bellman–Ford algorithm.",
            "You know where the target is, as on a map: A* uses that and looks at far fewer points.",
        ],
        tryIt: [
            "Load `Detour`, make A the start and D the target, and step through: D first gets 9 by the direct edge, then moves up the queue to 6 when the way through B and C turns out lighter.",
            "On the `100,000 points` example, pick two points far apart and jump to the last step: the dark area is everything the algorithm had to finish before it reached the target.",
        ],
    },

    "topological-sort": {
        title: "Topological sort",
        question: "In what order can I do these tasks, when some must come before others?",
        uses: [
            "Build tools and package managers: build or install each part after the parts it depends on.",
            "Course plans: take each course after its prerequisites.",
            "Spreadsheets: work out each cell after the cells its formula uses.",
        ],
        idea: [
            "Draw every \"must come before\" as a directed edge. A topological order lists the points so that every edge goes from an earlier point to a later one.",
            "Run a depth-first search from every point that is not visited yet. A point is finished only after everything reachable from it is finished, so a finished point can go to the front of the order: everything that must come after it is already behind it.",
            "If the search reaches a point that is still on the stack, the edge leads back into the current path: the graph has a cycle, A before B before A, and no order exists.",
        ],
        pseudocode: [
            line("for each point that is not finished:", "root"),
            line("    visit(point)", "root"),
            line(""),
            line("visit(point):"),
            line("    put point on the stack", "visit"),
            line("    for each edge from point to next:"),
            line("        if next is on the stack: a cycle, stop", "cycle"),
            line("        if next is finished: skip it", "skip"),
            line("        else: visit(next)", "deeper"),
            line("    take point off the stack: it is finished", "finish"),
            line("    put point at the front of the order", "finish"),
        ],
        typescript: `// an order in which every edge goes forward,
// or null when the graph has a cycle
function topologicalSort(graph: Graph): string[] | null {
    const finished = new Set<string>();
    const onStack = new Set<string>();
    const order: string[] = [];

    // false when a cycle is found
    const visit = (point: string): boolean => {
        onStack.add(point);
        for (const { name } of graph.getNeighbors(point)) {
            if (onStack.has(name)) {
                return false;
            }
            if (!finished.has(name) && !visit(name)) {
                return false;
            }
        }
        onStack.delete(point);
        finished.add(point);
        order.unshift(point);
        return true;
    };

    for (const point of graph.getPoints()) {
        if (!finished.has(point) && !visit(point)) {
            return null;
        }
    }
    return order;
}`,
        cost: [
            "O(V + E) with an adjacency list: one depth-first search over the whole graph.",
            "Another way, Kahn's algorithm, keeps taking a point that no remaining edge leads to. It gives an order too, and finds a cycle when no such point is left.",
        ],
        useWhen: [
            "The edges mean \"must come before\", and you need one order that respects all of them.",
            "You want to know whether the dependencies go round in a circle.",
        ],
        avoidWhen: [
            "The graph is undirected: \"before\" needs a direction.",
            "You need the best order by some cost: any order that respects the edges is all it promises.",
        ],
        tryIt: [
            "Load `Getting dressed` and run it: socks come before shoes, the shirt before the tie.",
            "Load `Directed cycle` and run it: the search finds the cycle instead.",
        ],
    },
};
