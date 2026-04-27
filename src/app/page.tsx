"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { divine, divineByName } from "@/lib/divine";
import type { DivineResult } from "@/lib/divine";
import { PALACE_GRID, PALACE_ELEMENT, BRANCHES } from "@/lib/constants";
import type { PalaceName, Auspice } from "@/lib/constants";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatClock(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const ELEMENT_COLOR: Record<string, string> = {
  木: "text-green-400",
  火: "text-red-400",
  土: "text-yellow-600",
  金: "text-slate-300",
  水: "text-blue-400",
};

// 日落宫起分配的五行颜色（偏淡/不同色调区分地支五行）
const DAY_ELEMENT_COLOR: Record<string, string> = {
  木: "text-emerald-300",
  火: "text-orange-400",
  土: "text-amber-500",
  金: "text-cyan-200",
  水: "text-indigo-300",
  天空: "text-purple-300",
};

const AUSPICE_COLOR: Record<Auspice, string> = {
  大吉: "text-red-400",
  次吉: "text-amber-300",
  小凶: "text-sky-300",
  大凶: "text-slate-400",
  平: "text-stone-300",
};

const DEITY_ELEMENT: Record<string, string> = {
  青龙: "木", 朱雀: "火", 勾陈: "土", 腾蛇: "土", 白虎: "金", 玄武: "水",
};

const AUSPICE_WEIGHT: Record<Auspice, number> = {
  大吉: 4, 次吉: 3, 平: 2, 小凶: 1, 大凶: 0,
};

// 地支 → 数字（0-9）
function branchToDigit(branch: string): number {
  return BRANCHES.indexOf(branch as (typeof BRANCHES)[number]) % 10;
}

function getLotteryNumbers(result: DivineResult): { digits: number[]; label: string }[] {
  const sorted = [...result.board].sort(
    (a, b) => AUSPICE_WEIGHT[b.auspice] - AUSPICE_WEIGHT[a.auspice]
  );
  const digits = sorted.map((c) => branchToDigit(c.branch));
  const groups: { digits: number[]; label: string }[] = [];

  // 组1：前三吉宫地支数字
  groups.push({ digits: digits.slice(0, 3), label: "三吉组合" });
  // 组2：自身宫 + 两吉宫
  const selfIdx = sorted.findIndex((c) => c.isSelf);
  const selfDigit = digits[selfIdx];
  const others = digits.filter((_, i) => i !== selfIdx).slice(0, 2);
  groups.push({ digits: [selfDigit, ...others], label: "自身引吉" });
  // 组3：月宫+日宫+时宫
  const get = (p: PalaceName) => branchToDigit(result.board.find((c) => c.palace === p)!.branch);
  groups.push({
    digits: [get(result.monthPalace), get(result.dayPalace), get(result.hourPalace)],
    label: "三才定数",
  });
  // 组4：吉宫地支数字顺序轮换
  groups.push({ digits: [digits[1], digits[0], digits[2]], label: "轮转吉数" });
  // 组5：次吉+大吉+大吉（重组）
  groups.push({ digits: [digits[2], digits[1], digits[0]], label: "逆序归元" });

  return groups;
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [result, setResult] = useState<DivineResult | null>(null);
  const [mode, setMode] = useState<"time" | "name">("time");
  const [surnameStrokes, setSurnameStrokes] = useState("");
  const [givenStrokes, setGivenStrokes] = useState("");

  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const lunarPreview = useMemo(() => {
    if (!now) return null;
    try {
      const r = divine(now);
      return r.lunarInfo;
    } catch {
      return null;
    }
  }, [now]);

  const onDivine = () => {
    abortRef.current?.abort();
    setAnalysis("");
    setAnalysisError(null);
    setAnalyzing(false);
    if (mode === "name") {
      const s = parseInt(surnameStrokes);
      const g = parseInt(givenStrokes);
      if (!s || !g) return;
      setResult(divineByName(s, g, new Date()));
    } else {
      setResult(divine(new Date()));
    }
  };

  const onAnalyze = async () => {
    if (!result || analyzing) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAnalysis("");
    setAnalysisError(null);
    setAnalyzing(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, question: question.trim() || undefined }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setAnalysisError(text || `请求失败：HTTP ${res.status}`);
        setAnalyzing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.includes("[ERROR]")) {
          setAnalysisError(chunk.replace(/^\s*\[ERROR\]\s*/, ""));
          break;
        }
        setAnalysis((prev) => prev + chunk);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setAnalysisError((e as Error).message);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const onStopAnalyze = () => {
    abortRef.current?.abort();
    setAnalyzing(false);
  };

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <main className="min-h-screen px-4 py-6 md:py-10 max-w-5xl mx-auto">
      <header className="text-center mb-6">
        <h1 className="text-3xl md:text-5xl tracking-widest text-jinhuang">小六壬</h1>
        <p className="text-sm text-xuanzhi/60 mt-2 tracking-[0.3em]">时 辰 排 盘</p>
      </header>

      <div className="flex justify-center mb-6 gap-0">
        {(["time", "name"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              abortRef.current?.abort();
              setMode(m);
              setResult(null);
              setAnalysis("");
              setAnalysisError(null);
              setAnalyzing(false);
            }}
            className={`px-6 py-2 text-sm tracking-widest border border-jinhuang/40 transition ${
              mode === m ? "bg-jinhuang/20 text-jinhuang" : "text-xuanzhi/50 hover:text-jinhuang/70"
            }`}
          >
            {m === "time" ? "时 辰 起 课" : "姓 名 起 课"}
          </button>
        ))}
      </div>

      <section className="ink-card rounded-lg p-4 md:p-6 mb-6 grid md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-xuanzhi/50 mb-1 tracking-widest">公 历</div>
          <div className="text-base md:text-lg font-mono text-jinhuang">
            {now ? formatClock(now) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-xuanzhi/50 mb-1 tracking-widest">农 历</div>
          <div className="text-base md:text-lg text-jinhuang tracking-wider">
            {lunarPreview
              ? `${lunarPreview.yearCn}年 ${lunarPreview.monthCn}月 ${lunarPreview.dayCn} ${lunarPreview.hourCn}`
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-xuanzhi/50 mb-1 tracking-widest">干 支</div>
          <div className="text-base md:text-lg text-jinhuang tracking-wider">
            {lunarPreview
              ? `${lunarPreview.year}年 ${lunarPreview.month}月 ${lunarPreview.day}日 ${lunarPreview.hour}时`
              : "—"}
          </div>
        </div>
      </section>

      {mode === "name" && (
        <div className="flex justify-center gap-4 mb-4">
          <div className="flex flex-col items-center gap-1">
            <label className="text-xs text-xuanzhi/50 tracking-widest">姓 笔 画</label>
            <input
              type="number" min={1} value={surnameStrokes}
              onChange={(e) => setSurnameStrokes(e.target.value)}
              className="w-20 text-center bg-transparent border border-jinhuang/40 text-jinhuang py-1 outline-none"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <label className="text-xs text-xuanzhi/50 tracking-widest">名 笔 画</label>
            <input
              type="number" min={1} value={givenStrokes}
              onChange={(e) => setGivenStrokes(e.target.value)}
              className="w-20 text-center bg-transparent border border-jinhuang/40 text-jinhuang py-1 outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex justify-center mb-8">
        <button
          onClick={onDivine}
          className="px-8 py-3 border border-jinhuang/70 text-jinhuang hover:bg-jinhuang/10 transition tracking-[0.5em] text-lg"
        >
          起 盘
        </button>
      </div>

      <section className="grid grid-cols-3 grid-rows-2 gap-3 md:gap-5">
        {(Object.keys(PALACE_GRID) as PalaceName[]).map((p) => {
          const cell = result?.board.find((b) => b.palace === p);
          const pos = PALACE_GRID[p];
          return (
            <div
              key={p}
              style={{ gridRow: pos.row + 1, gridColumn: pos.col + 1 }}
              className={`${
                cell?.isSelf ? "ink-card-self" : "ink-card"
              } rounded-lg p-4 min-h-[170px] flex flex-col`}
            >
              <div className="flex items-baseline justify-between border-b border-jinhuang/20 pb-2 mb-2">
                <span className="text-xl md:text-2xl tracking-widest text-jinhuang">
                  {p}<span className="text-sm ml-1 text-xuanzhi/50">{cell?.palaceElement ?? PALACE_ELEMENT[p]}</span>
                </span>
                <span className="flex gap-1 items-center">
                  {result?.dayPalace === p && (
                    <span className="text-[10px] text-emerald-400 tracking-widest">日</span>
                  )}
                  {result?.hourPalace === p && (
                    <span className="text-[10px] text-zhusha tracking-widest">时</span>
                  )}
                </span>
              </div>

              {cell ? (
                <div className="text-sm space-y-1 text-xuanzhi/90">
                  <Row k="地支" v={`${cell.branch} (${cell.branchElement})`} />
                  {cell.kinship
                    ? <Row k="六亲" v={cell.kinship} />
                    : <Row k="六亲" v="自身" />
                  }
                  <div className="flex justify-between">
                    <span className="text-xuanzhi/50">五星</span>
                    <span className={DAY_ELEMENT_COLOR[cell.dayOrderElement]}>
                      {cell.dayOrderElement === "天空" ? "天空" : `${cell.dayOrderElement}星`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xuanzhi/50">六神</span>
                    <span>{cell.deity}<span className="text-xuanzhi/40 text-xs ml-1">({DEITY_ELEMENT[cell.deity]})</span></span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-jinhuang/10 text-center">
                    <span
                      className={`text-xl tracking-[0.3em] ${
                        AUSPICE_COLOR[cell.auspice]
                      }`}
                    >
                      {cell.auspice}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xuanzhi/30 text-xs tracking-widest">
                  待 起 盘
                </div>
              )}
            </div>
          );
        })}
      </section>

      {result && (
        <section className="mt-6 ink-card rounded-lg p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg tracking-[0.4em] text-jinhuang">玄 微 详 解</h2>
            <span className="text-xs text-xuanzhi/40 tracking-widest">DeepSeek · 玄微居士</span>
          </div>

          <label className="block text-xs text-xuanzhi/50 tracking-widest mb-1">
            所 问 之 事（可留空做综合解读）
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例：近日想跳槽，问事业前程；或：近来求财几何；或：与某人感情走向……"
            rows={3}
            className="w-full bg-transparent border border-jinhuang/30 text-xuanzhi/90 p-3 outline-none focus:border-jinhuang/70 transition resize-none text-sm"
            disabled={analyzing}
          />

          <div className="flex justify-center gap-3 mt-3">
            {!analyzing ? (
              <button
                onClick={onAnalyze}
                className="px-6 py-2 border border-jinhuang/70 text-jinhuang hover:bg-jinhuang/10 transition tracking-[0.3em]"
              >
                AI 详 解
              </button>
            ) : (
              <button
                onClick={onStopAnalyze}
                className="px-6 py-2 border border-zhusha/70 text-zhusha hover:bg-zhusha/10 transition tracking-[0.3em]"
              >
                停 止
              </button>
            )}
          </div>

          {analysisError && (
            <div className="mt-4 border border-zhusha/40 text-zhusha text-sm p-3 whitespace-pre-wrap">
              {analysisError}
            </div>
          )}

          {(analysis || analyzing) && (
            <article className="mt-4 border-t border-jinhuang/15 pt-4 text-xuanzhi/90 text-sm leading-7 whitespace-pre-wrap">
              {analysis}
              {analyzing && <span className="ml-1 animate-pulse text-jinhuang">▍</span>}
            </article>
          )}
        </section>
      )}

      {result && (
        <footer className="mt-8 text-center text-xs text-xuanzhi/40 tracking-wider">
          月落宫：{result.monthPalace} · 日落宫：{result.dayPalace} · 时落宫（自身）：
          {result.hourPalace} · 自身地支：{result.selfBranch}
        </footer>
      )}

      {result && (
        <section className="mt-6 ink-card rounded-lg p-4 md:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg tracking-[0.4em] text-jinhuang">福 彩 3D · 玄 数</h2>
            <span className="text-xs text-xuanzhi/40 tracking-widest">仅供娱乐，理性购彩</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {getLotteryNumbers(result).map(({ digits, label }) => (
              <div key={label} className="border border-jinhuang/30 rounded p-3 flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  {digits.map((d, i) => (
                    <span
                      key={i}
                      className="w-9 h-9 flex items-center justify-center border border-zhusha/60 text-zhusha text-xl font-bold rounded-sm"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-xuanzhi/50 tracking-widest">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-xuanzhi/30 text-center tracking-wide">
            以卦象地支序数映射 0-9，取吉宫组合推演 · 娱乐参考，请勿沉迷
          </p>
        </section>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-xuanzhi/50">{k}</span>
      <span>{v}</span>
    </div>
  );
}
