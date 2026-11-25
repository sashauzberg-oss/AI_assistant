// Nova's pixel pets: 16×16 sprites drawn in code, with blink and talk frames.
// Each sprite row is a string; every character is one pixel ("." is transparent).

export const PETS = {
  cat: {
    name: "Mochi",
    animal: "cat",
    sound: "Meow!",
    palette: { o: "#3b2a20", O: "#f4a340", d: "#d9822b", w: "#fff4e6", p: "#ff8fab", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "..oo........oo..",
      ".oOOo......oOOo.",
      ".oOpOooooooOpOo.",
      "oOOOOOdOOdOOOOOo",
      "oOOOOOOOOOOOOOOo",
      "oOOkhOOOOOOkhOOo",
      "oOOkkOOOOOOkkOOo",
      "oOpOwwwppwwwOpOo",
      "oOOOwwkwwkwwOOOo",
      ".oOOOwwkkwwOOOo.",
      "..ooOOOOOOOOoo..",
      "..oOOwwwwwwOOo..",
      ".oOOOwwwwwwOOOoo",
      ".oOOOwwwwwwOOOdo",
      ".oOwwOOOOOOwwOo.",
      "..oooooooooooo..",
    ],
    blink: [[5, 3, "O"], [5, 4, "O"], [5, 11, "O"], [5, 12, "O"]],
    talk: [[8, 7, "k"], [8, 8, "k"], [9, 7, "p"], [9, 8, "p"]],
  },
  dog: {
    name: "Biscuit",
    animal: "dog",
    sound: "Woof!",
    palette: { o: "#3a2618", C: "#f6dfb5", B: "#a0612d", w: "#ffffff", p: "#ff8fab", k: "#1b1b2f", h: "#ffffff", n: "#2b1d14" },
    rows: [
      "....oooooooo....",
      "...oCCCCCCCCo...",
      ".ooCCCCCCCCCCoo.",
      "oBBoCCCCCCCCoBBo",
      "oBBCkhCCCCkhCBBo",
      "oBBCkkCCCCkkCBBo",
      "oBBpCCCnnCCCpBBo",
      "oBBCCCkCCkCCCBBo",
      ".oBBoCCkkCCoBBo.",
      "..oo.oCCCCo.oo..",
      "....oCCCCCCo....",
      "...oCCwwwwCCo...",
      "..oCCCwwwwCCCooo",
      "..oCCCwwwwCCCoBo",
      "..oCwwCCCCwwCo..",
      "...oooooooooo...",
    ],
    blink: [[4, 4, "C"], [4, 5, "C"], [4, 10, "C"], [4, 11, "C"]],
    talk: [[7, 7, "k"], [7, 8, "k"], [8, 7, "p"], [8, 8, "p"]],
  },
  bunny: {
    name: "Clover",
    animal: "bunny",
    sound: "*nose wiggle*",
    palette: { o: "#4a4a68", W: "#fbfbff", g: "#dcdcef", p: "#ff9ec0", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "...oo......oo...",
      "..oWWo....oWWo..",
      "..oWpo....opWo..",
      "..oWpo....opWo..",
      "..oWpo....opWo..",
      "..oWWoooooooWWo.",
      ".oWWWWWWWWWWWWo.",
      "oWWWWWWWWWWWWWWo",
      "oWWkhWWWWWWkhWWo",
      "oWWkkWWWWWWkkWWo",
      "oWpWWWWppWWWWpWo",
      "oWWWWWkWWkWWWWWo",
      ".oWWWWWkkWWWWWo.",
      "..ooWWWWWWWWoo..",
      ".oWWWgWWWWgWWWo.",
      "..oooooooooooo..",
    ],
    blink: [[8, 3, "W"], [8, 4, "W"], [8, 11, "W"], [8, 12, "W"]],
    talk: [[11, 7, "k"], [11, 8, "k"], [12, 7, "p"], [12, 8, "p"]],
  },
  fox: {
    name: "Ember",
    animal: "fox",
    sound: "Yip!",
    palette: { o: "#3a1f14", F: "#f07f2e", w: "#fff7ec", k: "#1b1b2f", h: "#ffffff", p: "#ff8fab" },
    rows: [
      ".o............o.",
      ".oo..........oo.",
      ".oFo........oFo.",
      ".oFFo......oFFo.",
      ".oFFFooooooFFFo.",
      "oFFFFFFFFFFFFFFo",
      "oFFFFFFFFFFFFFFo",
      "oFFkhFFFFFFkhFFo",
      "oFwkkFFFFFFkkwFo",
      "owwwwwFkkFwwwwwo",
      ".owwwwkwwkwwwwo.",
      "..oowwwkkwwwoo..",
      "....oFFFFFFo.oo.",
      "...oFFwwwwFFoFFo",
      "...oFwwFFwwFoFwo",
      "....ooooooooooo.",
    ],
    blink: [[7, 3, "F"], [7, 4, "F"], [7, 11, "F"], [7, 12, "F"]],
    talk: [[10, 7, "k"], [10, 8, "k"], [11, 7, "p"], [11, 8, "p"]],
  },
  frog: {
    name: "Pip",
    animal: "frog",
    sound: "Ribbit!",
    palette: { o: "#1f3a1f", G: "#6cc644", L: "#c7f08a", w: "#ffffff", k: "#1b1b2f", p: "#ff9eb5", m: "#2d4d1f" },
    rows: [
      "..oooo....oooo..",
      ".oGwwGo..oGwwGo.",
      ".oGwkGooooGwkGo.",
      "oGGGGGGGGGGGGGGo",
      "oGGGGGGGGGGGGGGo",
      "oGpGGGGGGGGGGpGo",
      "oGGmGGGGGGGGmGGo",
      ".oGGmmmmmmmmGGo.",
      "..oGGGGGGGGGGo..",
      ".oGGLLLLLLLLGGo.",
      "oGGGLLLLLLLLGGGo",
      "oGGGLLLLLLLLGGGo",
      ".oGGGLLLLLLGGGo.",
      "oGGGooGGGGooGGGo",
      "oGGo..oGGo..oGGo",
      ".oo....oo....oo.",
    ],
    blink: [[1, 3, "G"], [1, 4, "G"], [1, 11, "G"], [1, 12, "G"], [2, 3, "m"], [2, 4, "m"], [2, 11, "m"], [2, 12, "m"]],
    talk: [[7, 5, "p"], [7, 6, "p"], [7, 7, "p"], [7, 8, "p"], [7, 9, "p"], [7, 10, "p"], [8, 6, "m"], [8, 7, "m"], [8, 8, "m"], [8, 9, "m"]],
  },
  penguin: {
    name: "Waddles",
    animal: "penguin",
    sound: "*happy flap*",
    palette: { o: "#14142a", N: "#2b2d42", W: "#ffffff", Y: "#ffb703", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".....oooooo.....",
      "...ooNNNNNNoo...",
      "..oNNNNNNNNNNo..",
      ".oNNNWWWWWWNNNo.",
      ".oNNWWWWWWWWNNo.",
      ".oNWkhWWWWkhWNo.",
      ".oNWkkWYYWkkWNo.",
      ".oNWpWYYYYWpWNo.",
      "oNNWWWWYYWWWWNNo",
      "oNNWWWWWWWWWWNNo",
      "oNNWWWWWWWWWWNNo",
      "oNNWWWWWWWWWWNNo",
      ".oNWWWWWWWWWWNo.",
      ".oNNWWWWWWWWNNo.",
      "..ooNNNNNNNNoo..",
      "..oYYYo..oYYYo..",
    ],
    blink: [[5, 4, "W"], [5, 5, "W"], [5, 10, "W"], [5, 11, "W"]],
    talk: [[7, 7, "p"], [7, 8, "p"]],
  },
  panda: {
    name: "Bao",
    animal: "panda",
    sound: "*munch munch*",
    palette: { o: "#1b1b2f", W: "#ffffff", B: "#2b2b3a", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "..ooo......ooo..",
      ".oBBBo....oBBBo.",
      ".oBBBooooooBBBo.",
      "..ooWWWWWWWWoo..",
      ".oWWWWWWWWWWWWo.",
      "oWWBBBWWWWBBBWWo",
      "oWBBhBWWWWBhBBWo",
      "oWBBBBWWWWBBBBWo",
      "oWWBBWWkkWWBBWWo",
      "oWpWWWkWWkWWWpWo",
      ".oWWWWWkkWWWWWo.",
      "..ooWWWWWWWWoo..",
      ".oBBWWWWWWWWBBo.",
      "oBBBWWWWWWWWBBBo",
      ".oBBBWWWWWWBBBo.",
      "..oooooooooooo..",
    ],
    blink: [[6, 4, "B"], [6, 11, "B"]],
    talk: [[9, 7, "k"], [9, 8, "k"], [10, 7, "p"], [10, 8, "p"]],
  },
  owl: {
    name: "Sage",
    animal: "owl",
    sound: "Hoo hoo!",
    palette: { o: "#2e1d14", U: "#a0693c", D: "#6b4226", L: "#ecd2a8", w: "#ffffff", k: "#1b1b2f", Y: "#ffb703" },
    rows: [
      "..o..........o..",
      ".oUo........oUo.",
      ".oUUooooooooUUo.",
      "oUUUUUUUUUUUUUUo",
      "oUwwwwUUUUwwwwUo",
      "owwkkwwUUwwkkwwo",
      "owwkkwwYYwwkkwwo",
      "oUwwwwUYYUwwwwUo",
      "oUUUUUUUUUUUUUUo",
      "oUDLLLLLLLLLLDUo",
      "oUDLLLLLLLLLLDUo",
      "oUDLLDLLDLLDLDUo",
      ".oUDLLLLLLLLDUo.",
      "..oUDLLLLLLDUo..",
      "...oUUUUUUUUo...",
      "...oYYo..oYYo...",
    ],
    blink: [[4, 2, "U"], [4, 3, "U"], [4, 4, "U"], [4, 5, "U"], [4, 10, "U"], [4, 11, "U"], [4, 12, "U"], [4, 13, "U"],
      [5, 1, "D"], [5, 2, "D"], [5, 3, "D"], [5, 4, "D"], [5, 5, "D"], [5, 6, "D"], [5, 9, "D"], [5, 10, "D"], [5, 11, "D"], [5, 12, "D"], [5, 13, "D"], [5, 14, "D"],
      [6, 1, "U"], [6, 2, "U"], [6, 3, "U"], [6, 4, "U"], [6, 5, "U"], [6, 6, "U"], [6, 9, "U"], [6, 10, "U"], [6, 11, "U"], [6, 12, "U"], [6, 13, "U"], [6, 14, "U"],
      [7, 2, "U"], [7, 3, "U"], [7, 4, "U"], [7, 5, "U"], [7, 10, "U"], [7, 11, "U"], [7, 12, "U"], [7, 13, "U"]],
    talk: [[7, 7, "k"], [7, 8, "k"]],
  },
  hamster: {
    name: "Peanut",
    animal: "hamster",
    sound: "Squeak!",
    palette: { o: "#4a2c1a", H: "#f2b256", w: "#fff6e6", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "...oo......oo...",
      "..opHo....oHpo..",
      "..oHHooooooHHo..",
      ".oHHHHHHHHHHHHo.",
      "oHHHHHHHHHHHHHHo",
      "oHHkhHHHHHHkhHHo",
      "oHHkkHHwwHHkkHHo",
      "oHpwwwwppwwwwpHo",
      "oHwwwwkwwkwwwwHo",
      "oHwwwwwkkwwwwwHo",
      ".oHwwwwwwwwwwHo.",
      "oHHwwwwwwwwwwHHo",
      "oHpwwwwwwwwwwpHo",
      "oHHwwwwwwwwwwHHo",
      ".oHHHwwwwwwHHHo.",
      "..oooooooooooo..",
    ],
    blink: [[5, 3, "H"], [5, 4, "H"], [5, 11, "H"], [5, 12, "H"]],
    talk: [[8, 7, "k"], [8, 8, "k"], [9, 7, "p"], [9, 8, "p"]],
  },
  duck: {
    name: "Puddles",
    animal: "duck",
    sound: "Quack!",
    palette: { o: "#5a3d00", Y: "#ffd93d", O: "#ff8c1a", w: "#fff1a8", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".......oo.......",
      "......oYYo......",
      "....ooYYYYoo....",
      "...oYYYYYYYYo...",
      "..oYYYYYYYYYYo..",
      "..oYkhYYYYkhYo..",
      "..oYkkYYYYkkYo..",
      "..opYYOOOOYYpo..",
      "..oYYYYOOYYYYo..",
      ".ooYYYYYYYYYYoo.",
      "oYYwYYYYYYYYwYYo",
      "oYwwYYYYYYYYwwYo",
      "oYYwYYYYYYYYwYYo",
      ".oYYYYYYYYYYYYo.",
      "..ooYYYYYYYYoo..",
      "...oOOo..oOOo...",
    ],
    blink: [[5, 4, "Y"], [5, 5, "Y"], [5, 10, "Y"], [5, 11, "Y"]],
    talk: [[8, 7, "k"], [8, 8, "k"], [9, 7, "O"], [9, 8, "O"]],
  },
  axolotl: {
    name: "Bubbles",
    animal: "axolotl",
    sound: "*blub*",
    palette: { o: "#5c2346", P: "#ffb3d1", G: "#ff5fa2", d: "#f28ab8", w: "#ffe3ef", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "oG............Go",
      ".oG..oooooo..Go.",
      "oGGooPPPPPPooGGo",
      ".oGPPPPPPPPPPGo.",
      "oGGPPPPPPPPPPGGo",
      ".oPPkhPPPPkhPPo.",
      ".oPPkkPPPPkkPPo.",
      ".oPdPPPPPPPPdPo.",
      ".oPPPkPPPPkPPPo.",
      "..oPPPkkkkPPPo..",
      "...ooPPPPPPoo...",
      "...oPPwwwwPPo...",
      "..oPPPwwwwPPPo..",
      "..oPPPwwwwPPPoo.",
      "..oPoPPPPPPoPPdo",
      "...o.oooooo.ooo.",
    ],
    blink: [[5, 4, "P"], [5, 5, "P"], [5, 10, "P"], [5, 11, "P"]],
    talk: [[9, 7, "G"], [9, 8, "G"], [10, 7, "k"], [10, 8, "k"]],
  },
  dragon: {
    name: "Ziggy",
    animal: "dragon",
    sound: "Rawr!",
    palette: { o: "#1f3324", D: "#4fc38a", L: "#d9f99d", Y: "#ffd166", R: "#2f9e6e", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "..oY........Yo..",
      "..oYo......oYo..",
      "..ooDooooooDoo..",
      ".oDDDDDDDDDDDDo.",
      "oDDDDDDDDDDDDDDo",
      "oDDkhDDDDDDkhDDo",
      "oDDkkDDDDDDkkDDo",
      "oDpDDDDooDDDDpDo",
      "oDDDDDkDDkDDDDDo",
      "RoDDDDDkkDDDDDoR",
      "RRoDDLLLLLLDDoRR",
      "RRRoDLLLLLLDoRRR",
      ".RRoDLLLLLLDoRR.",
      "..oDDDLLLLDDDoDo",
      "..oDDDoDDoDDDo..",
      "...ooo.oo.ooo...",
    ],
    blink: [[5, 3, "D"], [5, 4, "D"], [5, 11, "D"], [5, 12, "D"]],
    talk: [[8, 7, "k"], [8, 8, "k"], [9, 7, "p"], [9, 8, "p"]],
  },
  unicorn: {
    name: "Sprinkles",
    animal: "unicorn",
    sound: "*sparkle*",
    palette: { o: "#4a3b6b", W: "#ffffff", H: "#ffd166", m: "#ff8fc7", v: "#b48cff", c: "#7fdcff", P: "#ffe0ee", n: "#d8a8c8", p: "#ffb3c8", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".......oo.......",
      "......oHHo......",
      "..oo..oHHo..oo..",
      ".oWWo.oHHo.oWWo.",
      ".omvcoooooocvmo.",
      "omvWWWWWWWWWWvmo",
      "omWWkhWWWWkhWWmo",
      "ocWWkkWWWWkkWWco",
      "ovWpWWWWWWWWpWvo",
      "omWWPPPPPPPPWWmo",
      ".oWPPnPPPPnPPWo.",
      ".oWPPPkPPkPPPWo.",
      "..oWPPPkkPPPWo..",
      "...ooWWWWWWoo...",
      "..oWWWWWWWWWWo..",
      "..oooooooooooo..",
    ],
    blink: [[6, 4, "W"], [6, 5, "W"], [6, 10, "W"], [6, 11, "W"]],
    talk: [[11, 7, "k"], [11, 8, "k"], [12, 7, "p"], [12, 8, "p"]],
  },
  pig: {
    name: "Truffle",
    animal: "pig",
    sound: "Oink!",
    palette: { o: "#6b2d45", P: "#ffb6c9", S: "#ff8fab", n: "#b0476b", d: "#f59ab5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "..oo........oo..",
      ".oPPo......oPPo.",
      ".oPdPooooooPdPo.",
      "oPPPPPPPPPPPPPPo",
      "oPPPPPPPPPPPPPPo",
      "oPPkhPPPPPPkhPPo",
      "oPPkkPPPPPPkkPPo",
      "oPdPPPSSSSPPPdPo",
      "oPPPPSnSSnSPPPPo",
      "oPPPPPSSSSPPPPPo",
      ".oPPPPkPPkPPPPo.",
      "..oPPPPkkPPPPo..",
      "..ooPPPPPPPPoo..",
      ".oPPPPPPPPPPPPoo",
      ".oPPoPPPPPPoPPdo",
      "..oo.oooooo.oo..",
    ],
    blink: [[5, 3, "P"], [5, 4, "P"], [5, 11, "P"], [5, 12, "P"]],
    talk: [[10, 7, "k"], [10, 8, "k"], [11, 7, "S"], [11, 8, "S"]],
  },
  koala: {
    name: "Mango",
    animal: "koala",
    sound: "*yawn*",
    palette: { o: "#2d2d3a", G: "#a9b0bd", L: "#e6e8ee", N: "#3a3a48", w: "#f2f3f6", p: "#ffb3c8", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".ooo........ooo.",
      "oGGGo......oGGGo",
      "oGLGooooooooGLGo",
      "oGGGGGGGGGGGGGGo",
      ".oGGGGGGGGGGGGo.",
      ".oGkhGGGGGGkhGo.",
      ".oGkkGGNNGGkkGo.",
      ".oGpGGNNNNGGpGo.",
      ".oGGGGNNNNGGGGo.",
      ".oGGGGGNNGGGGGo.",
      "..oGGGkGGkGGGo..",
      "...ooGGkkGGoo...",
      "..oGGGwwwwGGGo..",
      ".oGGGwwwwwwGGGo.",
      ".oGGwwGGGGwwGGo.",
      "..oooooooooooo..",
    ],
    blink: [[5, 3, "G"], [5, 4, "G"], [5, 11, "G"], [5, 12, "G"]],
    talk: [[10, 7, "k"], [10, 8, "k"], [11, 7, "p"], [11, 8, "p"]],
  },
  turtle: {
    name: "Shelly",
    animal: "turtle",
    sound: "*slow wave*",
    palette: { o: "#1f3a24", T: "#8fd16a", S: "#a8642c", s: "#d9934a", p: "#ffb3c8", k: "#1b1b2f" },
    rows: [
      "......oooo......",
      ".....oTTTTo.....",
      "....oTTTTTTo....",
      "....oTkTTkTo....",
      "....oTkTTkTo....",
      "....opTkkTpo....",
      ".....oTTTTo.....",
      "..ooooSSSSoooo..",
      ".oTSSsSSSSsSSTo.",
      "oTTSsssSSsssSTTo",
      "oTSSSsSSSSsSSSTo",
      ".oSSsssSSsssSSo.",
      ".oSSSsSSSSsSSSo.",
      "..oSSSSSSSSSSo..",
      ".oTTooooooooTTo.",
      ".ooo........ooo.",
    ],
    blink: [[3, 6, "T"], [3, 9, "T"]],
    talk: [[5, 7, "p"], [5, 8, "p"]],
  },
  octopus: {
    name: "Inky",
    animal: "octopus",
    sound: "*wiggle wiggle*",
    palette: { o: "#3d1d5c", V: "#b48cff", w: "#dcc9ff", p: "#ff9ec7", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "................",
      ".....oooooo.....",
      "...ooVVVVVVoo...",
      "..oVVwVVVVVVVo..",
      ".oVVVVVVVVwVVVo.",
      ".oVVkhVVVVkhVVo.",
      ".oVVkkVVVVkkVVo.",
      ".oVpVVVkkVVVpVo.",
      ".oVVVVVVVVVVVVo.",
      ".oVVVVVVVVVVVVo.",
      ".oVoVVoVVoVVoVo.",
      ".oVoVVoVVoVVoVo.",
      "oVo.oVo..oVo.oVo",
      "oVo.oVo..oVo.oVo",
      "oo..oo....oo..oo",
      "................",
    ],
    blink: [[5, 4, "V"], [5, 5, "V"], [5, 10, "V"], [5, 11, "V"]],
    talk: [[7, 7, "p"], [7, 8, "p"]],
  },
  raccoon: {
    name: "Bandit",
    animal: "raccoon",
    sound: "*rustle rustle*",
    palette: { o: "#22222e", G: "#9aa0ad", B: "#2e2e3a", w: "#f4f4f8", h: "#ffffff", n: "#1b1b2f", p: "#ffb3c8", k: "#1b1b2f" },
    rows: [
      "..oo........oo..",
      ".oGGo......oGGo.",
      ".oGwGooooooGwGo.",
      "oGGGGGGGGGGGGGGo",
      "owwGGGGGGGGGGwwo",
      "oBBBBBwwwwBBBBBo",
      "oBBhBBwwwwBBhBBo",
      "oGBBBGwwwwGBBBGo",
      "oGGGwwwnnwwwGGGo",
      "oGpGwwkwwkwwGpGo",
      ".oGGwwwkkwwwGGo.",
      "..ooGGGGGGGGoo..",
      ".oGGGwwwwwwGGGo.",
      ".oGGGwwwwwwGGGo.",
      ".oGGooGGGGooGGo.",
      "..oo..oooo..oo..",
    ],
    blink: [[6, 3, "B"], [6, 12, "B"]],
    talk: [[9, 7, "k"], [9, 8, "k"], [10, 7, "p"], [10, 8, "p"]],
  },
  bear: {
    name: "Honey",
    animal: "bear",
    sound: "*big hug*",
    palette: { o: "#3b2414", B: "#b5773f", L: "#e9c99a", n: "#2b1a0e", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".ooo........ooo.",
      "oBBBo......oBBBo",
      "oBLBooooooooBLBo",
      "oBBBBBBBBBBBBBBo",
      ".oBBBBBBBBBBBBo.",
      ".oBkhBBBBBBkhBo.",
      ".oBkkBBBBBBkkBo.",
      ".oBpBBLLLLBBpBo.",
      ".oBBBLLnnLLBBBo.",
      ".oBBBLkLLkLBBBo.",
      "..oBBBLkkLBBBo..",
      "...ooBBBBBBoo...",
      "..oBBBLLLLBBBo..",
      ".oBBBLLLLLLBBBo.",
      ".oBLLBBBBBBLLBo.",
      "..oooooooooooo..",
    ],
    blink: [[5, 3, "B"], [5, 4, "B"], [5, 11, "B"], [5, 12, "B"]],
    talk: [[9, 7, "k"], [9, 8, "k"], [10, 7, "p"], [10, 8, "p"]],
  },
  hedgehog: {
    name: "Bramble",
    animal: "hedgehog",
    sound: "*snuffle*",
    palette: { o: "#3a2a1e", S: "#7a5537", s: "#a8774f", F: "#f5d9b5", n: "#2b1a0e", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "..o.o.o..o.o.o..",
      ".oSoSoSooSoSoSo.",
      "oSSSsSSSSSSsSSSo",
      "oSsSSSSsSSSSSsSo",
      "oSSSSFFFFFFSSSSo",
      "oSsSFFFFFFFFSsSo",
      "oSSFFkhFFkhFFSSo",
      "oSSFFkkFFkkFFSSo",
      "oSsFpFFnnFFpFsSo",
      "oSSFFFkFFkFFFSSo",
      ".oSFFFFkkFFFFSo.",
      ".oSSFFFFFFFFSSo.",
      "..oSSFFFFFFSSo..",
      "..oSSFFFFFFSSo..",
      "..ooFFooooFFoo..",
      "...oo......oo...",
    ],
    blink: [[6, 5, "F"], [6, 6, "F"], [6, 9, "F"], [6, 10, "F"]],
    talk: [[9, 7, "k"], [9, 8, "k"], [10, 7, "p"], [10, 8, "p"]],
  },
  capybara: {
    name: "Yuzu",
    animal: "capybara",
    sound: "*chill*",
    palette: { o: "#3d2a18", C: "#b07a46", D: "#8a5a30", N: "#5a3a20", Y: "#ff9f1c", g: "#5cb85c", p: "#ff9eb5", k: "#1b1b2f" },
    rows: [
      ".......gg.......",
      "......oYYo......",
      "..oo.oYYYYo.oo..",
      ".oCCooooooooCCo.",
      ".oCCCCCCCCCCCCo.",
      "oCCCCCCCCCCCCCCo",
      "oCCkCCCCCCCCkCCo",
      "oCCkCCCCCCCCkCCo",
      "oCpCCDDDDDDCCpCo",
      "oCCCDNDDDDNDCCCo",
      "oCCCDDDkkDDDCCCo",
      ".oCCCDDDDDDCCCo.",
      ".oCCCCCCCCCCCCo.",
      "oCCCCCCCCCCCCCCo",
      "oCCooCCCCCCooCCo",
      ".oo..oooooo..oo.",
    ],
    blink: [[6, 3, "C"], [6, 12, "C"]],
    talk: [[10, 7, "p"], [10, 8, "p"]],
  },
  sheep: {
    name: "Cotton",
    animal: "sheep",
    sound: "Baa!",
    palette: { o: "#3a3a4a", W: "#ffffff", w: "#e6e6f0", F: "#f6d5c6", e: "#e8b0a0", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "....oo.oo.oo....",
      "...oWWoWWoWWo...",
      "..oWWWWwWWwWWWo.",
      ".oWWwWWWWWWWwWWo",
      "oWWWWFFFFFFWWWWo",
      "oeeWFFFFFFFFWeeo",
      "oeeFFkhFFkhFFeeo",
      "oWWFFkkFFkkFFWWo",
      "oWWFpFFFFFFpFWWo",
      "oWWFFFkFFkFFFWWo",
      "oWWWFFFkkFFFWWWo",
      ".oWWWFFFFFFWWWo.",
      "oWWwWWWWWWWWwWWo",
      "oWWWWwWWWWwWWWWo",
      ".oWWoFFooFFoWWo.",
      "..oo.oo..oo.oo..",
    ],
    blink: [[6, 5, "F"], [6, 6, "F"], [6, 9, "F"], [6, 10, "F"]],
    talk: [[9, 7, "k"], [9, 8, "k"], [10, 7, "p"], [10, 8, "p"]],
  },
  shark: {
    name: "Finn",
    animal: "shark",
    sound: "*chomp chomp*",
    palette: { o: "#1d2b3a", S: "#5b8fc7", W: "#f2f7fb", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".......oo.......",
      "......oSSo......",
      ".....oSSSSo.....",
      "...ooSSSSSSoo...",
      "..oSSSSSSSSSSo..",
      ".oSSkhSSSSkhSSo.",
      ".oSSkkSSSSkkSSo.",
      "oSSpSSSSSSSSpSSo",
      "oSSWWWWWWWWWWSSo",
      "oSWWkWkWWkWkWWSo",
      "oSWWWkkkkkkWWWSo",
      "oSSWWWWWWWWWWSSo",
      ".oSSWWWWWWWWSSo.",
      "oSooSSWWWWSSooSo",
      ".o..oSSSSSSo..o.",
      ".....oooooo.....",
    ],
    blink: [[5, 4, "S"], [5, 5, "S"], [5, 10, "S"], [5, 11, "S"]],
    talk: [[10, 7, "p"], [10, 8, "p"]],
  },
  lion: {
    name: "Leo",
    animal: "lion",
    sound: "Roar!",
    palette: { o: "#4a2a12", M: "#c8642a", m: "#e08a3c", Y: "#f6c56a", L: "#fbe3b0", n: "#6b3a1e", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "...oooooooooo...",
      "..oMMmMMMMmMMo..",
      ".oMmMMMMMMMMmMo.",
      "oMMoYYYYYYYYoMMo",
      "oMmYYYYYYYYYYmMo",
      "oMYYkhYYYYkhYYMo",
      "oMYYkkYYYYkkYYMo",
      "omYpYYLLLLYYpYmo",
      "oMYYYLLnnLLYYYMo",
      "oMYYYLkLLkLYYYMo",
      "oMmYYYLkkLYYYmMo",
      ".oMMYYYYYYYYMMo.",
      "..oMMmMMMMmMMo..",
      "...ooYYYYYYoo...",
      "..oYYLLLLLLYYo..",
      "..oooooooooooo..",
    ],
    blink: [[5, 4, "Y"], [5, 5, "Y"], [5, 10, "Y"], [5, 11, "Y"]],
    talk: [[9, 7, "k"], [9, 8, "k"], [10, 7, "p"], [10, 8, "p"]],
  },
};

