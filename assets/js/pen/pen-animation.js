/*
 * Scroll-driven pen: the "l" in "carlo" turns into a pen (Blender frames), which then
 * writes each heading mid-screen and flicks it into place while the section is pinned.
 */
import { buildWord } from "./glyphs.js";

const FRAME_COUNT = 90;
const FRAME_MARGIN = 0.05 / 1.1; // empty space above/below the pen in every render
const POSTURE = (28 * Math.PI) / 180;
const HERO_TILT = (-3 * Math.PI) / 180; // .hero-name rotation
const PAUSE_AFTER = 0.35; // screen heights of scroll the section stays still after the last word lands
const SIZE = window.innerWidth >= 768 ? "lg" : "sm";

const hero = document.querySelector("#hero");
const pin = document.querySelector(".pen-pin");
const section = pin?.querySelector(".portfolio-section");
const spacer = pin?.querySelector(".pen-pin-spacer");
const canvas = document.querySelector(".pen-canvas");
const floatLayer = document.querySelector(".pen-float");
const headings = [...document.querySelectorAll("[data-pen-text]")];

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const arc = (t) => Math.sin(Math.PI * t);
const lerpAngle = (a, b, t) => a + (((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI) * t;

const frames = [];
const sprite = new Image();
const frameUrl = (i) => `assets/images/pen/${SIZE}/frame_${String(i + 1).padStart(3, "0")}.webp`;

function loadImage(src) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

function loadFrames(onLoad) {
    const order = [...new Set([12, 4, 2, 1].flatMap((step) => Array.from({ length: Math.ceil(FRAME_COUNT / step) }, (_, k) => k * step)))];
    order.push(FRAME_COUNT - 1);
    const next = async () => {
        while (order.length) {
            const i = order.shift();
            if (!frames[i]) {
                frames[i] = await loadImage(frameUrl(i));
                onLoad();
            }
        }
    };
    for (let k = 0; k < 4; k++) next();
}

function nearestFrame(i) {
    for (let d = 0; d < FRAME_COUNT; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
    }
    return null;
}

function setupWord(heading, i) {
    const text = heading.dataset.penText;
    const label = Object.assign(document.createElement("span"), { className: "visually-hidden", textContent: text });
    const landed = buildWord(text, 17 + i * 31); // stays in the heading
    const flying = buildWord(text, 17 + i * 31); // written mid-screen, then flicked
    heading.replaceChildren(label, landed.svg);
    landed.svg.style.visibility = "hidden";
    floatLayer.appendChild(flying.svg);

    const segments = [];
    let previous = null;
    for (const stroke of flying.strokes) {
        const { path } = stroke;
        stroke.length = path.getTotalLength();
        stroke.start = stroke.matrix.transformPoint(path.getPointAtLength(0));
        stroke.end = stroke.matrix.transformPoint(path.getPointAtLength(stroke.length));
        Object.assign(path.style, { strokeDasharray: `${stroke.length} ${stroke.length + 2}`, strokeDashoffset: stroke.length, visibility: "hidden" });
        if (previous) {
            const gap = Math.hypot(stroke.start.x - previous.end.x, stroke.start.y - previous.end.y);
            segments.push({ air: true, from: previous.end, to: stroke.start, weight: gap * 0.55 + (stroke.letter !== previous.letter ? 10 : 5) });
        }
        segments.push({ stroke, weight: stroke.length });
        previous = stroke;
    }
    const total = segments.reduce((sum, s) => sum + s.weight, 0);
    return { text, landed, flying, ratio: flying.width / 128, segments, total, first: flying.strokes[0].start, last: previous.end, drawn: -1 };
}

/* Pen point inside a word at writing progress p (word units), and reveal strokes when `draw` is set. */
function writeWord(word, p, draw = false) {
    p = clamp(p);
    if (draw && p === word.drawn) return null;
    if (draw) word.drawn = p;
    let u = p * word.total;
    let point = null;
    for (const segment of word.segments) {
        const f = clamp(u / segment.weight);
        const current = !point && (u <= segment.weight || segment === word.segments.at(-1));
        if (segment.air) {
            if (current) point = { ...mix(segment.from, segment.to, easeSine(f)), tangentX: 0, lift: arc(f) * 0.6 };
        } else {
            const { path, length, matrix } = segment.stroke;
            if (draw) Object.assign(path.style, { strokeDashoffset: (length * (1 - f)).toFixed(2), visibility: f > 0 ? "visible" : "hidden" });
            if (current) {
                const a = matrix.transformPoint(path.getPointAtLength(f * length));
                const b = matrix.transformPoint(path.getPointAtLength(Math.min(length, f * length + 0.8)));
                point = { x: a.x, y: a.y, tangentX: (b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1), lift: 0 };
            }
        }
        if (point && !draw) return point;
        u -= segment.weight;
    }
    return point;
}

function drawPen(ctx, pose, length, width) {
    const image = pose.morph < 1 ? nearestFrame(Math.round(pose.morph * (FRAME_COUNT - 1))) : sprite.naturalWidth ? sprite : null;
    ctx.save();
    ctx.globalAlpha = pose.alpha;
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
    if (image) {
        const scale = length / (image.naturalHeight * (1 - 2 * FRAME_MARGIN));
        const [w, h] = [image.naturalWidth * scale, image.naturalHeight * scale];
        Object.assign(ctx, {
            shadowColor: `rgba(33, 37, 41, ${0.25 * pose.morph})`,
            shadowBlur: 5 + pose.lift * 18,
            shadowOffsetX: (2 + pose.lift * 12) * pose.morph,
            shadowOffsetY: (3 + pose.lift * 10) * pose.morph,
        });
        ctx.drawImage(image, -w / 2, -h * (1 - FRAME_MARGIN), w, h);
    } else {
        // stand-in until the images load
        Object.assign(ctx, { fillStyle: pose.morph < 0.5 ? "#212529" : "#f1f3f5", strokeStyle: "rgba(33, 37, 41, 0.2)" });
        ctx.beginPath();
        ctx.roundRect(-width / 2, -length, width, length, width / 2);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

/* Where the "l" glyph sits inside the rotated .hero-name, in hero coordinates. */
function measureLetter() {
    const name = hero.querySelector(".hero-name");
    const slot = hero.querySelector(".l-slot");
    const fontSize = parseFloat(getComputedStyle(name).fontSize);
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = `${fontSize}px "Covered By Your Grace"`;
    const m = measure.measureText("l");
    const ascent = m.fontBoundingBoxAscent ?? fontSize * 0.9;
    const descent = m.fontBoundingBoxDescent ?? fontSize * 0.3;
    const baseline = slot.offsetTop + (slot.offsetHeight - (ascent + descent)) / 2 + ascent;
    const [top, bottom] = [baseline - m.actualBoundingBoxAscent, baseline + m.actualBoundingBoxDescent];
    const [left, right] = [slot.offsetLeft - m.actualBoundingBoxLeft, slot.offsetLeft + m.actualBoundingBoxRight];
    const [ox, oy] = [name.offsetWidth / 2, name.offsetHeight / 2];
    const [px, py] = [(left + right) / 2 - ox, (top + bottom) / 2 - oy];
    const [cos, sin] = [Math.cos(HERO_TILT), Math.sin(HERO_TILT)];
    const center = { x: name.offsetLeft + ox + px * cos - py * sin, y: name.offsetTop + oy + px * sin + py * cos };
    const height = bottom - top;
    const dir = { x: Math.sin(HERO_TILT), y: -Math.cos(HERO_TILT) };
    const tip = { x: center.x + (dir.x * height) / 2, y: center.y + (dir.y * height) / 2 };
    let foot = { x: center.x - (dir.x * height) / 2, y: center.y - (dir.y * height) / 2 };
    const limit = hero.offsetHeight - 12; // the "l" runs off the hero; shrink toward its visible part
    if (foot.y > limit) foot = mix(tip, foot, (limit - tip.y) / (foot.y - tip.y));
    return { center, anchor: mix(tip, foot, 0.5), height, width: (right - left) * 0.72, dir };
}

function start() {
    const ctx = canvas.getContext("2d");
    const words = headings.map(setupWord);
    let view = {};
    let letter = null;
    let stages = [];
    let pinLength = 0;
    let request = 0;

    const heroTop = (s) => view.heroTop - s;
    const sectionTop = (s) => Math.min(Math.max(0, view.pinTop - s), view.pinTop + pinLength - s);
    const headingBox = (word, s) => ({ ...word.target, y: word.target.y + sectionTop(s) });
    const center = (box, word) => ({ x: box.x + box.w / 2, y: box.y + box.w / word.ratio / 2 });
    const onBox = (box, word, p) => ({ x: box.x + (p.x * box.w) / word.flying.width, y: box.y + ((p.y - 12) * box.w) / word.flying.width });
    const onMid = (word, p) => onBox(word.mid, word, p);

    function wordBox(word, s) {
        const from = word.mid;
        const to = headingBox(word, s);
        if (s < word.floatStart) return { ...from, r: 0 };
        if (s >= word.floatEnd) return { ...to, r: 0 };
        const t = clamp((s - word.floatStart) / (word.floatEnd - word.floatStart));
        const e = easeInOut(t);
        return { ...mix(from, to, e), y: lerp(from.y, to.y, e) - arc(t) * 0.08 * view.h, w: from.w * Math.pow(to.w / from.w, e), r: arc(t) * -6 };
    }

    function flick(word, s) {
        const box = word.mid;
        const start = { x: box.x + box.w * 0.5, y: box.y + (box.w / word.ratio) * 1.05 };
        const target = center(headingBox(word, s), word);
        const from = center(box, word);
        const d = Math.hypot(target.x - from.x, target.y - from.y) || 1;
        const reach = Math.min(110, 0.12 * view.w);
        return { start, end: { x: start.x + ((target.x - from.x) / d) * reach, y: start.y + ((target.y - from.y) / d) * reach } };
    }

    function letterTip(e, s) {
        const length = lerp(letter.height, view.penLength, e);
        const c = mix(letter.center, letter.anchor, e);
        return { x: view.heroLeft + c.x - (letter.dir.x * length) / 2, y: heroTop(s) + c.y - (letter.dir.y * length) / 2 };
    }

    function layout() {
        const [w, h] = [window.innerWidth, window.innerHeight];
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = w * ratio;
        canvas.height = h * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        spacer.style.height = "0px";
        const heroRect = hero.getBoundingClientRect();
        const top = section.getBoundingClientRect().top;
        const penLength = clamp(h * 0.24, 150, 240);
        view = {
            w, h, penLength, penWidth: penLength * 0.056,
            heroTop: heroRect.top + window.scrollY, heroLeft: heroRect.left, heroHeight: heroRect.height,
            pinTop: pin.getBoundingClientRect().top + window.scrollY,
        };
        for (const word of words) {
            const rect = word.landed.svg.getBoundingClientRect();
            const midWidth = Math.min(w * 0.86, h * 0.13 * word.ratio);
            word.target = { x: rect.left, y: rect.top - top, w: rect.width };
            word.mid = { x: (w - midWidth) / 2, y: (h - midWidth / word.ratio) / 2, w: midWidth };
            word.flying.svg.style.width = `${rect.width}px`;
            word.drawn = -1;
        }
        letter = measureLetter();

        // Timeline in pixels of scroll: each stage maps t (0..1) to a pen pose.
        stages = [];
        const add = (from, length, f) => (stages.push({ from, to: from + length, f }), from + length);

        let at = add(0, 0.32 * view.heroHeight, (t, s) => ({ ...letterTip(easeInOut(t), s), base: HERO_TILT, morph: easeInOut(t), clip: true }));

        at = add(at, view.pinTop + 0.06 * h - at, (t, s) => {
            const [a, b, e] = [letterTip(1, s), onMid(words[0], words[0].first), easeInOut(t)];
            const c = { x: (a.x + b.x) / 2 + 0.1 * w, y: Math.min(a.y, b.y) - 0.18 * h };
            return {
                x: (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x,
                y: (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y,
                base: lerpAngle(HERO_TILT, POSTURE, easeSine(t)),
                follow: 0.85 * arc(t),
                lift: 1 - easeSine(clamp((t - 0.8) / 0.2)),
            };
        });

        words.forEach((word, i) => {
            if (i > 0) {
                at = add(at, 0.14 * h, (t, s) => ({
                    ...mix(flick(words[i - 1], s).end, onMid(word, word.first), easeSine(t)),
                    base: POSTURE, follow: 0.3 * arc(t), lift: arc(t),
                }));
            }
            word.writeStart = at;
            at = add(at, h * (0.12 + 0.011 * word.text.length), (t) => {
                const p = writeWord(word, t);
                return { ...onMid(word, p), base: POSTURE + (p.tangentX * 4 * Math.PI) / 180, lift: p.lift };
            });
            word.writeEnd = at;
            word.floatStart = at + 0.06 * h;
            word.floatEnd = word.floatStart + 0.26 * h;
            at = add(at, 0.12 * h, (t, s) => {
                const swipe = flick(word, s);
                if (t < 0.5) return { ...mix(onMid(word, word.last), swipe.start, easeSine(t / 0.5)), base: POSTURE, lift: arc(t / 0.5) * 0.7 };
                const e = easeOut((t - 0.5) / 0.5);
                return { ...mix(swipe.start, swipe.end, e), base: POSTURE, follow: 0.45, lift: e * 0.5 };
            });
        });

        const last = words.at(-1);
        const rest = { x: w / 2 - penLength * 0.4, y: h * 0.55 };
        view.end = add(at, 0.3 * h, (t, s) => {
            const e = easeSine(clamp(t / 0.6));
            return {
                ...mix(flick(last, s).end, rest, e),
                base: lerpAngle(POSTURE, Math.PI / 2, e),
                lift: 0.5 * (1 - e) + arc(clamp(t / 0.6)) * 0.4,
                alpha: 1 - clamp((t - 0.6) / 0.4),
            };
        });

        pinLength = Math.max(last.floatEnd, view.end) - view.pinTop + PAUSE_AFTER * h;
        spacer.style.height = `${pinLength}px`;
    }

    function poseAt(s) {
        s = Math.max(0, s);
        const stage = stages.find((st) => s <= st.to);
        if (!stage) return null;
        const t = clamp((s - stage.from) / (stage.to - stage.from || 1));
        return { morph: 1, follow: 0, lift: 0, alpha: 1, clip: false, ...stage.f(t, s) };
    }

    function render() {
        request = 0;
        const s = Math.max(0, window.scrollY);

        for (const word of words) {
            writeWord(word, (s - word.writeStart) / (word.writeEnd - word.writeStart), true);
            const landed = s >= word.floatEnd;
            const flying = s >= word.writeStart && !landed;
            word.landed.svg.style.visibility = landed ? "visible" : "hidden";
            word.flying.svg.style.opacity = flying ? "1" : "0";
            if (flying) {
                const b = wordBox(word, s);
                word.flying.svg.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px) rotate(${b.r.toFixed(2)}deg) scale(${(b.w / word.target.w).toFixed(4)})`;
            }
        }

        ctx.clearRect(0, 0, view.w, view.h);
        const pose = poseAt(s);
        if (!pose || pose.alpha <= 0) return;

        // lean the pen so its tip leads while it travels
        pose.angle = pose.base;
        if (pose.follow > 0) {
            const [before, after] = [poseAt(s - 3) || pose, poseAt(s + 3) || pose];
            const [vx, vy] = [after.x - before.x, after.y - before.y];
            if (Math.hypot(vx, vy) > 0.5) pose.angle = lerpAngle(pose.base, Math.atan2(-vx, vy), pose.follow);
        }

        if (pose.clip) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(view.heroLeft, heroTop(s), view.w, view.heroHeight);
            ctx.clip();
        }
        drawPen(ctx, pose, lerp(letter.height, view.penLength, pose.morph), lerp(letter.width, view.penWidth, pose.morph));
        if (pose.clip) ctx.restore();
    }

    const requestRender = () => (request ||= requestAnimationFrame(render));
    let resizeTimer = 0;
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => (layout(), render()), 150);
    });

    sprite.onload = requestRender;
    sprite.src = "assets/images/pen/pen.webp";
    loadFrames(requestRender);
    layout();
    render();
}

const ready = hero && pin && section && spacer && canvas && floatLayer && headings.length;
if (ready && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Only hide the real "l" once the first Blender frame can replace it.
    Promise.all([document.fonts?.ready, loadImage(frameUrl(0))]).then(([, first]) => {
        if (!first) return;
        frames[0] = first;
        document.documentElement.classList.add("has-pen");
        start();
    });
}
