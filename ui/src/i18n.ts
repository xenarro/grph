// The header, explanations, descriptions and converter in two languages, English and Ukrainian.
// Buttons, step messages and notices stay in English. The longer texts are in explainers.ts and structure-explainers.ts.

import { RepresentationId } from "./model";

export type Lang = "en" | "uk";

export const LANGUAGES: readonly { id: Lang; name: string }[] = [
    { id: "en", name: "English" },
    { id: "uk", name: "Українська" },
];

// ---- numbers

const LOCALES: Record<Lang, string> = { en: "en-US", uk: "uk-UA" };

export const count = (n: number, lang: Lang = "en") =>
    n.toLocaleString(LOCALES[lang], { maximumFractionDigits: 1 });

// The word that goes with a number: English has one and many; Ukrainian one (1, 21),
// few (2–4, 22–24) and many (5–20, 25–30), and "few" for fractions.
export function plural(n: number, lang: Lang, forms: { one: string; few?: string; many: string }): string {
    const kind = new Intl.PluralRules(LOCALES[lang]).select(n);
    if (kind === "one") {
        return forms.one;
    }
    if (kind === "few" || kind === "other") {
        return forms.few ?? forms.many;
    }
    return forms.many;
}

// decimal units, as storage is usually sold: 1 MB = 1,000,000 bytes
export function formatBytes(bytes: number, lang: Lang = "en"): string {
    const units = lang === "uk" ? ["", "КБ", "МБ", "ГБ", "ТБ"] : ["", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit++;
    }
    const shown = unit === 0 || value >= 100 ? Math.round(value) : Number(value.toFixed(1));
    // a no-break space keeps the number and its unit on one line
    if (unit > 0) {
        return `${count(shown, lang)}\u00a0${units[unit]}`;
    }
    return `${count(shown, lang)}\u00a0${lang === "uk"
        ? plural(shown, lang, { one: "байт", few: "байти", many: "байтів" })
        : shown === 1 ? "byte" : "bytes"}`;
}

// ---- texts

type Matrix = Exclude<RepresentationId, "list">;

export interface Texts {
    // the header: the subtitle, the links to the three parts of the page, and the language select
    tagline: string;
    sections: string;
    nav: { visualizer: string; converter: string; docs: string };
    language: string;
    docsTitle: string;
    docsIntro: string;
    theAlgorithm: string;
    theStructures: string;
    // "How it works"
    howItWorks: string;
    show: string;
    hide: string;
    whatFor: string;
    idea: string;
    pseudocode: string;
    pseudocodeNote: string;
    inTypeScript: string;
    costs: string;
    useWhen: string;
    avoidWhen: string;
    tryIt: string;
    goodFor: string;
    notGoodFor: string;
    algorithmDescriptions: Record<string, string>;

    // the structures
    structureNames: Record<RepresentationId, string>;
    caption(id: RepresentationId, directed: boolean): string;
    readingBadge: string;
    noPoints: string;
    noNeighbors: string;
    matrixCost(size: number): string;
    flatArray(cells: number): string;
    matrixPicture(size: number, cells: number, bytes: number): string;
    matrixPictureStored(cells: number): string;
    matrixCell(row: string, column: string, value: string): string;
    listCost(lists: number, entries: number): string;
    listWindow: string;
    incidenceNoEdges: string;
    incidenceCost(points: number, edges: number): string;
    incidencePicture(points: number, edges: number, cells: number, bytes: number, grouped: boolean, directed: boolean): string;
    incidenceCell(point: string, edge: string, value: string): string;
    tooBig: string;
    tooBigCost(id: Matrix, points: number, edges: number, cells: number, bytes: number): string;
    tooBigLimit(id: Matrix, points: number, cells: number): string;

