import {
  PALACE_ORDER,
  PALACE_ELEMENT,
  BRANCH_ELEMENT,
  BRANCHES,
  SI_MENG,
  SI_ZHONG,
  DEITY_ORDER,
  hourToBranch,
  hourBranchIndex,
  kinshipOf,
  kinshipElement,
  generates,
  controls,
  deityOfBranch,
} from "./constants";
import type {
  PalaceName,
  Branch,
  Element,
  Kinship,
  Deity,
  Auspice,
} from "./constants";

// 懒加载 lunar-javascript（仅在需要时）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Solar } = require("lunar-javascript");

export interface PalaceCell {
  palace: PalaceName;
  palaceElement: Element;
  dayOrderElement: Element | "天空"; // 从日落宫起 木火土金水天空
  branch: Branch;
  branchElement: Element;
  kinship: Kinship | null;
  kinshipElement: Element | null;
  deity: Deity;
  auspice: Auspice;
  isSelf: boolean;
}

export interface DivineResult {
  timestamp: string;
  lunarInfo: {
    // 干支
    year: string;
    month: string;
    day: string;
    hour: string;
    // 中文农历表达
    yearCn: string;   // 二〇二六
    monthCn: string;  // 三 / 闰三
    dayCn: string;    // 初七
    hourCn: string;   // 酉时
    lunarMonth: number;
    lunarDay: number;
    isLeapMonth: boolean;
    isYangHour: boolean;
    hourBranch: Branch;
  };
  monthPalace: PalaceName;
  dayPalace: PalaceName;
  hourPalace: PalaceName; // 自身宫
  selfBranch: Branch;
  board: PalaceCell[];
}

// palace index 0..5 -> PalaceName
function idxToPalace(i: number): PalaceName {
  return PALACE_ORDER[((i % 6) + 6) % 6];
}
function palaceToIdx(p: PalaceName): number {
  return PALACE_ORDER.indexOf(p);
}

// 月落宫：大安起正月顺数
function calcMonthPalace(lunarMonth: number): PalaceName {
  return idxToPalace((lunarMonth - 1) % 6);
}
// 日落宫：大安起初一顺数
function calcDayPalace(lunarDay: number): PalaceName {
  return idxToPalace(lunarDay - 1);
}
// 时落宫：日落宫起子时顺数
function calcHourPalace(dayPalace: PalaceName, hourBranch: Branch): PalaceName {
  return idxToPalace(palaceToIdx(dayPalace) + hourBranchIndex(hourBranch));
}

// 为每宫推算"落入的地支"：从自身宫(hourBranch)开始，隔位顺排（12支/6宫=步长2）
function assignBranches(hourPalace: PalaceName, hourBranch: Branch): Record<PalaceName, Branch> {
  const result: Partial<Record<PalaceName, Branch>> = {};
  const startHourIdx = hourBranchIndex(hourBranch);
  const startPalaceIdx = palaceToIdx(hourPalace);
  for (let i = 0; i < 6; i++) {
    const palace = idxToPalace(startPalaceIdx + i);
    const branch = BRANCHES[(startHourIdx + i * 2) % 12];
    result[palace] = branch;
  }
  return result as Record<PalaceName, Branch>;
}

