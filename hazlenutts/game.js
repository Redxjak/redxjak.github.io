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
    "Pick who should lead this cozy adventure. The other Hazlenutts will still help along the way."
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
  } else if (hero === "ledger") {
    drawDino(315, 350, 1.08, "Ledger");
    drawCat(190, 365, 0.78, "Melody");
    drawDog(450, 365, 0.78, "Callum");
  } else {
    drawCat(300, 350, 1.08, "Melody");
    drawDog(170, 365, 0.78, "Callum");
    drawDino(445, 365, 0.78, "Ledger");
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
  circle(x, y - 70 * s, 46 * s, "#f4a261", "#7f5539", 4);
  circle(x, y, 58 * s, "#f4a261", "#7f5539", 4);
  triangle(x - 36 * s, y - 100 * s, x - 14 * s, y - 145 * s, x + 2 * s, y - 95 * s, "#f4a261", "#7f5539");
  triangle(x + 36 * s, y - 100 * s, x + 14 * s, y - 145 * s, x - 2 * s, y - 95 * s, "#f4a261", "#7f5539");
  circle(x - 16 * s, y - 78 * s, 6 * s, "#263238");
  circle(x + 16 * s, y - 78 * s, 6 * s, "#263238");
  circle(x, y - 62 * s, 5 * s, "#5c4033");
  line([[x + 42 * s, y + 10 * s], [x + 88 * s, y - 15 * s]], "#f4a261", 10 * s);
  text(name, x, y + 78 * s, 17 * s, "#3f3428", "center");
}

function drawDog(x, y, scale, name) {
  const s = scale;
  circle(x, y - 62 * s, 48 * s, "#c98f5a", "#3b2a24", 4);
  circle(x, y, 60 * s, "#c98f5a", "#3b2a24", 4);
  triangle(x - 35 * s, y - 86 * s, x - 22 * s, y - 135 * s, x - 5 * s, y - 85 * s, "#3b2a24", "#3b2a24");
  triangle(x + 35 * s, y - 86 * s, x + 22 * s, y - 135 * s, x + 5 * s, y - 85 * s, "#3b2a24", "#3b2a24");
  circle(x - 16 * s, y - 72 * s, 6 * s, "#1f2933");
  circle(x + 16 * s, y - 72 * s, 6 * s, "#1f2933");
  circle(x + 7 * s, y - 54 * s, 8 * s, "#1f2933");
  line([[x + 48 * s, y + 5 * s], [x + 90 * s, y - 24 * s]], "#3b2a24", 9 * s);
  text(name, x, y + 82 * s, 17 * s, "#3f3428", "center");
}

function drawDino(x, y, scale, name) {
  const s = scale;
  circle(x, y - 68 * s, 48 * s, "#7cc576", "#2d6a4f", 4);
  circle(x - 10 * s, y, 60 * s, "#7cc576", "#2d6a4f", 4);
  triangle(x - 55 * s, y + 8 * s, x - 110 * s, y + 38 * s, x - 50 * s, y + 54 * s, "#7cc576", "#2d6a4f");
  circle(x + 16 * s, y - 80 * s, 6 * s, "#1f2933");
  triangle(x + 48 * s, y - 65 * s, x + 78 * s, y - 55 * s, x + 48 * s, y - 45 * s, "#d8f3dc", "#2d6a4f");
  for (const [dx, dy] of [[-30, -92], [-5, -118], [25, -110]]) {
    triangle(x + dx * s, y + dy * s, x + (dx + 11) * s, y + (dy - 25) * s, x + (dx + 23) * s, y + dy * s, "#f2b84b", "#2d6a4f");
  }
  text(name, x, y + 88 * s, 17 * s, "#3f3428", "center");
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