    // which structure for what
    comparisonTitle: string;
    comparisonCaption(points: number, edges: number): string;
    rows: {
        memory: string; isEdge: string; neighbors: string; addPoint: string; addEdge: string; searchAll: string;
    };
    how: {
        matrixMemory(bytesPerCell: number): string;
        listMemory(twoE: string, bytesPerItem: number): string;
        incidenceMemory(bytesPerCell: number): string;
        oneCell: string;
        xList(perPoint: number): string;
        upToEColumns: string;
        xRow: string;
        incidenceNeighbors: string;
        copyMatrix: string;
        emptyList: string;
        zerosRow: string;
        cells(n: number): string;
        entries(n: number): string;
        cellsColumn: string;
        matrixSearch: string;
        listSearch(twoE: string): string;
        incidenceSearch: string;
    };
    addMorePoints: string;
    density(edges: number, possible: number, share: string, zeros: string): string;
    listSmaller(list: string, matrix: string): string;
    matrixSmaller(matrix: string, list: string, ratio: number): string;
}

const en: Texts = {
    tagline: "Build a graph, see how it is stored, and step through a search.",
    sections: "Parts of the page",
    nav: { visualizer: "Visualizer", converter: "Converter", docs: "Docs" },
    language: "Language",
    docsTitle: "How it works",
    docsIntro: "The algorithm chosen above and the three ways to store a graph, explained. While an algorithm runs above, the line of its pseudocode for the current step is highlighted here.",
    theAlgorithm: "The algorithm",
    theStructures: "The structures",
    howItWorks: "How it works",
    show: "Show",
    hide: "Hide",
    whatFor: "What it is for",
    idea: "The idea",
    pseudocode: "Pseudocode",
    pseudocodeNote: "While an algorithm runs, the line of the current step is highlighted.",
    inTypeScript: "In TypeScript",
    costs: "What it costs",
    useWhen: "Use it when",
    avoidWhen: "Don't use it when",
    tryIt: "Try it here",
    goodFor: "Good for",
    notGoodFor: "Not good for",
    algorithmDescriptions: {},

    structureNames: { matrix: "Adjacency matrix", list: "Adjacency list", incidence: "Incidence matrix" },
    caption: (id, directed) => ({
        matrix: directed
            ? "A row and a column for every point. The cell in row X, column Y holds the weight of the edge X→Y, or 0 when there is none."
            : "A row and a column for every point. A cell holds the weight of the edge between its two points, or 0. Each edge is stored twice, so the matrix is symmetric.",
        list: directed
            ? "Every point keeps a list of the points its edges lead to, with the edge weights."
            : "Every point keeps a list of its neighbors, with the edge weights. Each edge is stored twice, once in each point's list.",
        incidence: directed
            ? "A row for every point, a column for every edge. An edge's column holds −weight in the row of the point it leaves and +weight in the row of the point it enters."
            : "A row for every point, a column for every edge. An edge's column holds its weight in the rows of the two points it connects.",
    })[id],
    readingBadge: "The algorithm reads this one",
    noPoints: "No points yet.",
    noNeighbors: "no neighbors",
    matrixCost: size => `${count(size)} × ${count(size)} = ${count(size * size)} cells, whatever the number of edges.`,
    flatArray: cells => `Stored as one flat array of ${count(cells)} numbers`,
    matrixPicture: (size, cells, bytes) =>
        `${count(size)} × ${count(size)} = ${count(cells)} cells, about ${formatBytes(bytes)}, whatever the number of edges. ` +
        "Too many to write out, so every cell is a pixel here: dark when it holds an edge. Hover a cell to read it.",
    matrixPictureStored: cells => `Stored as one flat array of ${count(cells)} numbers, row after row.`,
    matrixCell: (row, column, value) => `Row ${row}, column ${column}: ${value}`,
    listCost: (lists, entries) => `${count(lists)} ${lists === 1 ? "list" : "lists"} with ${count(entries)} ${entries === 1 ? "entry" : "entries"} in total.`,
    listWindow: "Only the lists in view are on the page; scroll to see more.",
    incidenceNoEdges: "No edges yet, so no columns.",
    incidenceCost: (points, edges) =>
        `${count(points)} × ${count(edges)} = ${count(points * edges)} cells. Finding a point's neighbors means reading its row, then scanning each edge's column for the other end.`,
    incidencePicture: (points, edges, cells, bytes, grouped, directed) =>
        `${count(points)} × ${count(edges)} = ${count(cells)} cells, about ${formatBytes(bytes)}. ` +
        `Every cell is a pixel here${grouped ? ", and a pixel column stands for several edges" : ""}: ` +
        (directed ? "dark for +weight, blue for −weight." : "dark when the edge touches the point."),
    incidenceCell: (point, edge, value) => `Point ${point}, edge ${edge}: ${value}`,
    tooBig: "The graph is too big for this structure. ",
    tooBigCost: (id, points, edges, cells, bytes) =>
        `It would take ${id === "matrix"
            ? `${count(points)} × ${count(points)} = ${count(cells)} cells`
            : `${count(points)} points × ${count(edges)} edges = ${count(cells)} cells`}, about ${formatBytes(bytes)}. `,
    tooBigLimit: (id, points, cells) =>
        `The page builds it for graphs of up to ${id === "matrix"
            ? `${count(points)} points`
            : `${count(points)} points and ${count(cells)} cells`}; the adjacency list holds the graph instead.`,

    comparisonTitle: "Which structure for what",
    comparisonCaption: (points, edges) =>
        `The work each one does, for this graph of V = ${count(points)} points and E = ${count(edges)} edges. The least in each row is highlighted.`,
    rows: {
        memory: "Memory", isEdge: "Is X–Y an edge?", neighbors: "All neighbors of X",
        addPoint: "Add a point", addEdge: "Add an edge", searchAll: "Search all of it (DFS, BFS)",
    },
    how: {
        matrixMemory: b => `V² cells × ${b} B`,
        listMemory: (twoE, b) => `(V + ${twoE}) × ≈ ${b} B`,
        incidenceMemory: b => `V × E cells × ${b} B`,
        oneCell: "1 cell",
        xList: n => `X's list, ≈ ${count(n)}`,
        upToEColumns: "up to E columns",
        xRow: "X's row: V cells",
        incidenceNeighbors: "E cells + V per neighbor",
        copyMatrix: "copy (V + 1)² cells",
        emptyList: "1 empty list",
        zerosRow: "a row of E zeros",
        cells: n => `${n} ${n === 1 ? "cell" : "cells"}`,
        entries: n => `${n} ${n === 1 ? "entry" : "entries"}`,
        cellsColumn: "a column of V cells",
        matrixSearch: "V² cells",
        listSearch: twoE => `V + ${twoE} entries`,
        incidenceSearch: "≈ V × E cells",
    },
    addMorePoints: "Add a few points and edges to compare the structures on your graph.",
    density: (edges, possible, share, zeros) =>
        `This graph has ${count(edges)} of the ${count(possible)} possible edges (${share}), so its adjacency matrix is ${zeros} zeros. `,
    listSmaller: (list, matrix) =>
        `The list stores only what is there, so it is the smaller one (${list} against ${matrix}), and it walks the graph fastest.`,
    matrixSmaller: (matrix, list, ratio) =>
        `Even so the matrix is the smaller one (${matrix} against ${list}): a list entry carries a name and a link, about ${ratio} times a matrix cell. The list still walks the graph fastest.`,
};

