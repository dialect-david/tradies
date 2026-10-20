type Knob = { v: string; label: string; min: number; max: number; step: number; unit: string; def: number };

export const KNOBS: Knob[] = [
  { v: "--crt-scanline", label: "scanlines", min: 0, max: 0.6, step: 0.01, unit: "", def: 0.13 },
  { v: "--crt-scanline-period", label: "pitch", min: 2, max: 6, step: 1, unit: "px", def: 3 },
  { v: "--crt-vignette", label: "vignette", min: 0, max: 1, step: 0.01, unit: "", def: 0.4 },
  { v: "--crt-vignette-start", label: "tube", min: 20, max: 90, step: 1, unit: "%", def: 55 },
  { v: "--crt-bezel", label: "bezel", min: 0, max: 24, step: 1, unit: "px", def: 6 },
];

const KEY = "tradies.crt";
const osd = document.getElementById("osd")!;
const css = document.documentElement.style;

function load(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

const saved = load();
const apply = (k: Knob, n: number) => css.setProperty(k.v, `${n}${k.unit}`);
for (const k of KNOBS) if (k.v in saved) apply(k, saved[k.v]!);

export function toggleTuner() {
  if (osd.classList.toggle("open")) render();
}

function render() {
  const rows = KNOBS.map(
    (k) =>
      `<label><span>${k.label}</span><input type="range" data-v="${k.v}" min="${k.min}" max="${k.max}" step="${k.step}" value="${saved[k.v] ?? k.def}" /><b></b></label>`,
  ).join("");
  osd.innerHTML = `<h3>▸ display</h3>${rows}<div class="row"><button data-reset>reset</button><button data-close>exit</button></div>`;
  for (const input of osd.querySelectorAll<HTMLInputElement>("input")) {
    const k = KNOBS.find((x) => x.v === input.dataset.v)!;
    const show = () => (input.nextElementSibling!.textContent = `${input.value}${k.unit}`);
    show();
    input.addEventListener("input", () => {
      saved[k.v] = Number(input.value);
      apply(k, saved[k.v]!);
      localStorage.setItem(KEY, JSON.stringify(saved));
      show();
    });
  }
  osd.querySelector("[data-reset]")!.addEventListener("click", () => {
    for (const k of KNOBS) {
      delete saved[k.v];
      css.removeProperty(k.v);
    }
    localStorage.removeItem(KEY);
    render();
  });
  osd.querySelector("[data-close]")!.addEventListener("click", () => osd.classList.remove("open"));
}
