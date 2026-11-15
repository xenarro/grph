// The converter's words in English and Ukrainian, and the Ukrainian for the problems the parser finds
// (the English is in src/io/problems.ts).

import { GraphFormat, PARSE_LIMITS } from "../../src/io/parse";
import { FORMAT_LIMITS, OutputStyle } from "../../src/io/format";
import { englishProblems, ProblemMessages } from "../../src/io/problems";
import { count, Lang, plural } from "./i18n";

export interface ConverterTexts {
    link: string;
    title: string;
    intro: string;
    input: string;
    placeholder: string;
    readAs: string;
    workItOut: string;
    formats: Record<GraphFormat, string>;
    // "as an adjacency list", used after "read"
    asFormat: Record<GraphFormat, string>;
    directed: string;
    examples: string;
    openFile: string;
    fileTooBig: (max: string) => string;
    fileUnreadable: string;
    output: string;
    convertTo: string;
    writeAs: string;
    styles: Record<OutputStyle, string>;
    copy: string;
    copied: string;
    copyFailed: string;
    download: string;
    hint: string;
    read: (format: GraphFormat, directed: boolean, points: number, edges: number) => string;
    cantRead: string;
    cantWrite: string;
    helpTitle: string;
    help: readonly { term: string; text: string }[];
    problems: ProblemMessages;
}

const en: ConverterTexts = {
    link: "Convert ↓",
    title: "Convert a graph",
    intro: "Paste a graph you already have — an edge list, an adjacency list, an adjacency matrix or an incidence matrix, as text or JSON — and get it back in another of the four. Nothing is drawn and nothing leaves your browser: the text is read, checked and written out again.",
    input: "Your graph",
    placeholder: "A B 4\nB C 2\nC A",
    readAs: "Read as",
    workItOut: "Work it out",
    formats: { edges: "Edge list", list: "Adjacency list", matrix: "Adjacency matrix", incidence: "Incidence matrix" },
    asFormat: { edges: "an edge list", list: "an adjacency list", matrix: "an adjacency matrix", incidence: "an incidence matrix" },
    directed: "Directed",
    examples: "Try:",
    openFile: "Open a file…",
    fileTooBig: max => `The file is too big: at most ${max}.`,
    fileUnreadable: "The file can't be read as text.",
    output: "Converted",
    convertTo: "Convert to",
    writeAs: "Write as",
    styles: { text: "Text", json: "JSON", typescript: "TypeScript" },
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Select the text and copy it",
    download: "Download",
    hint: "Paste a graph, open a file, or try one of the examples.",
    read: (format, directed, points, edges) =>
        `Read as ${en.asFormat[format]}, ${directed ? "directed" : "undirected"}: ${count(points)} ${points === 1 ? "point" : "points"} and ${count(edges)} ${edges === 1 ? "edge" : "edges"}.`,
    cantRead: "This can't be read yet:",
    cantWrite: "This can't be written out:",
    helpTitle: "What can be pasted",
    help: [
        { term: "Edge list", text: "One edge per line: “A B” or “A B 4” with a weight. Arrows (A -> B) and commas work too. A name alone on a line is a point without edges." },
        { term: "Adjacency list", text: "A point, a colon, then its neighbors: “A: B(4), C”. In an undirected graph an edge may be on both its points’ lines or on one." },
        { term: "Adjacency matrix", text: "Rows of numbers, 0 for no edge, the same number of rows and columns. Names may head the columns and start each row; without them the points are 0, 1, 2… An undirected matrix is symmetric." },
        { term: "Incidence matrix", text: "A row for every point and a column for every edge. A column has exactly two numbers other than 0: the weight twice, or −weight where a directed edge leaves and +weight where it enters." },
        { term: "JSON", text: "Any of these as JSON, the way “JSON” writes them here: { \"A\": { \"B\": 4 } }, { \"points\": [...], \"matrix\": [...] }, { \"edges\": [[\"A\", \"B\", 4]] }." },
        { term: "Names and weights", text: `A name is 1 to 32 letters of any alphabet, digits, “_”, “.” or “-”; a weight is a number above 0. Lines may end with a # or // comment. Up to ${count(PARSE_LIMITS.points)} points and ${count(PARSE_LIMITS.edges)} edges; a matrix is written out up to ${count(FORMAT_LIMITS.matrixCells)} cells.` },
    ],
    problems: englishProblems,
};

