const data = window.HAZLENUTTS_STORY;

const state = {
  hero: null,
  scene: "character_select",
};

const heroLabel = document.querySelector("#hero-label");
const sceneTitle = document.querySelector("#scene-title");
const storyText = document.querySelector("#story-text");
const choices = document.querySelector("#choices");
const canvas = document.querySelector("#scene-art");
const ctx = canvas.getContext("2d");

document.querySelector("#home-button").addEventListener("click", showCharacterSelect);
document.querySelector("#restart-button").addEventListener("click", () => {
  if (state.hero) {
    showScene("start");
  } else {
    showCharacterSelect();
  }
});

function showCharacterSelect() {
  state.hero = null;
  state.scene = "character_select";
  heroLabel.textContent = "Choose your hero";
  sceneTitle.textContent = "Choose Your Hero";
  storyText.innerHTML = paragraphs(
    "Pick who should lead this cozy adventure. The Hazlenutts family will still help along the way."
  );
  choices.replaceChildren(
    ...Object.entries(data.characters).map(([key, character]) =>
      button(character.button, () => {
        state.hero = key;
        showScene("start");
      })
    )
  );
  drawScene("character_select", null);
}

function showScene(sceneId) {
  state.scene = sceneId;
  const story = data.stories[state.hero];
  const scene = story[sceneId];
  const character = data.characters[state.hero];

  heroLabel.textContent = `${character.name}'s story`;
  sceneTitle.textContent = scene.title;
  storyText.innerHTML = paragraphs(scene.text);
  choices.replaceChildren(
    ...scene.choices.map(([label, next]) => button(label, () => {
      if (next === "character_select") {
        showCharacterSelect();
      } else {
        showScene(next);
      }
    }))
  );
  drawScene(scene.image, state.hero);
}

