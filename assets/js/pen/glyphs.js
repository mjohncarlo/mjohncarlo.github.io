/*
 * Single-stroke handwriting. Baseline y=100, x-height 50.
 * Each string in `s` is one pen stroke, in drawing order.
 */
export const GLYPHS = {
    S: { w: 50, s: ["M44 32 C40 20 16 17 11 31 C6 46 44 50 44 72 C44 93 13 97 6 82"] },
    k: { w: 40, s: ["M9 18 L9 100", "M35 52 L10 77 L37 100"] },
    i: { w: 18, s: ["M9 54 L9 100", "M9 33 L9.6 35.5"] },
    l: { w: 18, s: ["M10 18 C9 50 8 80 9 100"] },
    s: { w: 36, s: ["M31 58 C25 47 7 48 7 61 C7 75 31 72 31 87 C31 103 8 103 4 92"] },
    T: { w: 52, s: ["M4 25 L49 21", "M27 23 L26 100"] },
    o: { w: 42, s: ["M23 50 C7 50 4 72 6 84 C8 102 35 102 37 82 C39 62 31 50 20 52"] },
    "&": { w: 54, s: ["M48 100 L15 53 C7 39 15 20 27 22 C39 24 39 40 27 50 L11 68 C3 81 9 100 25 100 C37 100 45 87 49 73"] },
    e: { w: 40, s: ["M7 76 L35 74 C37 56 27 50 19 52 C7 54 5 72 7 84 C9 101 29 104 37 92"] },
    c: { w: 37, s: ["M33 59 C27 48 9 50 7 70 C5 92 21 104 35 92"] },
    h: { w: 42, s: ["M9 18 L9 100", "M9 68 C15 51 35 49 35 67 L35 100"] },
    n: { w: 42, s: ["M9 52 L9 100", "M9 68 C15 51 35 49 35 67 L35 100"] },
    g: { w: 42, s: ["M33 58 C27 48 9 50 7 67 C5 85 27 89 33 71", "M33 52 L33 112 C33 131 11 133 5 121"] },
    E: { w: 46, s: ["M41 22 L9 22 L9 100 L43 100", "M9 60 L35 60"] },
    d: { w: 42, s: ["M33 64 C27 50 7 50 7 75 C7 99 29 102 33 82", "M33 18 L33 100"] },
    u: { w: 42, s: ["M7 52 L7 82 C7 104 33 102 33 82", "M33 52 L33 100"] },
    a: { w: 42, s: ["M33 62 C27 48 7 50 7 75 C7 99 29 100 33 80", "M33 52 L33 100"] },
    t: { w: 32, s: ["M13 26 L13 92 C13 102 23 102 28 96", "M3 53 L28 51"] },
};

const SVG_NS = "http://www.w3.org/2000/svg";

function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* Same text + seed always gives the same drawing, so the flying copy lands exactly on the heading copy. */
export function buildWord(text, seed) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("pen-word");
    const random = seeded(seed);
    const strokes = [];
    let x = 4;
    let letter = 0;

    for (const char of text) {
        if (char === " ") {
            x += 20;
            continue;
        }
        const glyph = GLYPHS[char];
        if (!glyph) {
            continue;
        }
        const rotate = +((random() - 0.5) * 6).toFixed(2);
        const shift = +((random() - 0.5) * 4).toFixed(1);
        const cx = glyph.w / 2;
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("transform", `translate(${x.toFixed(1)} ${shift}) rotate(${rotate} ${cx} 100)`);
        const matrix = new DOMMatrix().translate(+x.toFixed(1), shift).translate(cx, 100).rotate(rotate).translate(-cx, -100);

        for (const d of glyph.s) {
            const path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", d);
            group.appendChild(path);
            strokes.push({ path, letter, matrix });
        }
        svg.appendChild(group);
        x += glyph.w + 3;
        letter++;
    }

    const width = x + 6;
    svg.setAttribute("viewBox", `0 12 ${width} 128`);
    svg.style.setProperty("--pen-word-ratio", (width / 128).toFixed(4));
    return { svg, width, strokes };
}
