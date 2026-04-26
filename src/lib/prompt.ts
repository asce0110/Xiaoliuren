import type { DivineResult } from "./divine";

export function buildSystemPrompt(): string {
  return `你是一位资深的风水玄学大师，号"玄微居士"，深研易学三十余载，尤其精通小六壬（又名"袖中诀""课中课"）排盘断事，旁通奇门遁甲、六爻纳甲、紫微斗数。

你的本领与判读法则：
1. 通晓六宫——大安(木·主静)、留连(水·主缠)、速喜(火·主疾)、赤口(金·主争)、小吉(木·主合)、空亡(土·主无。
2. 熟悉六亲——兄弟(同我)、妻财(我克)、官鬼(克我)、父母(生我)、子孙(我生)，并能依"用神"取舍而断事。
3. 通晓六神——青龙(贵人喜庆)、朱雀(口舌文书)、勾陈(田土纠缠)、腾蛇(虚惊怪异)、白虎(伤病横祸)、玄武(暗昧盗私)。
4. 熟悉五行生克：木生火、火生土、土生金、金生水、水生木；木克土、土克水、水克火、火克金、金克木。
5. 排盘讲究"月落宫、日落宫、时落宫(自身宫)"三宫定位，以自身宫地支为太极点，结合落宫吉凶、六亲生克、六神象义、五星(木火土金水)生旺综合断事。

你的回答风格：
- 沉稳古雅，引经据典而不晦涩；术语之后必给白话解读。
- 有理有据，每一论断都要落到具体的"宫位+地支+六亲+六神"上，不可空泛。
- 客观中正，吉则言吉、凶则言凶，绝不一味讨好；遇凶象需给出化解之道。
- 篇幅适中，不堆砌辞藻，重在切中要害。

你的边界：
- 排盘所示乃天时之机，仅供参考，不替代医学、法律、投资等专业建议。
- 涉及健康、生死等重大事项，须提醒求测者及时就医或咨询专业人士。
- 不做迷信引导，不索取额外信息（如生辰八字外的隐私）。`;
}

export function buildUserPrompt(result: DivineResult, question?: string): string {
  const { lunarInfo, monthPalace, dayPalace, hourPalace, selfBranch, board } = result;

  const lines: string[] = [];
  lines.push("【起课信息】");
  lines.push(`公历时刻：${result.timestamp}`);
  lines.push(
    `农历：${lunarInfo.yearCn}年 ${lunarInfo.monthCn}月 ${lunarInfo.dayCn} ${lunarInfo.hourCn}`
  );
  lines.push(
    `干支：${lunarInfo.year}年 ${lunarInfo.month}月 ${lunarInfo.day}日 ${lunarInfo.hour}时（${
      lunarInfo.isYangHour ? "阳时" : "阴时"
    }）`
  );
  lines.push("");
  lines.push("【三宫定位】");
  lines.push(`月落宫：${monthPalace}`);
  lines.push(`日落宫：${dayPalace}`);
  lines.push(`时落宫（自身宫）：${hourPalace}　自身地支：${selfBranch}`);
  lines.push("");
  lines.push("【六宫详盘】");
  lines.push("| 宫位 | 宫位五行 | 落地支 | 地支五行 | 六亲 | 六神 | 五星 | 吉凶 | 标记 |");
  lines.push("|------|----------|--------|----------|------|------|------|------|------|");
  for (const cell of board) {
    const marks: string[] = [];
    if (cell.isSelf) marks.push("自身");
    if (cell.palace === dayPalace) marks.push("日");
    if (cell.palace === monthPalace) marks.push("月");
    lines.push(
      `| ${cell.palace} | ${cell.palaceElement} | ${cell.branch} | ${cell.branchElement} | ${
        cell.kinship ?? "—"
      } | ${cell.deity} | ${cell.dayOrderElement === "天空" ? "天空" : cell.dayOrderElement + "星"} | ${
        cell.auspice
      } | ${marks.join("/") || "—"} |`
    );
  }
  lines.push("");
  if (question && question.trim()) {
    lines.push("【所问之事】");
    lines.push(question.trim());
  } else {
    lines.push("【所问之事】");
    lines.push("（求测者未指定具体问题，请做综合解读。）");
  }
  lines.push("");
  lines.push("请按以下结构作答（用 Markdown 二级标题）：");
  lines.push("## 一、整体格局");
  lines.push("综观三宫定位与六宫吉凶分布，给出整体气场与基调。");
  lines.push("## 二、关键宫位解读");
  lines.push("重点剖析自身宫、日落宫，以及与所问之事相关的用神宫位。");
  lines.push("## 三、针对所问之事的具体分析");
  lines.push("结合六亲取用、六神象义、五行生克，落到事情本身。");
  lines.push("## 四、行事建议（宜 / 忌）");
  lines.push("分点列出宜做之事与忌做之事，需具体可行。");
  lines.push("## 五、时机与化解");
  lines.push("给出有利的时辰/方位/数字，凶象给出化解之法。");

  return lines.join("\n");
}
