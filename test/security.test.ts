import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "../vite.config.mts";
import { englishProblems, problemText, ProblemCode } from "../src/io/problems";
import { converterTexts } from "../ui/src/converter-texts";

const root = join(import.meta.dirname, "..");
const uiSources = readdirSync(join(root, "ui/src")).filter(name => name.endsWith(".ts"))
    .map(name => ({ name, code: readFileSync(join(root, "ui/src", name), "utf8") }));

describe("the page never turns text into markup", () => {
    it.each(uiSources.map(source => [source.name, source]))("%s has no HTML sinks", (_, { code }) => {
        expect(code).not.toMatch(/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/);
    });

    it("sets no style attributes, which the Content-Security-Policy would block", () => {
        uiSources.forEach(({ code }) => expect(code).not.toMatch(/\bstyle:\s*[`"']|setAttribute\(\s*["']style/));
    });
});

describe("Content-Security-Policy", () => {
    it("allows no inline or evaluated scripts", () => {
        expect(CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
        expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
        expect(CONTENT_SECURITY_POLICY).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    });

    it("is the same in nginx, with frame-ancestors added", () => {
        const nginx = readFileSync(join(root, "docker/nginx.conf"), "utf8");
        expect(nginx).toContain(`add_header Content-Security-Policy "${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'" always;`);
    });
});

describe("the converter's problems", () => {
    const codes = Object.keys(englishProblems.problems) as ProblemCode[];
    const values = { name: "A", value: 1, max: 10, count: 2, edge: "A–B", first: 1, second: 2, entry: "x", rows: 2, columns: 3, names: 2,
        column: 1, from: "A", to: "B", back: 0, a: 1, b: 2, reason: "Unexpected token", key: "matrix", index: 1, cells: 5 };

    it.each(["en", "uk"] as const)("are all told in %s, with every value filled in", lang => {
        const messages = converterTexts[lang].problems;
        expect(Object.keys(messages.problems).sort()).toEqual([...codes].sort());
        codes.forEach(code => {
            const text = problemText({ code, line: 3, values }, messages);
            expect(text).not.toMatch(/undefined|NaN|\$\{/);
            expect(text).toMatch(lang === "uk" ? /^Рядок 3: / : /^Line 3: /);
        });
    });
});
