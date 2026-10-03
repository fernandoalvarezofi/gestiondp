import { describe, expect, it } from "vitest";
import { analyzeGray, judgeQuality } from "./imageQuality";

const make = (w: number, h: number, fn: (x: number, y: number) => number) => {
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fn(x, y);
  return data;
};

describe("calidad de foto", () => {
  it("una imagen con bordes marcados es nítida", () => {
    const stats = analyzeGray(make(64, 64, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 200 : 60), 64, 64);
    expect(stats.sharpness).toBeGreaterThan(500);
    expect(judgeQuality(stats, 1280, 960).ok).toBe(true);
  });
  it("una imagen lisa se considera borrosa", () => {
    const quality = judgeQuality(analyzeGray(make(64, 64, () => 128), 64, 64), 1280, 960);
    expect(quality.ok).toBe(false);
    expect(quality.problems.join(" ")).toContain("borrosa");
  });
  it("detecta poca luz, exceso de luz y reflejos", () => {
    const dark = judgeQuality(analyzeGray(make(64, 64, (x, y) => ((x + y) % 2 ? 30 : 10)), 64, 64), 1280, 960);
    expect(dark.problems.join(" ")).toContain("poca luz");
    const glare = judgeQuality(analyzeGray(make(64, 64, (x) => (x < 16 ? 255 : (x % 2 ? 200 : 100))), 64, 64), 1280, 960);
    expect(glare.problems.join(" ")).toContain("reflejos");
  });
  it("rechaza fotos de baja resolución", () => {
    const stats = analyzeGray(make(64, 64, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 200 : 60), 64, 64);
    expect(judgeQuality(stats, 400, 300).problems.join(" ")).toContain("muy chica");
  });
});