const ukGraphNumber = (n: number, forms: { one: string; few: string; many: string }) => `${count(n, "uk")} ${plural(n, "uk", forms)}`;

const ukProblems: ProblemMessages = {
    locale: "uk-UA",
    line: line => `Рядок ${line}: `,
    problems: {
        "not-text": () => "Граф має бути текстом.",
        "too-long": (v, n) => `Текст задовгий: щонайбільше ${n(v.max)} символів.`,
        "empty": () => "Тут поки нічого конвертувати.",
        "too-many-lines": (v, n) => `Забагато рядків: ${n(v.count)}, щонайбільше ${n(v.max)}.`,
        "too-many-points": (v, n) => `Забагато вершин: ${n(v.count)}, щонайбільше ${n(v.max)}.`,
        "too-many-edges": (v, n) => `Забагато ребер: ${n(v.count)}, щонайбільше ${n(v.max)}.`,
        "too-many-rows": (v, n) => `Забагато рядків матриці: ${n(v.count)}, щонайбільше ${n(v.max)}.`,
        "bad-name": v => `«${v.name}» не може бути іменем вершини: використовуйте від 1 до 32 літер, цифр, «_», «.» або «-».`,
        "reserved-name": v => `«${v.name}» не може бути іменем вершини: це ім'я зарезервоване.`,
        "bad-weight": (v, n) => `«${v.value}» не може бути вагою: потрібне число, більше за 0, щонайбільше ${n(v.max)}.`,
        "self-loop": v => `ребро має з'єднувати дві різні вершини, а це веде з ${v.name} у неї ж.`,
        "weight-twice": v => `ребро ${v.edge} задано двічі, з вагами ${v.first} і ${v.second}.`,
        "edge-parts": v => `очікується «звідки куди» або «звідки куди вага», а частин тут: ${v.count}.`,
        "list-line": () => "очікується «вершина: сусід, сусід(вага), …».",
        "list-entry": v => `«${v.entry}» — не «сусід» і не «сусід(вага)».`,
        "not-a-number": v => `«${v.value}» — не число.`,
        "row-length": v => `чисел у цьому рядку: ${v.count}, а в першому: ${v.first}.`,
        "not-square": v => `У матриці суміжності стільки ж стовпців, скільки рядків; у цій рядків: ${v.rows}, стовпців: ${v.columns}. Може, це матриця інцидентності?`,
        "names-differ": () => "Імена рядків і стовпців різняться.",
        "names-count": v => `Імен над стовпцями: ${v.names}, а стовпців: ${v.columns}.`,
        "bad-cell": v => `клітинка в стовпці ${v.column} має бути 0 або вагою, більшою за 0, а тут ${v.value}.`,
        "diagonal": v => `${v.name} має ребро в саму себе; на діагоналі мають бути нулі.`,
        "asymmetric": v => `${v.from}–${v.to} дорівнює ${v.value}, а ${v.to}–${v.from} — ${v.back}: матриця неорієнтованого графа симетрична. Позначте «Орієнтований», якщо ребра мають напрямки.`,
        "column-count": v => `у стовпці ${v.column} чисел, відмінних від 0: ${v.count}; у стовпці ребра їх рівно 2.`,
        "column-too-big": v => `у стовпці ${v.column} завелике число.`,
        "column-directed": v => `стовпець ${v.column}: орієнтоване ребро має −вагу там, звідки виходить, і +вагу там, куди входить, а тут ${v.a} і ${v.b}.`,
        "column-undirected": v => `стовпець ${v.column}: неорієнтоване ребро має однакову вагу, більшу за 0, в обох рядках, а тут ${v.a} і ${v.b}. Позначте «Орієнтований» для −ваги і +ваги.`,
        "bad-json": v => `Це некоректний JSON: ${v.reason}`,
        "expected-matrix": v => `Очікується матриця суміжності: масив рядків із чисел${v.key ? ` у полі «${v.key}»` : ""}, усі такої ж довжини, як перший.`,
        "expected-incidence": v => `Очікується матриця інцидентності: масив рядків із чисел${v.key ? ` у полі «${v.key}»` : ""}, усі такої ж довжини, як перший.`,
        "names-for-rows": v => `Імен вершин: ${v.names}, а рядків: ${v.rows}.`,
        "expected-edges": () => 'Очікується список ребер: масив на кшталт [["A", "B", 4]] або { "edges": [...] }.',
        "bad-edge": v => `ребро ${v.index} — не ["звідки", "куди"] і не ["звідки", "куди", вага].`,
        "expected-list": () => "Очікується список суміжності: об'єкт на кшталт { \"A\": { \"B\": 4, \"C\": 2 } }.",
        "neighbors-shape": v => `сусіди вершини ${v.name} мають бути списком або об'єктом.`,
        "matrix-too-big": (v, n) => `Клітинок у матриці було б ${n(v.cells)} — забагато, щоб її виписати (щонайбільше ${n(v.max)}). Список суміжності чи список ребер зберігає цей граф значно компактніше.`,
    },
};

