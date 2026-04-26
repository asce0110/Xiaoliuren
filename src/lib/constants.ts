export type Element = "木" | "火" | "土" | "金" | "水";
export type Branch =
  | "子" | "丑" | "寅" | "卯" | "辰" | "巳"
  | "午" | "未" | "申" | "酉" | "戌" | "亥";
export type PalaceName = "大安" | "留连" | "速喜" | "赤口" | "小吉" | "空亡";
export type Kinship = "兄弟" | "妻财" | "官鬼" | "父母" | "子孙";
export type Deity = "青龙" | "朱雀" | "勾陈" | "腾蛇" | "白虎" | "玄武";
export type Auspice = "大吉" | "次吉" | "小凶" | "大凶" | "平";

// 顺时针顺序：大安(1)→留连(2)→速喜(3)→赤口(4)→小吉(5)→空亡(6)
export const PALACE_ORDER: PalaceName[] = [
  "大安", "留连", "速喜", "赤口", "小吉", "空亡",
];

// 网格布局位置（行,列）3x2，对应原 PRD：
// [留连][速喜][赤口]
// [大安][空亡][小吉]
export const PALACE_GRID: Record<PalaceName, { row: number; col: number }> = {
  留连: { row: 0, col: 0 },
  速喜: { row: 0, col: 1 },
  赤口: { row: 0, col: 2 },
  大安: { row: 1, col: 0 },
  空亡: { row: 1, col: 1 },
  小吉: { row: 1, col: 2 },
};

// 宫位固有五行
export const PALACE_ELEMENT: Record<PalaceName, Element> = {
  大安: "木",
  留连: "水",
  速喜: "火",
  赤口: "金",
  小吉: "木",
  空亡: "土",
};

export const BRANCHES: Branch[] = [
  "子", "丑", "寅", "卯", "辰", "巳",
  "午", "未", "申", "酉", "戌", "亥",
];

export const BRANCH_ELEMENT: Record<Branch, Element> = {
  寅: "木", 卯: "木",
  巳: "火", 午: "火",
  辰: "土", 丑: "土", 未: "土", 戌: "土",
  申: "金", 酉: "金",
  子: "水", 亥: "水",
};

// 四孟/四仲/四季
export const SI_MENG: Branch[] = ["寅", "申", "巳", "亥"];
export const SI_ZHONG: Branch[] = ["子", "午", "卯", "酉"];
export const SI_JI: Branch[] = ["辰", "戌", "丑", "未"];

// 时辰（地支）→ 序号 0..11
export function hourBranchIndex(b: Branch): number {
  return BRANCHES.indexOf(b);
}

// 由小时(0..23)推时辰地支：23-1=子 ... 21-23=亥
export function hourToBranch(hour24: number): Branch {
  // 子时跨夜，按"子正换日"约定：23 点仍记当日时柱起算的子时
  const idx = Math.floor(((hour24 + 1) % 24) / 2);
  return BRANCHES[idx];
}

// 五行生克
export function generates(a: Element, b: Element): boolean {
  return (
    (a === "木" && b === "火") ||
    (a === "火" && b === "土") ||
    (a === "土" && b === "金") ||
    (a === "金" && b === "水") ||
    (a === "水" && b === "木")
  );
}
export function controls(a: Element, b: Element): boolean {
  return (
    (a === "木" && b === "土") ||
    (a === "土" && b === "水") ||
    (a === "水" && b === "火") ||
    (a === "火" && b === "金") ||
    (a === "金" && b === "木")
  );
}

// 六亲：以"自身"五行为基准，比对 target 五行
export function kinshipOf(self: Element, target: Element): Kinship {
  if (self === target) return "兄弟";
  if (controls(self, target)) return "妻财"; // 我克者
  if (controls(target, self)) return "官鬼"; // 克我者
  if (generates(target, self)) return "父母"; // 生我者
  return "子孙"; // 我生者
}

// 六亲对应的五行（用于补全后吉凶判定时反查）
export function kinshipElement(self: Element, k: Kinship): Element {
  const all: Element[] = ["木", "火", "土", "金", "水"];
  switch (k) {
    case "兄弟":
      return self;
    case "妻财":
      return all.find((e) => controls(self, e))!;
    case "官鬼":
      return all.find((e) => controls(e, self))!;
    case "父母":
      return all.find((e) => generates(e, self))!;
    case "子孙":
      return all.find((e) => generates(self, e))!;
  }
}

// 六神顺序：从日落宫起顺时针排
export const DEITY_ORDER: Deity[] = [
  "青龙", "朱雀", "勾陈", "腾蛇", "白虎", "玄武",
];

// 按地支判断六神（备用）
export function deityOfBranch(b: Branch): Deity {
  if (b === "寅" || b === "卯") return "青龙";
  if (b === "巳" || b === "午") return "朱雀";
  if (b === "丑" || b === "辰") return "勾陈";
  if (b === "未" || b === "戌") return "腾蛇";
  if (b === "申" || b === "酉") return "白虎";
  return "玄武";
}