function button(label, onClick) {
  const element = document.createElement("button");
  element.className = "choice-button";
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function paragraphs(text) {
  return text
    .split(/\n\n+/)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function drawScene(image, hero) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  background("#bfe5f2", "#f8e4bb");
  drawGround();

  const drawByImage = {
    bedroom: () => drawBedroom(),
    kitchen: () => drawKitchen(),
    map: () => drawMap(),
    pantry: () => drawPantry(),
    sofa: () => drawSofa(),
    laundry: () => drawLaundry(),
    note: () => drawNote(),
    hallway: () => drawHallway(),
    fort: () => drawFort(),
    bell: () => drawBell(),
    supplies: () => drawSupplies(),
    garden: () => drawGarden(),
    nap: () => drawBedroom(true),
    parade: () => drawParade(),
    picnic: () => drawPicnic(),
    queen: () => drawQueen(),
  };

  if (image === "character_select") {
    drawGarden();
    drawCat(190, 346, 0.95, "Melody");
    drawDog(320, 356, 0.92, "Callum");
    drawDino(455, 354, 0.9, "Ledger");
    drawMouse(525, 265, 0.72, "Millie");
    return;
  }

  (drawByImage[image] || drawGarden)();
  drawHeroGroup(hero);
}

function background(top, bottom) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGround() {
  ctx.fillStyle = "#8fca7a";
  ctx.beginPath();
  ctx.ellipse(320, 480, 390, 105, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeroGroup(hero) {
  if (hero === "callum") {
    drawDog(300, 350, 1.08, "Callum");
    drawCat(180, 365, 0.78, "Melody");
    drawDino(445, 365, 0.78, "Ledger");
    drawMouse(520, 265, 0.64, "Millie");
  } else if (hero === "ledger") {
    drawDino(315, 350, 1.08, "Ledger");
    drawCat(190, 365, 0.78, "Melody");
    drawDog(450, 365, 0.78, "Callum");
    drawMouse(520, 265, 0.64, "Millie");
  } else if (hero === "millie") {
    drawMouse(315, 340, 1.18, "Millie");
    drawCat(175, 365, 0.74, "Melody");
    drawDog(455, 365, 0.74, "Callum");
    drawDino(520, 255, 0.62, "Ledger");
  } else {
    drawCat(300, 350, 1.08, "Melody");
    drawDog(170, 365, 0.78, "Callum");
    drawDino(445, 365, 0.78, "Ledger");
    drawMouse(520, 265, 0.64, "Millie");
  }
}

function drawBedroom(nap = false) {
  drawWindow(70, 70);
  rect(105, 286, 390, 95, "#f2c078", "#835f3a", 4);
  rect(120, 242, 140, 80, "#f7d6e0", "#835f3a", 4);
  rect(260, 250, 220, 80, nap ? "#f4a261" : "#8ecae6", "#835f3a", 4);
}

function drawKitchen() {
  rect(90, 95, 470, 150, "#f4d6a4", "#8c6a46", 4);
  rect(120, 125, 90, 80, "#fffaf2", "#8c6a46", 3);
  rect(250, 125, 90, 80, "#fffaf2", "#8c6a46", 3);
  rect(382, 125, 116, 80, "#fffaf2", "#8c6a46", 3);
  rect(80, 235, 500, 34, "#8c6a46", "#6a4d35", 3);
  circle(450, 215, 22, "#f2b84b");
}

function drawMap() {
  rect(140, 90, 360, 230, "#fff3c4", "#9c6644", 5);
  line([[175, 135], [248, 198], [330, 160], [445, 260]], "#c6415d", 7);
  text("Sofa", 205, 125, 26, "#68452d");
  text("X", 445, 270, 48, "#c6415d");
}

function drawPantry() {
  rect(120, 80, 400, 265, "#b08968", "#6a4d35", 5);
  rect(145, 105, 350, 56, "#ffe8a3", "#6a4d35", 3);
  rect(145, 198, 350, 56, "#ffe8a3", "#6a4d35", 3);
  rect(175, 252, 72, 92, "#d4a373", "#6a4d35", 3);
  text("SNACKS", 210, 305, 15, "#5a3924");
  circle(330, 292, 32, "#c6415d");
  circle(390, 292, 32, "#2f7b5f");
}

function drawSofa() {
  rect(100, 235, 440, 110, "#8d6cff", "#5c477d", 5);
  rect(120, 165, 180, 100, "#b7a2ff", "#5c477d", 5);
  rect(340, 165, 180, 100, "#b7a2ff", "#5c477d", 5);
}

function drawLaundry() {
  circle(180, 278, 80, "#fffaf2", "#8792a2", 5);
  line([[130, 215], [230, 215]], "#8792a2", 5);
  text("X", 420, 185, 76, "#c6415d");
  circle(405, 275, 54, "#8ecae6", "#8792a2", 4);
  circle(475, 300, 48, "#f2b84b", "#8792a2", 4);
}

function drawNote() {
  rect(160, 100, 320, 230, "#fffaf2", "#b08968", 5);
  text("Dear Hazlenutts,", 320, 160, 30, "#3f6f64", "center");
  line([[210, 205], [430, 205]], "#dcc8a9", 4);
  line([[210, 245], [430, 245]], "#dcc8a9", 4);
}

function drawHallway() {
  rect(250, 70, 140, 280, "#e6ccb2", "#8c6a46", 4);
  circle(365, 215, 8, "#8c6a46");
  line([[110, 370], [530, 370]], "#8c6a46", 6);
  circle(410, 330, 28, "#7c8798", "#343a40", 3);
}

function drawFort() {
  rect(115, 225, 410, 130, "#f7d6e0", "#8c6a46", 4);
  triangle(120, 225, 320, 95, 520, 225, "#f4a261", "#8c6a46");
  rect(280, 260, 80, 95, "#6d597a", "#4c3d56", 3);
}

function drawBell() {
  ctx.fillStyle = "#f2b84b";
  ctx.strokeStyle = "#7f5539";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(320, 250, 86, Math.PI, 0);
  ctx.lineTo(406, 330);
  ctx.lineTo(234, 330);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  circle(320, 345, 24, "#c6415d", "#7f5539", 4);
}

function drawSupplies() {
  rect(175, 170, 290, 160, "#3f6f64", "#24473f", 5);
  rect(210, 125, 220, 80, "#6da996", "#24473f", 5);
  text("SNACKS", 320, 255, 38, "#fffaf2", "center");
  circle(170, 350, 32, "#f2b84b", "#7f5539", 3);
  circle(470, 350, 32, "#f2b84b", "#7f5539", 3);
}

function drawGarden() {
  for (const x of [100, 170, 470, 540]) {
    line([[x, 320], [x, 250]], "#2f7b5f", 5);
    flower(x, 235);
  }
  circle(320, 105, 44, "#f2b84b");
}

function drawParade() {
  drawSofa();
  for (const x of [155, 230, 405, 480]) {
    text("*", x, 130 + (x % 2) * 30, 42, "#f2b84b", "center");
  }
}

function drawPicnic() {
  rect(170, 245, 300, 110, "#e76f51", "#9c4334", 4);
  for (const x of [215, 290, 365, 435]) {
    circle(x, 300, 24, "#f2b84b", "#7f5539", 3);
  }
}

function drawQueen() {
  drawGarden();
  triangle(250, 165, 320, 80, 390, 165, "#f2b84b", "#9c6644");
  circle(270, 160, 12, "#c6415d");
  circle(320, 92, 12, "#c6415d");
  circle(370, 160, 12, "#c6415d");
}

function drawCat(x, y, scale, name) {
  const s = scale;
  const body = "#f4a261";
  const outline = "#5c4033";
  const dark = "#1f2933";

  oval(x, y + 24 * s, 55 * s, 56 * s, body, outline, 4 * s);
  oval(x, y - 52 * s, 48 * s, 45 * s, body, outline, 4 * s);
  triangle(x - 39 * s, y - 75 * s, x - 24 * s, y - 125 * s, x - 5 * s, y - 82 * s, body, outline);
  triangle(x + 39 * s, y - 75 * s, x + 24 * s, y - 125 * s, x + 5 * s, y - 82 * s, body, outline);
  triangle(x - 30 * s, y - 79 * s, x - 24 * s, y - 103 * s, x - 15 * s, y - 79 * s, "#ffd0c8", "#ffd0c8");
  triangle(x + 30 * s, y - 79 * s, x + 24 * s, y - 103 * s, x + 15 * s, y - 79 * s, "#ffd0c8", "#ffd0c8");

  drawFlower(x + 32 * s, y - 91 * s, 11 * s, "#d94f70", "#f5b23d");
  line([[x - 28 * s, y - 3 * s], [x + 28 * s, y - 3 * s]], "#d94f70", 6 * s);
  drawMedal(x, y + 8 * s, 8 * s, "#f6c453");

  circle(x - 15 * s, y - 58 * s, 7 * s, dark);
  circle(x + 15 * s, y - 58 * s, 7 * s, dark);
  circle(x, y - 32 * s, 5 * s, outline);
  smile(x, y - 28 * s, 18 * s, 12 * s, outline, 2.5 * s);

  for (const side of [-1, 1]) {
    line([[x + side * 5 * s, y - 32 * s], [x + side * 40 * s, y - 40 * s]], outline, 1.5 * s);
    line([[x + side * 5 * s, y - 28 * s], [x + side * 42 * s, y - 28 * s]], outline, 1.5 * s);
    line([[x + side * 5 * s, y - 24 * s], [x + side * 40 * s, y - 18 * s]], outline, 1.5 * s);
  }

  line([[x - 22 * s, y + 36 * s], [x - 22 * s, y + 72 * s]], "#b56b31", 3 * s);
  line([[x, y + 36 * s], [x, y + 72 * s]], "#b56b31", 3 * s);
  line([[x + 22 * s, y + 36 * s], [x + 22 * s, y + 72 * s]], "#b56b31", 3 * s);
  curvedTail(x + 44 * s, y + 18 * s, 70 * s, 72 * s, body, 12 * s);
  shadow(x, y + 88 * s, 44 * s, 9 * s);
  label(name, x, y + 92 * s, 17 * s);
}

function drawDog(x, y, scale, name) {
  const s = scale;
  const tan = "#c98f5a";
  const dark = "#3b2a24";
  const cream = "#f5dfbf";

  oval(x, y + 24 * s, 55 * s, 58 * s, tan, dark, 4 * s);
  oval(x, y - 50 * s, 50 * s, 47 * s, tan, dark, 4 * s);
  triangle(x - 33 * s, y - 78 * s, x - 22 * s, y - 128 * s, x - 4 * s, y - 79 * s, dark, dark);
  triangle(x + 33 * s, y - 78 * s, x + 22 * s, y - 128 * s, x + 4 * s, y - 79 * s, dark, dark);
  oval(x, y - 39 * s, 30 * s, 22 * s, dark, dark, 0);
  oval(x + 6 * s, y - 31 * s, 25 * s, 17 * s, cream, cream, 0);

  circle(x - 17 * s, y - 62 * s, 7 * s, "#132233");
  circle(x + 17 * s, y - 62 * s, 7 * s, "#132233");
  oval(x, y - 39 * s, 10 * s, 8 * s, "#132233", "#132233", 0);
  tongue(x + 2 * s, y - 24 * s, 9 * s);
  line([[x - 20 * s, y - 81 * s], [x - 8 * s, y - 86 * s]], dark, 4 * s);
  line([[x + 8 * s, y - 86 * s], [x + 20 * s, y - 81 * s]], dark, 4 * s);
  line([[x - 31 * s, y - 5 * s], [x + 31 * s, y - 5 * s]], "#21864f", 7 * s);
  drawMedal(x, y + 8 * s, 8 * s, "#f6c453");
  oval(x - 24 * s, y + 56 * s, 13 * s, 18 * s, cream, cream, 0);
  oval(x + 24 * s, y + 56 * s, 13 * s, 18 * s, cream, cream, 0);
  line([[x + 45 * s, y + 12 * s], [x + 78 * s, y - 24 * s], [x + 92 * s, y - 10 * s]], dark, 10 * s);
  shadow(x, y + 92 * s, 44 * s, 9 * s);
  label(name, x, y + 96 * s, 17 * s);
}

function drawDino(x, y, scale, name) {
  const s = scale;
  const green = "#7cc576";
  const darkGreen = "#2d6a4f";
  const belly = "#d8f3dc";
  const spike = "#f9c74f";

  oval(x - 4 * s, y + 22 * s, 55 * s, 62 * s, green, darkGreen, 4 * s);
  oval(x + 14 * s, y - 54 * s, 48 * s, 42 * s, green, darkGreen, 4 * s);
  triangle(x - 48 * s, y + 16 * s, x - 112 * s, y + 44 * s, x - 48 * s, y + 62 * s, green, darkGreen);
  oval(x - 8 * s, y + 30 * s, 26 * s, 38 * s, belly, belly, 0);

  for (const [dx, dy] of [[-36, -38], [-18, -70], [6, -96], [32, -86]]) {
    triangle(
      x + dx * s,
      y + dy * s,
      x + (dx + 11) * s,
      y + (dy - 24) * s,
      x + (dx + 23) * s,
      y + dy * s,
      spike,
      darkGreen
    );
  }

  circle(x + 22 * s, y - 65 * s, 7 * s, "#132233");
  roundedMouth(x + 35 * s, y - 47 * s, 30 * s, 18 * s, darkGreen);
  tooth(x + 43 * s, y - 39 * s, 5 * s);
  tooth(x + 56 * s, y - 39 * s, 5 * s);
  line([[x - 18 * s, y + 8 * s], [x - 42 * s, y + 30 * s]], darkGreen, 7 * s);
  line([[x + 18 * s, y + 8 * s], [x + 40 * s, y + 30 * s]], darkGreen, 7 * s);
  line([[x - 22 * s, y + 60 * s], [x - 34 * s, y + 86 * s]], darkGreen, 8 * s);
  line([[x + 16 * s, y + 60 * s], [x + 30 * s, y + 86 * s]], darkGreen, 8 * s);
  shadow(x, y + 98 * s, 46 * s, 9 * s);
  label(name, x, y + 108 * s, 17 * s);
}

function drawMouse(x, y, scale, name) {
  const s = scale;
  const body = "#b7a7a0";
  const outline = "#5c514b";
  const ear = "#f2c6c2";

  oval(x, y + 16 * s, 42 * s, 52 * s, body, outline, 4 * s);
  oval(x, y - 47 * s, 34 * s, 34 * s, body, outline, 4 * s);
  circle(x - 32 * s, y - 76 * s, 20 * s, body, outline, 3 * s);
  circle(x + 32 * s, y - 76 * s, 20 * s, body, outline, 3 * s);
  circle(x - 32 * s, y - 76 * s, 12 * s, ear);
  circle(x + 32 * s, y - 76 * s, 12 * s, ear);
  drawBow(x + 18 * s, y - 88 * s, 10 * s, "#d94f70");
  circle(x - 11 * s, y - 51 * s, 5 * s, "#1f2933");
  circle(x + 11 * s, y - 51 * s, 5 * s, "#1f2933");
  circle(x, y - 34 * s, 5 * s, "#7d4f50");
  smile(x, y - 30 * s, 14 * s, 10 * s, outline, 2 * s);

  for (const side of [-1, 1]) {
    line([[x + side * 4 * s, y - 35 * s], [x + side * 31 * s, y - 42 * s]], outline, 1.3 * s);
    line([[x + side * 4 * s, y - 31 * s], [x + side * 34 * s, y - 31 * s]], outline, 1.3 * s);
  }

  drawCheese(x, y + 10 * s, 16 * s);
  line([[x - 38 * s, y + 40 * s], [x - 54 * s, y + 70 * s]], outline, 5 * s);
  line([[x + 38 * s, y + 40 * s], [x + 54 * s, y + 70 * s]], outline, 5 * s);
  line([[x + 35 * s, y + 12 * s], [x + 86 * s, y + 42 * s], [x + 104 * s, y + 18 * s]], "#f09a9a", 5 * s);
  shadow(x, y + 86 * s, 38 * s, 8 * s);
  label(name, x, y + 84 * s, 17 * s);
}

function drawFlower(x, y, r, petal, center) {
  for (const [dx, dy] of [[0, -1], [0.9, -0.25], [0.55, 0.85], [-0.55, 0.85], [-0.9, -0.25]]) {
    circle(x + dx * r, y + dy * r, r * 0.58, petal, "#9b2c45", 1.5);
  }
  circle(x, y, r * 0.42, center, "#9b6b1c", 1);
}

function drawBow(x, y, r, color) {
  triangle(x, y, x - 18 * r / 10, y - 10 * r / 10, x - 18 * r / 10, y + 10 * r / 10, color, "#9b2c45");
  triangle(x, y, x + 18 * r / 10, y - 10 * r / 10, x + 18 * r / 10, y + 10 * r / 10, color, "#9b2c45");
  circle(x, y, r * 0.45, "#f3a4b8", "#9b2c45", 1);
}

function drawMedal(x, y, r, color) {
  circle(x, y, r, color, "#b97912", 1.5);
  circle(x - r * 0.25, y - r * 0.25, r * 0.22, "#fff0a6", "#fff0a6", 0);
}

function drawCheese(x, y, size) {
  triangle(x - size, y + size * 0.4, x + size, y - size * 0.8, x + size, y + size, "#f6c453", "#b97912");
  circle(x + size * 0.35, y + size * 0.2, size * 0.16, "#d99a27", "#d99a27", 0);
  circle(x + size * 0.7, y - size * 0.3, size * 0.13, "#d99a27", "#d99a27", 0);
}

function tongue(x, y, size) {
  oval(x, y, size * 0.55, size, "#f77f8d", "#a53f4b", 1);
}

function roundedMouth(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - width * 0.5, y - height * 0.5, width, height, height * 0.45);
  ctx.fill();
}

function tooth(x, y, size) {
  triangle(x - size, y, x + size, y, x, y + size * 1.3, "#ffffff", "#ffffff");
}

function shadow(x, y, rx, ry) {
  oval(x, y, rx, ry, "rgba(91, 64, 38, 0.16)", "rgba(91, 64, 38, 0.16)", 0);
}

function oval(x, y, radiusX, radiusY, fill, stroke = fill, width = 2) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(0, width);
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  if (stroke && width > 0) ctx.stroke();
}

function smile(x, y, width, height, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x - width * 0.25, y, width * 0.35, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + width * 0.25, y, width * 0.35, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
}

function curvedTail(x, y, width, height, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x + width * 0.25, y + height * 0.05, width * 0.45, 0.55 * Math.PI, 1.65 * Math.PI);
  ctx.stroke();
}

function label(value, x, y, size) {
  text(value, x, y, size, "#3f3428", "center");
}

function drawWindow(x, y) {
  rect(x, y, 125, 105, "#8ecae6", "#8c6a46", 5);
  line([[x + 62, y], [x + 62, y + 105]], "#8c6a46", 4);
  line([[x, y + 52], [x + 125, y + 52]], "#8c6a46", 4);
}

function flower(x, y) {
  for (const [dx, dy] of [[0, -18], [17, -5], [-17, -5], [11, 14], [-11, 14]]) {
    circle(x + dx, y + dy, 16, "#c6415d");
  }
  circle(x, y, 12, "#f2b84b");
}

function rect(x, y, w, h, fill, stroke, width = 2) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function circle(x, y, r, fill, stroke = fill, width = 2) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (stroke) ctx.stroke();
}

function triangle(x1, y1, x2, y2, x3, y3, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function line(points, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function text(value, x, y, size, color, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px Nunito, Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
  ctx.textAlign = "left";
}

showCharacterSelect();
