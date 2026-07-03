const PHRASE_MAP = {
  "凱·哈費爾茨": "凯·哈弗茨",
  "哈費爾茨": "哈弗茨"
};

const CHAR_MAP = {
  "凱": "凯",
  "費": "费",
  "爾": "尔",
  "茲": "兹",
  "亞": "亚",
  "貝": "贝",
  "羅": "罗",
  "維": "维",
  "蘭": "兰",
  "馬": "马",
  "達": "达",
  "國": "国",
  "運": "运",
  "動": "动",
  "員": "员",
  "職": "职",
  "業": "业",
  "選": "选",
  "漢": "汉",
  "勞": "劳",
  "倫": "伦",
  "奧": "奥",
  "別": "别",
  "頓": "顿",
  "聖": "圣",
  "謝": "谢",
  "蓋": "盖",
  "魯": "鲁",
  "澤": "泽",
  "韋": "韦",
  "諾": "诺",
  "喬": "乔",
  "約": "约",
  "萊": "莱",
  "傑": "杰",
  "門": "门",
  "將": "将",
  "龍": "龙",
  "與": "与",
  "臺": "台",
  "灣": "湾",
  "廣": "广",
  "東": "东",
  "裡": "里",
  "裏": "里",
  "強": "强",
  "盃": "杯",
  "萬": "万",
  "實": "实",
  "時": "时",
  "賽": "赛",
  "關": "关",
  "鍵": "键",
  "場": "场",
  "顯": "显",
  "示": "示",
  "隊": "队",
  "勝": "胜",
  "積": "积",
  "線": "线",
  "圖": "图"
};

const TRADITIONAL_PATTERN = new RegExp(`[${Object.keys(CHAR_MAP).join("")}]`, "g");

export function simplifyChinese(value) {
  let text = String(value || "");

  for (const [traditional, simplified] of Object.entries(PHRASE_MAP)) {
    text = text.replaceAll(traditional, simplified);
  }

  return text.replace(TRADITIONAL_PATTERN, (char) => CHAR_MAP[char] || char);
}