const ukCount = (n: number) => count(n, "uk");
const ukForms = {
    points: { one: "вершина", few: "вершини", many: "вершин" },
    edges: { one: "ребро", few: "ребра", many: "ребер" },
    cells: { one: "клітинка", few: "клітинки", many: "клітинок" },
    numbers: { one: "числа", few: "чисел", many: "чисел" },
    lists: { one: "список", few: "списки", many: "списків" },
    entries: { one: "запис", few: "записи", many: "записів" },
};
const uk_ = (n: number, forms: { one: string; few?: string; many: string }) => `${ukCount(n)} ${plural(n, "uk", forms)}`;

const uk: Texts = {
    tagline: "Побудуй граф, подивись, як він зберігається, і пройди пошук крок за кроком.",
    sections: "Частини сторінки",
    nav: { visualizer: "Візуалізатор", converter: "Конвертер", docs: "Документація" },
    language: "Мова",
    docsTitle: "Як це працює",
    docsIntro: "Алгоритм, обраний угорі, і три способи зберігати граф — з поясненнями. Поки алгоритм працює вгорі, тут підсвічено рядок його псевдокоду для поточного кроку.",
    theAlgorithm: "Алгоритм",
    theStructures: "Структури",
    howItWorks: "Як це працює",
    show: "Показати",
    hide: "Сховати",
    whatFor: "Для чого",
    idea: "Ідея",
    pseudocode: "Псевдокод",
    pseudocodeNote: "Поки алгоритм працює, рядок поточного кроку підсвічено.",
    inTypeScript: "На TypeScript",
    costs: "Скільки коштує",
    useWhen: "Коли брати",
    avoidWhen: "Коли не брати",
    tryIt: "Спробуй тут",
    goodFor: "Добре для",
    notGoodFor: "Погано для",
    algorithmDescriptions: {
        "dfs": "Іде якомога глибше вздовж кожного ребра, перш ніж повернутися. Задай ціль, щоб шукати шлях до неї.",
        "bfs": "Обходить вершини кільцями навколо старту, спершу найближчі за кількістю ребер. Задай ціль, щоб знайти шлях до неї з найменшою кількістю ребер; ваги не враховуються.",
        "dijkstra": "Знаходить найлегший шлях від старту до кожної вершини, щоразу беручи найближчу незавершену. Задай ціль, щоб отримати найлегший шлях до неї.",
        "topological-sort": "Впорядковує вершини так, щоб кожне ребро вело від раннішої до пізнішої, або знаходить цикл, через який це неможливо.",
    },

    structureNames: { matrix: "Матриця суміжності", list: "Список суміжності", incidence: "Матриця інцидентності" },
    caption: (id, directed) => ({
        matrix: directed
            ? "Рядок і стовпець для кожної вершини. Клітинка в рядку X, стовпці Y містить вагу ребра X→Y, або 0, якщо його немає."
            : "Рядок і стовпець для кожної вершини. Клітинка містить вагу ребра між двома вершинами, або 0. Кожне ребро зберігається двічі, тож матриця симетрична.",
        list: directed
            ? "Кожна вершина тримає список вершин, до яких ведуть її ребра, з вагами ребер."
            : "Кожна вершина тримає список своїх сусідів із вагами ребер. Кожне ребро зберігається двічі, по разу в списку кожної з двох вершин.",
        incidence: directed
            ? "Рядок для кожної вершини, стовпець для кожного ребра. У стовпці ребра стоїть −вага в рядку вершини, звідки воно виходить, і +вага в рядку вершини, куди входить."
            : "Рядок для кожної вершини, стовпець для кожного ребра. У стовпці ребра стоїть його вага в рядках двох вершин, які воно з'єднує.",
    })[id],
    readingBadge: "Алгоритм читає цю структуру",
    noPoints: "Вершин ще немає.",
    noNeighbors: "без сусідів",
    matrixCost: size => `${ukCount(size)} × ${ukCount(size)} = ${uk_(size * size, ukForms.cells)}, хоч би скільки було ребер.`,
    flatArray: cells => `Зберігається як один плаский масив із ${ukCount(cells)} ${plural(cells, "uk", ukForms.numbers)}`,
    matrixPicture: (size, cells, bytes) =>
        `${ukCount(size)} × ${ukCount(size)} = ${uk_(cells, ukForms.cells)}, близько ${formatBytes(bytes, "uk")}, хоч би скільки було ребер. ` +
        "Забагато, щоб виписати, тож тут кожна клітинка — піксель: темний, якщо в ній є ребро. Наведи на клітинку, щоб її прочитати.",
    matrixPictureStored: cells => `Зберігається як один плаский масив із ${ukCount(cells)} ${plural(cells, "uk", ukForms.numbers)}, рядок за рядком.`,
    matrixCell: (row, column, value) => `Рядок ${row}, стовпець ${column}: ${value}`,
    listCost: (lists, entries) => `${uk_(lists, ukForms.lists)}, у них разом ${uk_(entries, ukForms.entries)}.`,
    listWindow: "На сторінці лише списки, які видно; прокрути, щоб побачити інші.",
    incidenceNoEdges: "Ребер ще немає, тож і стовпців немає.",
    incidenceCost: (points, edges) =>
        `${ukCount(points)} × ${ukCount(edges)} = ${uk_(points * edges, ukForms.cells)}. Щоб знайти сусідів вершини, треба прочитати її рядок, а потім у стовпці кожного ребра знайти його другий кінець.`,
    incidencePicture: (points, edges, cells, bytes, grouped, directed) =>
        `${ukCount(points)} × ${ukCount(edges)} = ${uk_(cells, ukForms.cells)}, близько ${formatBytes(bytes, "uk")}. ` +
        `Тут кожна клітинка — піксель${grouped ? ", а стовпець пікселів відповідає кільком ребрам" : ""}: ` +
        (directed ? "темний для +ваги, синій для −ваги." : "темний, якщо ребро торкається вершини."),
    incidenceCell: (point, edge, value) => `Вершина ${point}, ребро ${edge}: ${value}`,
    tooBig: "Граф завеликий для цієї структури. ",
    tooBigCost: (id, points, edges, cells, bytes) =>
        `Вона зайняла б ${id === "matrix"
            ? `${ukCount(points)} × ${ukCount(points)} = ${uk_(cells, ukForms.cells)}`
            : `${uk_(points, ukForms.points)} × ${uk_(edges, ukForms.edges)} = ${uk_(cells, ukForms.cells)}`}, близько ${formatBytes(bytes, "uk")}. `,
    tooBigLimit: (id, points, cells) =>
        `Сторінка будує її для графів до ${ukCount(points)} вершин${id === "matrix" ? "" : ` і ${ukCount(cells)} клітинок`}; граф натомість тримає список суміжності.`,

    comparisonTitle: "Яка структура для чого",
    comparisonCaption: (points, edges) =>
        `Скільки роботи робить кожна структура для цього графа: V = ${ukCount(points)} (вершини), E = ${ukCount(edges)} (ребра). Найменше в кожному рядку підсвічено.`,
    rows: {
        memory: "Пам'ять", isEdge: "Чи є ребро X–Y?", neighbors: "Усі сусіди X",
        addPoint: "Додати вершину", addEdge: "Додати ребро", searchAll: "Обійти весь граф (DFS, BFS)",
    },
    how: {
        matrixMemory: b => `V² клітинок × ${b} Б`,
        listMemory: (twoE, b) => `(V + ${twoE}) × ≈ ${b} Б`,
        incidenceMemory: b => `V × E клітинок × ${b} Б`,
        oneCell: "1 клітинка",
        xList: n => `список X, ≈ ${ukCount(n)}`,
        upToEColumns: "до E стовпців",
        xRow: "рядок X: V клітинок",
        incidenceNeighbors: "E клітинок + V на сусіда",
        copyMatrix: "копія (V + 1)² клітинок",
        emptyList: "1 порожній список",
        zerosRow: "рядок з E нулів",
        cells: n => uk_(n, ukForms.cells),
        entries: n => uk_(n, ukForms.entries),
        cellsColumn: "стовпець з V клітинок",
        matrixSearch: "V² клітинок",
        listSearch: twoE => `V + ${twoE} записів`,
        incidenceSearch: "≈ V × E клітинок",
    },
    addMorePoints: "Додай кілька вершин і ребер, щоб порівняти структури на своєму графі.",
    density: (edges, possible, share, zeros) =>
        `У цьому графі ${ukCount(edges)} з ${ukCount(possible)} можливих ребер (${share}), тож його матриця суміжності на ${zeros} складається з нулів. `,
    listSmaller: (list, matrix) =>
        `Список зберігає лише те, що є, тож він менший (${list} проти ${matrix}) і обходить граф найшвидше.`,
    matrixSmaller: (matrix, list, ratio) =>
        `І все ж матриця менша (${matrix} проти ${list}): запис у списку несе ім'я і посилання, а це приблизно ${uk_(ratio, ukForms.cells)} матриці. Обходить граф однаково найшвидше список.`,
};

export const texts: Record<Lang, Texts> = { en, uk };

const LANG_KEY = "grph:lang";

// the language chosen before, or English; the browser may not allow storage
export function savedLang(): Lang {
    try {
        return localStorage.getItem(LANG_KEY) === "uk" ? "uk" : "en";
    } catch {
        return "en";
    }
}

export function saveLang(lang: Lang): void {
    try {
        localStorage.setItem(LANG_KEY, lang);
    } catch {
        // the choice just won't be remembered
    }
}