export const PET_KINDS = Object.keys(PETS);

/** Draw a pet into a 16×16 canvas. Scale it up in CSS with image-rendering: pixelated. */
export function drawPet(canvas, kind, { blink = false, talk = false } = {}) {
  const pet = PETS[kind] || PETS.cat;
  if (canvas.width !== 16) canvas.width = 16;
  if (canvas.height !== 16) canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 16, 16);
  const grid = pet.rows.map((row) => row.split(""));
  if (blink) for (const [r, c, ch] of pet.blink) grid[r][c] = ch;
  if (talk) for (const [r, c, ch] of pet.talk) grid[r][c] = ch;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const color = pet.palette[grid[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** A data URL of a pet frame, for places that can't share canvases (the snip answer bubble). */
export function petImage(kind, frame = {}) {
  const canvas = document.createElement("canvas");
  drawPet(canvas, kind, frame);
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------- the pet on screen

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`nova:${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`nova:${key}`, JSON.stringify(value));
    } catch {
      // storage unavailable
    }
  },
};

/**
 * Keeps every pet sprite on the page in sync and animated.
 * States: idle, thinking, talking, happy, dancing, sleeping.
 */
export class PetBuddy extends EventTarget {
  constructor() {
    super();
    const saved = store.get("petKind", "cat");
    this.kind = PETS[saved] ? saved : "cat";
    this.customName = store.get("petName", "");
    this.state = "idle";
    this.live = new Set(); // animated sprites (the pet next to the bar)
    this.stills = new Set(); // little avatars next to answers
    this.docks = new Set(); // elements that show the state (bobbing, "...", "z")
    this.isPlaying = () => false;
    this.tick = 0;
    this.blinkUntil = 0;
    this.nextBlink = Date.now() + 2500;
    setInterval(() => this.frame(), 110);
  }

  get pet() {
    return PETS[this.kind];
  }

  get name() {
    return this.customName || this.pet.name;
  }

  /** What the AI needs to play the pet. */
  get persona() {
    return { kind: this.kind, animal: this.pet.animal, name: this.name, sound: this.pet.sound };
  }

  sprite({ live = false, className = "" } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    canvas.className = `pet-sprite ${className}`.trim();
    canvas.setAttribute("aria-hidden", "true");
    drawPet(canvas, this.kind);
    (live ? this.live : this.stills).add(canvas);
    return canvas;
  }

  dock(element) {
    this.docks.add(element);
    element.dataset.state = this.state;
  }

  setKind(kind) {
    if (!PETS[kind]) return false;
    this.kind = kind;
    store.set("petKind", kind);
    for (const canvas of [...this.stills]) {
      if (!canvas.isConnected && canvas.dataset.seen) this.stills.delete(canvas);
      else drawPet(canvas, kind);
    }
    this.frame(true);
    this.setState("happy", 1300);
    this.dispatchEvent(new Event("change"));
    return true;
  }

  setName(name) {
    this.customName = String(name || "").trim().slice(0, 24);
    store.set("petName", this.customName);
    this.dispatchEvent(new Event("change"));
  }

  restingState() {
    return this.isPlaying() ? "dancing" : "idle";
  }

  /** Change state; with `ms`, go back to resting afterwards. */
  setState(state, ms = 0) {
    clearTimeout(this.stateTimer);
    this.state = state;
    if (ms) this.stateTimer = setTimeout(() => this.setState(this.restingState()), ms);
    for (const dock of this.docks) dock.dataset.state = state;
    this.frame(true);
  }

  frame(force = false) {
    const now = Date.now();
    if (now > this.nextBlink) {
      this.blinkUntil = now + 170;
      this.nextBlink = now + 2200 + Math.random() * 3800;
    }
    this.tick++;
    const blink = this.state === "sleeping" || now < this.blinkUntil;
    const talk = this.state === "talking" && this.tick % 3 !== 0;
    const key = `${this.kind}|${blink}|${talk}`;
    if (key === this.lastKey && !force) return;
    this.lastKey = key;
    for (const canvas of this.live) drawPet(canvas, this.kind, { blink, talk });
    for (const canvas of this.stills) if (canvas.isConnected) canvas.dataset.seen = "1";
  }

  /** Frames as images, for the snip answer bubble (a separate window). */
  frames() {
    return { normal: petImage(this.kind), talk: petImage(this.kind, { talk: true }), blink: petImage(this.kind, { blink: true }) };
  }
}

/** The "choose your pet" panel: one button per animal, plus a name field. */
export function createPetPicker(buddy) {
  const title = document.createElement("div");
  title.className = "pet-picker-title";
  title.textContent = "CHOOSE YOUR PET";
  const grid = document.createElement("div");
  grid.className = "pet-grid";
  const buttons = PET_KINDS.map((kind) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pet-choice";
    button.dataset.kind = kind;
    button.title = `${PETS[kind].name} the ${PETS[kind].animal}`;
    const canvas = document.createElement("canvas");
    canvas.className = "pet-sprite";
    drawPet(canvas, kind);
    const label = document.createElement("span");
    label.textContent = PETS[kind].animal;
    button.append(canvas, label);
    button.addEventListener("click", () => buddy.setKind(kind));
    grid.append(button);
    return button;
  });
  // Mouse wheel scrolls the row of pets sideways (the desktop bar shows them in one row).
  grid.addEventListener(
    "wheel",
    (e) => {
      if (grid.scrollWidth <= grid.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      grid.scrollLeft += e.deltaY;
    },
    { passive: false },
  );
  const nameRow = document.createElement("label");
  nameRow.className = "pet-name-row";
  const nameLabel = document.createElement("span");
  nameLabel.textContent = "Name";
  const input = document.createElement("input");
  input.maxLength = 24;
  input.autocomplete = "off";
  input.addEventListener("change", () => buddy.setName(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buddy.setName(input.value);
      input.blur();
    }
  });
  nameRow.append(nameLabel, input);

  const done = document.createElement("button");
  done.type = "button";
  done.className = "btn pet-done";
  done.textContent = "Done";
  done.addEventListener("click", () => (picker.hidden = true));

  const picker = document.createElement("div");
  picker.className = "pet-picker";
  picker.hidden = true;
  picker.append(title, grid, nameRow, done);

  const render = () => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.kind === buddy.kind));
    input.placeholder = PETS[buddy.kind].name;
    if (document.activeElement !== input) input.value = buddy.customName;
  };
  buddy.addEventListener("change", render);
  render();
  return picker;
}