const uk: ConverterTexts = {
    link: "Конвертер ↓",
    title: "Конвертувати граф",
    intro: "Вставте граф, який у вас уже є, — список ребер, список суміжності, матрицю суміжності чи матрицю інцидентності, текстом або JSON, — і отримайте його в іншому з цих чотирьох видів. Нічого не малюється і нічого не залишає ваш браузер: текст лише читається, перевіряється і записується знову.",
    input: "Ваш граф",
    placeholder: "A B 4\nB C 2\nC A",
    readAs: "Читати як",
    workItOut: "Визначити самому",
    formats: { edges: "Список ребер", list: "Список суміжності", matrix: "Матриця суміжності", incidence: "Матриця інцидентності" },
    asFormat: { edges: "список ребер", list: "список суміжності", matrix: "матрицю суміжності", incidence: "матрицю інцидентності" },
    directed: "Орієнтований",
    examples: "Приклади:",
    openFile: "Відкрити файл…",
    fileTooBig: max => `Файл завеликий: щонайбільше ${max}.`,
    fileUnreadable: "Файл не читається як текст.",
    output: "Результат",
    convertTo: "Перетворити на",
    writeAs: "Записати як",
    styles: { text: "Текст", json: "JSON", typescript: "TypeScript" },
    copy: "Копіювати",
    copied: "Скопійовано",
    copyFailed: "Виділіть текст і скопіюйте",
    download: "Завантажити",
    hint: "Вставте граф, відкрийте файл або спробуйте один із прикладів.",
    read: (format, directed, points, edges) =>
        `Прочитано як ${uk.asFormat[format]}, ${directed ? "орієнтований" : "неорієнтований"}: ` +
        `${ukGraphNumber(points, { one: "вершина", few: "вершини", many: "вершин" })} і ${ukGraphNumber(edges, { one: "ребро", few: "ребра", many: "ребер" })}.`,
    cantRead: "Поки що це не читається:",
    cantWrite: "Це не вдасться записати:",
    helpTitle: "Що можна вставити",
    help: [
        { term: "Список ребер", text: "Одне ребро в рядку: «A B» або «A B 4» з вагою. Підходять і стрілки (A -> B), і коми. Ім'я саме в рядку — це вершина без ребер." },
        { term: "Список суміжності", text: "Вершина, двокрапка, далі її сусіди: «A: B(4), C». У неорієнтованому графі ребро може бути в рядках обох його вершин або лише в одному." },
        { term: "Матриця суміжності", text: "Рядки чисел, 0 — немає ребра, рядків стільки ж, скільки стовпців. Імена можуть стояти над стовпцями і на початку кожного рядка; без них вершини — це 0, 1, 2… Матриця неорієнтованого графа симетрична." },
        { term: "Матриця інцидентності", text: "Рядок для кожної вершини і стовпець для кожного ребра. У стовпці рівно два числа, відмінні від 0: вага двічі, або −вага там, звідки орієнтоване ребро виходить, і +вага там, куди входить." },
        { term: "JSON", text: "Будь-що з цього як JSON, так, як його тут записує «JSON»: { \"A\": { \"B\": 4 } }, { \"points\": [...], \"matrix\": [...] }, { \"edges\": [[\"A\", \"B\", 4]] }." },
        { term: "Імена і ваги", text: `Ім'я — від 1 до 32 літер будь-якої абетки, цифр, «_», «.» або «-»; вага — число, більше за 0. Рядок може закінчуватися коментарем після # або //. До ${count(PARSE_LIMITS.points, "uk")} вершин і ${count(PARSE_LIMITS.edges, "uk")} ребер; матриця виписується до ${count(FORMAT_LIMITS.matrixCells, "uk")} клітинок.` },
    ],
    problems: ukProblems,
};

export const converterTexts: Record<Lang, ConverterTexts> = { en, uk };