// 六亲补全：自身地支决定偏移。四孟+1，四仲+2，四季不补。
function fixKinshipMissing(
  selfPalace: PalaceName,
  selfBranch: Branch,
  kinships: Record<PalaceName, Kinship>
): Record<PalaceName, Kinship> {
  const result = { ...kinships };
  const all: Kinship[] = ["兄弟", "妻财", "官鬼", "父母", "子孙"];

  // 只统计非自身宫的5个宫，找出其中缺失（count=0）的六亲
  const counts = new Map<Kinship, number>();
  for (const p of PALACE_ORDER) {
    if (p === selfPalace) continue;
    const k = result[p];
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const missing = all.filter((k) => !counts.has(k));
  if (missing.length === 0) return result;

  // 寅申巳亥：自身+1（第2宫）；子午卯酉：自身+2（第3宫）；四季不补
  let offset = 0;
  if (SI_MENG.includes(selfBranch)) offset = 1;
  else if (SI_ZHONG.includes(selfBranch)) offset = 2;
  else return result;

  const targetPalace = idxToPalace(palaceToIdx(selfPalace) + offset);
  result[targetPalace] = missing[0];
  return result;
}

// 六神从日落宫起顺时针分配的五行颜色
const DAY_ORDER_ELEMENTS: (Element | "天空")[] = ["木", "火", "土", "金", "水", "天空"];
function assignDayOrderElements(dayPalace: PalaceName): Record<PalaceName, Element | "天空"> {
  const result: Partial<Record<PalaceName, Element | "天空">> = {};
  const start = palaceToIdx(dayPalace);
  for (let i = 0; i < 6; i++) {
    result[idxToPalace(start + i)] = DAY_ORDER_ELEMENTS[i];
  }
  return result as Record<PalaceName, Element | "天空">;
}

function assignDeities(dayPalace: PalaceName, dayBranch: Branch): Record<PalaceName, Deity> {
  const result: Partial<Record<PalaceName, Deity>> = {};
  const startDeity = deityOfBranch(dayBranch);
  const startDeityIdx = DEITY_ORDER.indexOf(startDeity);
  const start = palaceToIdx(dayPalace);
  for (let i = 0; i < 6; i++) {
    result[idxToPalace(start + i)] = DEITY_ORDER[(startDeityIdx + i) % 6];
  }
  return result as Record<PalaceName, Deity>;
}


// 吉凶判定：用"地支五行"对"六亲五行"生克
function judge(branchEl: Element, kinEl: Element): Auspice {
  if (branchEl === kinEl) return "平";
  if (generates(branchEl, kinEl)) return "大吉";
  if (generates(kinEl, branchEl)) return "次吉";
  if (controls(branchEl, kinEl)) return "小凶";
  if (controls(kinEl, branchEl)) return "大凶";
  return "平";
}

function isYangHour(b: Branch): boolean {
  return ["子", "寅", "辰", "午", "申", "戌"].includes(b);
}

export function divine(date: Date = new Date()): DivineResult {
  // 固定加 8 小时，使 getUTC* 读出北京时间
  const local = new Date(date.getTime() + 8 * 60 * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const h = local.getUTCHours();
  const min = local.getUTCMinutes();
  const s = local.getUTCSeconds();

  const solar = Solar.fromYmdHms(y, m, d, h, min, s);
  const lunar = solar.getLunar();
  const rawMonth = lunar.getMonth();
  const lunarMonth = Math.abs(rawMonth);
  const isLeapMonth = rawMonth < 0;
  const lunarDay = lunar.getDay();

  const hourBranch = hourToBranch(h);
  const yang = isYangHour(hourBranch);

  const monthPalace = calcMonthPalace(lunarMonth);
  const dayPalace = calcDayPalace(lunarDay);
  const hourPalace = calcHourPalace(dayPalace, hourBranch);

  const branches = assignBranches(hourPalace, hourBranch);
  const selfEl = BRANCH_ELEMENT[hourBranch];

  // 初步计算六亲（跳过自身宫）
  const kinships: Partial<Record<PalaceName, Kinship>> = {};
  for (const p of PALACE_ORDER) {
    if (p === hourPalace) continue;
    kinships[p] = kinshipOf(selfEl, BRANCH_ELEMENT[branches[p]]);
  }
  const fixedKin = fixKinshipMissing(hourPalace, hourBranch, kinships as Record<PalaceName, Kinship>);
  const dayOrderElements = assignDayOrderElements(dayPalace);
  const deities = assignDeities(dayPalace, branches[dayPalace]);

  const board: PalaceCell[] = PALACE_ORDER.map((p) => {
    const br = branches[p];
    const brEl = BRANCH_ELEMENT[br];
    const isSelf = p === hourPalace;
    const k = isSelf ? null : fixedKin[p] ?? null;
    const kEl = k ? kinshipElement(selfEl, k) : null;
    return {
      palace: p,
      palaceElement: PALACE_ELEMENT[p],
      dayOrderElement: dayOrderElements[p],
      branch: br,
      branchElement: brEl,
      kinship: k,
      kinshipElement: kEl,
      deity: deities[p],
      auspice: judge(brEl, kEl),
      isSelf: p === hourPalace,
    };
  });

  return {
    timestamp: local.toISOString().replace("Z", "+08:00"),
    lunarInfo: {
      year: lunar.getYearInGanZhi(),
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
      hour: lunar.getTimeInGanZhi(),
      yearCn: lunar.getYearInChinese(),
      monthCn: (isLeapMonth ? "闰" : "") + lunar.getMonthInChinese(),
      dayCn: lunar.getDayInChinese(),
      hourCn: lunar.getTimeZhi() + "时",
      lunarMonth,
      lunarDay,
      isLeapMonth,
      isYangHour: yang,
      hourBranch,
    },
    monthPalace,
    dayPalace,
    hourPalace,
    selfBranch: hourBranch,
    board,
  };
}

export function divineByNumbers(
  n1: number,
  n2: number,
  n3: number,
  date: Date = new Date()
): DivineResult {
  const local = new Date(date.getTime() + 8 * 60 * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const h = local.getUTCHours();
  const min = local.getUTCMinutes();
  const s = local.getUTCSeconds();

  const solar = Solar.fromYmdHms(y, m, d, h, min, s);
  const lunar = solar.getLunar();
  const rawMonth = lunar.getMonth();
  const lunarMonth = Math.abs(rawMonth);
  const isLeapMonth = rawMonth < 0;
  const lunarDay = lunar.getDay();

  const hourBranch = hourToBranch(h);
  const yang = isYangHour(hourBranch);

  // 三数起课：n1→月落宫，n2→日落宫，n3→时落宫（隔位取地支）
  const monthPalace = idxToPalace(((n1 - 1) % 6 + 6) % 6);
  const dayPalace = idxToPalace(palaceToIdx(monthPalace) + ((n2 - 1) % 6 + 6) % 6);
  // n3 对应时辰序号（1=子,2=丑,...,12=亥），映射到 hourBranchIndex
  const hourBranchByN3 = BRANCHES[((n3 - 1) % 12 + 12) % 12];
  const hourPalace = calcHourPalace(dayPalace, hourBranchByN3);

  const branches = assignBranches(hourPalace, hourBranchByN3);
  const selfEl = BRANCH_ELEMENT[hourBranchByN3];

  const kinships: Partial<Record<PalaceName, Kinship>> = {};
  for (const p of PALACE_ORDER) {
    if (p === hourPalace) continue;
    kinships[p] = kinshipOf(selfEl, BRANCH_ELEMENT[branches[p]]);
  }
  const fixedKin = fixKinshipMissing(hourPalace, hourBranchByN3, kinships as Record<PalaceName, Kinship>);
  const dayOrderElements = assignDayOrderElements(dayPalace);
  const deities = assignDeities(dayPalace, branches[dayPalace]);

  const board: PalaceCell[] = PALACE_ORDER.map((p) => {
    const br = branches[p];
    const brEl = BRANCH_ELEMENT[br];
    const isSelf = p === hourPalace;
    const k = isSelf ? null : fixedKin[p] ?? null;
    const kEl = k ? kinshipElement(selfEl, k) : null;
    return {
      palace: p,
      palaceElement: PALACE_ELEMENT[p],
      dayOrderElement: dayOrderElements[p],
      branch: br,
      branchElement: brEl,
      kinship: k,
      kinshipElement: kEl,
      deity: deities[p],
      auspice: judge(brEl, kEl),
      isSelf: p === hourPalace,
    };
  });

  return {
    timestamp: local.toISOString().replace("Z", "+08:00"),
    lunarInfo: {
      year: lunar.getYearInGanZhi(),
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
      hour: lunar.getTimeInGanZhi(),
      yearCn: lunar.getYearInChinese(),
      monthCn: (isLeapMonth ? "闰" : "") + lunar.getMonthInChinese(),
      dayCn: lunar.getDayInChinese(),
      hourCn: lunar.getTimeZhi() + "时",
      lunarMonth,
      lunarDay,
      isLeapMonth,
      isYangHour: yang,
      hourBranch: hourBranchByN3,
    },
    monthPalace,
    dayPalace,
    hourPalace,
    selfBranch: hourBranchByN3,
    board,
  };
}

export function divineByName(
  surnameStrokes: number,
  givenStrokes: number,
  date: Date = new Date()
): DivineResult {
  const local = new Date(date.getTime() + 8 * 60 * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  const h = local.getUTCHours();
  const min = local.getUTCMinutes();
  const s = local.getUTCSeconds();

  const solar = Solar.fromYmdHms(y, m, d, h, min, s);
  const lunar = solar.getLunar();
  const rawMonth = lunar.getMonth();
  const lunarMonth = Math.abs(rawMonth);
  const isLeapMonth = rawMonth < 0;
  const lunarDay = lunar.getDay();

  const hourBranch = hourToBranch(h);
  const yang = isYangHour(hourBranch);

  const monthPalace = calcMonthPalace(lunarMonth);
  // 日落宫由笔画之和决定
  const strokeSum = surnameStrokes + givenStrokes;
  const dayPalace = PALACE_ORDER[((strokeSum - 1) % 6 + 6) % 6];
  const hourPalace = calcHourPalace(dayPalace, hourBranch);

  const branches = assignBranches(hourPalace, hourBranch);
  const selfEl = BRANCH_ELEMENT[hourBranch];

  const kinships: Partial<Record<PalaceName, Kinship>> = {};
  for (const p of PALACE_ORDER) {
    if (p === hourPalace) continue;
    kinships[p] = kinshipOf(selfEl, BRANCH_ELEMENT[branches[p]]);
  }
  const fixedKin = fixKinshipMissing(hourPalace, hourBranch, kinships as Record<PalaceName, Kinship>);
  const dayOrderElements = assignDayOrderElements(dayPalace);
  const deities = assignDeities(dayPalace, branches[dayPalace]);

  const board: PalaceCell[] = PALACE_ORDER.map((p) => {
    const br = branches[p];
    const brEl = BRANCH_ELEMENT[br];
    const isSelf = p === hourPalace;
    const k = isSelf ? null : fixedKin[p] ?? null;
    const kEl = k ? kinshipElement(selfEl, k) : null;
    return {
      palace: p,
      palaceElement: PALACE_ELEMENT[p],
      dayOrderElement: dayOrderElements[p],
      branch: br,
      branchElement: brEl,
      kinship: k,
      kinshipElement: kEl,
      deity: deities[p],
      auspice: judge(brEl, kEl),
      isSelf: p === hourPalace,
    };
  });

  return {
    timestamp: local.toISOString().replace("Z", "+08:00"),
    lunarInfo: {
      year: lunar.getYearInGanZhi(),
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
      hour: lunar.getTimeInGanZhi(),
      yearCn: lunar.getYearInChinese(),
      monthCn: (isLeapMonth ? "闰" : "") + lunar.getMonthInChinese(),
      dayCn: lunar.getDayInChinese(),
      hourCn: lunar.getTimeZhi() + "时",
      lunarMonth,
      lunarDay,
      isLeapMonth,
      isYangHour: yang,
      hourBranch,
    },
    monthPalace,
    dayPalace,
    hourPalace,
    selfBranch: hourBranch,
    board,
  };
}
