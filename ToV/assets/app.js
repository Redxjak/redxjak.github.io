(function () {
  "use strict";

  const VERSION = "0.8.1";
  const MAP_DIRECTIONS = ["LEFT", "UP", "RIGHT", "DOWN"];
  const BASE_LEVEL = 5;
  const BASE_XP_TO_NEXT = 100;
  const XP_PER_LEVEL = 50;
  const SUPABASE_URL = "https://fojkijwketpzxsbikmsl.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pxMr-7kXAoQ9gz0mTTWLew_FAIRtAio";
  const LEADERBOARD_TABLE = "leaderboard_scores";
  const SUGGESTION_URL = "https://github.com/Redxjak/Tales-of-Visteria/issues/new?template=suggestion.yml";
  const ISSUE_URL = "https://github.com/Redxjak/Tales-of-Visteria/issues/new?template=issue.yml";
  const lang = document.body.dataset.language || "en";
  const storagePrefix = "tov.web.";
  const uiTextByLanguage = {
    en: {
      english: "English",
      spanish: "Spanish",
      language: "Language",
      characterSheet: "Character Sheet",
      plotDevelopment: "Plot Development",
      noCharacter: "No character selected.\n\nStart a new game or load a save.",
      trait: "Trait",
      value: "Value",
      name: "Name",
      race: "Race",
      className: "Class",
      level: "Level",
      experience: "Experience",
      hp: "HP",
      ac: "AC",
      attackBonus: "Attack Chance Bonus",
      damage: "Damage",
      equipment: "Equipment",
      enemyHp: "Enemy HP",
      leaderboard: "Leaderboard",
      submitScore: "Submit Score",
      playerNamePrompt: "Name for the leaderboard:",
      scoreSubmitted: "Score submitted.",
      scoreSubmitFailed: "Could not submit score. The leaderboard table may not be set up yet.",
      deathScorePrompt: "You have died. Click here to see your scores",
      leaderboardLoading: "Loading leaderboard...",
      leaderboardEmpty: "No scores yet.",
      leaderboardFailed: "Could not load leaderboard.",
      leaderboardHeader: "Leaderboard",
      leaderboardWarning: "Warning: leaderboards will be reset with the release of version 1.0. A special mention will be made for the top three players at that time.",
      leaderboardLine: "{rank}. {name} - {score} ({character})",
      loginScreen: "Sign in, create an account, or play as a guest",
      displayNamePrompt: "Choose a public username:",
      emailPrompt: "Email address:",
      passwordPrompt: "Password:",
      loginPrompt: "Email address:",
      login: "Sign In",
      googleLogin: "Sign in with Google",
      createAccount: "Create Account",
      logout: "Logout",
      playAsGuest: "Play as Guest",
      guest: "Guest",
      accountCreated: "Account created. If Supabase asks for email confirmation, check your email before signing in.",
      loginFailed: "Sign in failed. Check your email and password.",
      signupFailed: "Account creation failed. The email may already be used, or Supabase may require a stronger password.",
      logoutDone: "Signed out.",
      cloudLoaded: "Cloud save loaded.",
      cloudSaved: "Cloud save updated.",
      accountLabel: "Player: {name}",
      accountMenu: "Account menu",
      info: "Info",
      achievementsLabel: "Achievements",
      faq: "FAQ",
      closeFaq: "Close FAQ",
      suggest: "Suggest",
      reportIssue: "Report Issue",
      log: "Log",
      closeLog: "Close",
      emptyLog: "No story log yet.",
      moveOn: "Move on"
    },
    es: {
      english: "Inglés",
      spanish: "Español",
      language: "Idioma",
      characterSheet: "Hoja de personaje",
      plotDevelopment: "Desarrollo de la trama",
      noCharacter: "No hay personaje seleccionado.\n\nEmpieza una nueva partida o carga una partida guardada.",
      trait: "Rasgo",
      value: "Valor",
      name: "Nombre",
      race: "Raza",
      className: "Clase",
      level: "Nivel",
      experience: "Experiencia",
      hp: "PV",
      ac: "CA",
      attackBonus: "Bonif. prob. ataque",
      damage: "Daño",
      equipment: "Equipo",
      enemyHp: "PV enemigos",
      leaderboard: "Clasificación",
      submitScore: "Enviar puntaje",
      playerNamePrompt: "Nombre para la clasificación:",
      scoreSubmitted: "Puntaje enviado.",
      scoreSubmitFailed: "No se pudo enviar el puntaje. Tal vez falte crear la tabla de clasificación.",
      deathScorePrompt: "Has muerto. Haz clic aqui para ver tus puntajes",
      leaderboardLoading: "Cargando clasificación...",
      leaderboardEmpty: "Todavía no hay puntajes.",
      leaderboardFailed: "No se pudo cargar la clasificación.",
      leaderboardHeader: "Clasificación",
      leaderboardWarning: "Aviso: la clasificación se reiniciará con el lanzamiento de la versión 1.0. Se hará una mención especial para los tres mejores jugadores en ese momento.",
      leaderboardLine: "{rank}. {name} - {score} ({character})",
      loginScreen: "Inicia sesion, crea una cuenta o juega como invitado",
      displayNamePrompt: "Elige un nombre publico:",
      emailPrompt: "Correo electronico:",
      passwordPrompt: "Contrasena:",
      loginPrompt: "Correo electronico:",
      login: "Iniciar sesion",
      googleLogin: "Iniciar sesion con Google",
      createAccount: "Crear cuenta",
      logout: "Cerrar sesion",
      playAsGuest: "Jugar como invitado",
      guest: "Invitado",
      accountCreated: "Cuenta creada. Si Supabase pide confirmacion por correo, revisa tu correo antes de iniciar sesion.",
      loginFailed: "No se pudo iniciar sesion. Revisa tu correo y contrasena.",
      signupFailed: "No se pudo crear la cuenta. Puede que el correo ya exista o que la contrasena sea debil.",
      logoutDone: "Sesion cerrada.",
      cloudLoaded: "Guardado en la nube cargado.",
      cloudSaved: "Guardado en la nube actualizado.",
      accountLabel: "Jugador: {name}",
      accountMenu: "Menu de cuenta",
      info: "Info",
      achievementsLabel: "Logros",
      faq: "FAQ",
      closeFaq: "Cerrar FAQ",
      suggest: "Sugerir",
      reportIssue: "Reportar problema",
      log: "Registro",
      closeLog: "Cerrar",
      emptyLog: "Todavia no hay registro.",
      moveOn: "Continuar"
    }
  };
  const ui = uiTextByLanguage[lang] || uiTextByLanguage.en;
  const fallbackText = {
    "choice.sneak_bridge": "Sneak Across the Bridge",
    "choice3.sneak_bridge": "Sneak Across the Bridge",
    "story.level_up_title": "Level up!",
    "story.level_up_body": "+2 Health\nChoose your level up reward."
  };

  const classes = {
    warrior: {
      name: "Cletus",
      title: "Barbarian",
      race: "Goliath",
      maxHealth: 55,
      gold: 6,
      supplies: 2,
      gear: ["greataxe", "travel cloak"],
      bonus: "combat",
      ac: 15,
      attackBonus: 6,
      damageDie: 12,
      damageBonus: 4,
      attacks: 2,
      description: "A Goliath Barbarian with high health and brutal melee attacks."
    },
    ranger: {
      name: "Ren",
      title: "Ranger",
      race: "Elf",
      maxHealth: 44,
      gold: 8,
      supplies: 3,
      gear: ["longbow", "short blade"],
      bonus: "sneak",
      ac: 15,
      attackBonus: 7,
      damageDie: 8,
      damageBonus: 4,
      attacks: 2,
      description: "An Elven Ranger with strong accuracy and two attacks."
    },
    scholar: {
      name: "Cal",
      title: "Warlock",
      race: "Human",
      maxHealth: 40,
      gold: 10,
      supplies: 2,
      gear: ["old journal", "silver charm", "eldritch focus"],
      bonus: "persuasion",
      ac: 14,
      attackBonus: 7,
      damageDie: 10,
      damageBonus: 4,
      attacks: 2,
      description: "A Human Warlock with eldritch power and persuasion."
    },
    dwarf: {
      name: "Kili",
      title: "Fighter",
      race: "Dwarf",
      maxHealth: 50,
      gold: 5,
      supplies: 3,
      gear: ["battleaxe", "stone token"],
      bonus: "lore",
      ac: 16,
      attackBonus: 7,
      damageDie: 8,
      damageBonus: 4,
      attacks: 2,
      description: "A Dwarven Fighter with armor, stamina, and two attacks."
    },
    dm: {
      name: "Jon",
      title: "DM",
      race: "God",
      maxHealth: 999,
      gold: 0,
      supplies: 0,
      gear: ["DM screen", "loaded d20"],
      bonus: "fate",
      ac: 99,
      attackBonus: 99,
      damageDie: 20,
      damageBonus: 99,
      attacks: 1,
      description: "A nicotine addicted God controlling the story from above."
    }
  };

  const classTranslations = {
    es: {
      warrior: {
        title: "Bárbaro",
        race: "Goliat",
        description: "Un Bárbaro goliat con mucha salud y ataques cuerpo a cuerpo brutales."
      },
      ranger: {
        title: "Explorador",
        race: "Elfo",
        description: "Un Explorador élfico con gran precisión y dos ataques."
      },
      scholar: {
        title: "Brujo",
        race: "Humano",
        description: "Un Brujo humano con poder eldritch y buena persuasión."
      },
      dwarf: {
        title: "Guerrero",
        race: "Enano",
        description: "Un Guerrero enano con armadura, aguante y dos ataques."
      },
      dm: {
        title: "DM",
        race: "Dios",
        description: "Un Dios adicto a la nicotina que controla la historia desde arriba."
      }
    }
  };
  Object.entries(classTranslations[lang] || {}).forEach(([key, values]) => Object.assign(classes[key], values));

  const monsterStats = {
    goblin: { name: "Goblin", ac: 15, hp: 7, attackBonus: 4, damageDie: 6, damageBonus: 2, xp: 20 },
    orc: { name: "Orc", ac: 13, hp: 15, attackBonus: 5, damageDie: 12, damageBonus: 3, xp: 35 },
    gremlin: { name: "Gremlin", ac: 13, hp: 10, attackBonus: 4, damageDie: 6, damageBonus: 1, xp: 20 },
    ghoul: { name: "Ghoul", ac: 12, hp: 18, attackBonus: 4, damageDie: 6, damageBonus: 2, xp: 25 },
    mimic: { name: "Mimic", ac: 12, hp: 35, attackBonus: 5, damageDie: 8, damageBonus: 3, xp: 45 },
    cultist: { name: "Masked Cultist", ac: 13, hp: 12, attackBonus: 4, damageDie: 6, damageBonus: 2, xp: 25 },
    ritualLeader: { name: "Cultist Leader", ac: 15, hp: 42, attackBonus: 7, damageDie: 10, damageBonus: 4, xp: 90 }
  };

  const achievementsByLanguage = {
    en: {
      first_fight: "First Blood",
      ghost_ally: "Tiny Terror",
      group_kill: "Crowd Control",
      lucky: "Lucky",
      unlucky: "Unlucky",
      forest_mind_break: "Dazed and Confused",
      ghost_slayer: "Ghost Slayer",
      ghost_kiss: "Not Your Goth Baddie",
      pyromaniac: "Pyromaniac",
      send_hydra: "Fuck Dem Kids",
      correct_chest_key: "Keyed In",
      mimic_nap: "Sleep Tight",
      played_everyone: "Full Party",
      mask_on: "I'm feeling good!",
      warehouse_survived: "Was it a dream?",
      high_ac: "Can't touch this",
      big_damage: "Unlimited powa",
      maxed_out: "Maxed out"
    },
    es: {
      first_fight: "Primera sangre",
      ghost_ally: "Terror diminuto",
      group_kill: "Control de masas",
      lucky: "Con suerte",
      unlucky: "Sin suerte",
      forest_mind_break: "Aturdido y confundido",
      ghost_slayer: "Cazafantasmas",
      ghost_kiss: "No es tu gótica",
      pyromaniac: "Piromano",
      send_hydra: "Al diablo con ellos",
      correct_chest_key: "La llave correcta",
      mimic_nap: "Duerme bien",
      played_everyone: "Grupo completo",
      mask_on: "¡Me siento bien!",
      warehouse_survived: "¿Fue un sueño?",
      high_ac: "No puedes tocar esto",
      big_damage: "Powa ilimitado",
      maxed_out: "Al máximo"
    }
  };
  const achievements = achievementsByLanguage[lang] || achievementsByLanguage.en;

  const xpReasonsByLanguage = {
    en: {
      combat: "won a fight",
      caravan_run: "escaped the caravan",
      forest_attempt: "tested the forest path",
      choose_cave: "chose the cave",
      go_deeper: "pressed deeper into Visteria",
      ghost_choice: "faced the ghost girl",
      doll_choice: "made a choice about the doll",
      district_choice: "chose a district route",
      search: "searched for supplies",
      residential_choice: "explored the residential district",
      bridge: "reached the bridge"
    },
    es: {
      combat: "ganaste una pelea",
      caravan_run: "escapaste de la caravana",
      forest_attempt: "probaste el camino del bosque",
      choose_cave: "elegiste la cueva",
      go_deeper: "avanzaste más profundo en Visteria",
      ghost_choice: "enfrentaste a la niña fantasma",
      doll_choice: "decidiste qué hacer con la muñeca",
      district_choice: "elegiste una ruta de distrito",
      search: "buscaste suministros",
      residential_choice: "exploraste el distrito residencial",
      bridge: "llegaste al puente"
    }
  };
  const xpReasons = xpReasonsByLanguage[lang] || xpReasonsByLanguage.en;

  const decisionXp = {
    caravan_run: 20,
    forest_attempt: 10,
    choose_cave: 20,
    go_deeper: 15,
    ghost_choice: 20,
    doll_choice: 15,
    district_choice: 20,
    search: 15,
    residential_choice: 20,
    bridge: 25
  };

  const state = {
    text: {},
    player: null,
    stats: loadJson("stats", defaultStats()),
    combat: null,
    storyParts: [],
    logParts: [],
    logVisible: false,
    faqVisible: false,
    showGameOverImage: false,
    awaitingLevelReward: false,
    levelRewardChoices: [],
    pendingChoices: null,
    pendingLevelContinuation: null,
    activeMobilePanel: null,
    oauthLoginFailed: false,
    account: loadAccount(),
    leaderboard: [],
    choices: []
  };

  const app = document.getElementById("app");

  init();

  async function init() {
    try {
      const response = await fetch(`../assets/data/${lang}.json`);
      state.text = await response.json();
    } catch {
      const fallback = await fetch("../assets/data/en.json");
      state.text = await fallback.json();
    }
    await handleOAuthRedirect();
    if (state.account && !state.account.guest) {
      await refreshAccountSession();
      await loadCloudData();
    }
    drawShell();
    if (state.account) {
      showStart();
    } else {
      showLoginScreen();
      if (state.oauthLoginFailed) {
        write(ui.loginFailed);
      }
    }
  }

  function drawShell() {
    app.innerHTML = `
      <header class="topbar">
        <div class="title-row">
          <img class="game-logo" src="../assets/tales-of-visteria-logo.png" alt="Tales of Visteria">
          <span class="version">v${VERSION}</span>
        </div>
        <div class="meta-row">
          <details id="account-menu" class="account-menu">
            <summary aria-label="${ui.accountMenu}"><span id="account-status"></span></summary>
            <div class="account-menu-panel">
              <div class="account-language-group">
                <p>${ui.language}</p>
                <div class="account-language-options">
                  <a class="account-language-link" href="../en/">${ui.english}</a>
                  <a class="account-language-link" href="../es/">${ui.spanish}</a>
                </div>
              </div>
              <button id="menu-save" type="button">${t("choice.save")}</button>
              <button id="menu-load" type="button">${t("choice.load_game")}</button>
              <button id="menu-leaderboard" type="button">${ui.leaderboard}</button>
              <button id="menu-faq" type="button">${ui.faq}</button>
              <button id="menu-suggest" type="button">${ui.suggest}</button>
              <button id="menu-issue" type="button">${ui.reportIssue}</button>
              <button id="menu-quit" type="button">${t("choice.quit")}</button>
              <button id="menu-logout" type="button">${ui.logout}</button>
            </div>
          </details>
          <button id="log-button" class="utility-button" type="button">${ui.log}</button>
          <details id="info-menu" class="mobile-info-menu">
            <summary>${ui.info}</summary>
            <div class="mobile-info-menu-panel">
              <button type="button" data-mobile-panel="character">${ui.characterSheet}</button>
              <button type="button" data-mobile-panel="plot">${ui.plotDevelopment}</button>
              <button type="button" data-mobile-panel="achievements">${ui.achievementsLabel}</button>
            </div>
          </details>
        </div>
        <div id="status" class="status"></div>
      </header>
      <section class="layout">
        <aside class="side-panel player-panel" data-mobile-panel-name="character">
          <button class="mobile-panel-close" type="button">${ui.closeLog}</button>
          <h2 class="panel-title">${ui.characterSheet}</h2>
          <div id="sheet" class="sheet"></div>
        </aside>
        <section class="story-panel">
          <div id="story" class="story"></div>
        </section>
        <aside class="side-panel plot-panel" data-mobile-panel-name="plot">
          <button class="mobile-panel-close" type="button">${ui.closeLog}</button>
          <h2 class="panel-title">${ui.plotDevelopment}</h2>
          <div id="plot" class="plot"></div>
        </aside>
        <aside class="side-panel mobile-achievements-panel" data-mobile-panel-name="achievements">
          <button class="mobile-panel-close" type="button">${ui.closeLog}</button>
          <h2 class="panel-title">${ui.achievementsLabel}</h2>
          <div id="mobile-achievements" class="plot"></div>
        </aside>
      </section>
      <section id="log-panel" class="embedded-log" hidden>
        <div class="log-header">
          <h2 id="log-title">${ui.log}</h2>
          <button id="close-log" class="utility-button" type="button">${ui.closeLog}</button>
        </div>
        <div id="log-content" class="log-content"></div>
      </section>
      <section id="faq-panel" class="faq-panel" hidden>
        <div class="log-header">
          <h2>${ui.faq}</h2>
          <button id="close-faq" class="utility-button" type="button">${ui.closeFaq}</button>
        </div>
        <div id="faq-content" class="faq-content"></div>
      </section>
      <nav id="choices" class="choices"></nav>
      <section id="level-modal" class="modal-overlay" hidden>
        <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="level-modal-title">
          <h2 id="level-modal-title"></h2>
          <p id="level-modal-body"></p>
          <div id="level-modal-choices" class="modal-choices"></div>
        </div>
      </section>
    `;
  }

  function t(key, vars = {}) {
    let value = state.text[key] || fallbackText[key] || key;
    return format(value, vars);
  }

  function format(value, vars = {}) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  }

  function write(text, clear = false) {
    if (clear) {
      state.storyParts = [];
      state.showGameOverImage = false;
    }
    const escapedText = escapeHtml(text);
    if (state.storyParts.length) {
      state.storyParts.push("<hr>");
    }
    state.storyParts.push(escapedText);
    if (state.logParts.length) {
      state.logParts.push("<hr>");
    }
    state.logParts.push(escapedText);
    render();
  }

  function writeKey(key, vars = {}, clear = false) {
    write(t(key, vars), clear);
  }

  function setChoices(choices, force = false) {
    if (state.awaitingLevelReward && !force) {
      state.pendingChoices = choices;
      render();
      return;
    }
    state.choices = choices;
    render();
  }

  function render() {
    document.getElementById("story").innerHTML = state.storyParts.join("");
    if (state.showGameOverImage) {
      const img = document.createElement("img");
      img.className = "game-over-image";
      img.alt = "Tales of Visteria party";
      img.src = "../assets/game_over_party.png";
      document.getElementById("story").appendChild(img);
    }
    document.getElementById("status").textContent = statusText();
    document.getElementById("account-status").textContent = accountStatusText();
    bindAccountMenu();
    document.getElementById("sheet").innerHTML = sheetText();
    document.getElementById("plot").textContent = plotText();
    document.getElementById("mobile-achievements").textContent = achievementsText();
    document.getElementById("log-content").innerHTML = state.logParts.length ? state.logParts.join("") : escapeHtml(ui.emptyLog);
    document.getElementById("log-button").onclick = toggleLog;
    bindMobilePanels();
    document.getElementById("close-log").onclick = hideLog;
    document.getElementById("log-panel").hidden = !state.logVisible;
    document.getElementById("faq-content").innerHTML = faqHtml();
    document.getElementById("close-faq").onclick = hideFaq;
    document.getElementById("faq-panel").hidden = !state.faqVisible;
    renderLevelModal();
    const choiceArea = document.getElementById("choices");
    choiceArea.innerHTML = "";
    state.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.className = "choice";
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", () => {
        if (state.combat && state.player && state.player.health <= 0) {
          finishCombatDeath();
          return;
        }
        if (!choice.preserveScene) {
          beginVisibleScene();
        }
        choice.action();
      });
      choiceArea.appendChild(button);
    });
  }

  function renderLevelModal() {
    const modal = document.getElementById("level-modal");
    if (!modal) {
      return;
    }
    modal.hidden = !state.awaitingLevelReward;
    if (!state.awaitingLevelReward) {
      return;
    }
    document.getElementById("level-modal-title").textContent = t("story.level_up_title", { level: state.player.level });
    document.getElementById("level-modal-body").textContent = t("story.level_up_body");
    const choiceArea = document.getElementById("level-modal-choices");
    choiceArea.innerHTML = "";
    state.levelRewardChoices.forEach((levelChoice) => {
      const button = document.createElement("button");
      button.className = "choice";
      button.type = "button";
      button.textContent = levelChoice.label;
      button.addEventListener("click", levelChoice.action);
      choiceArea.appendChild(button);
    });
  }

  function beginVisibleScene() {
    state.storyParts = [];
    state.showGameOverImage = false;
  }

  function showLog() {
    state.logVisible = true;
    const panel = document.getElementById("log-panel");
    if (panel) {
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function toggleLog() {
    if (state.logVisible) {
      hideLog();
    } else {
      showLog();
    }
  }

  function hideLog() {
    state.logVisible = false;
    const panel = document.getElementById("log-panel");
    if (panel) {
      panel.hidden = true;
    }
  }

  function bindMobilePanels() {
    const infoMenu = document.getElementById("info-menu");
    if (infoMenu) {
      infoMenu.querySelectorAll("[data-mobile-panel]").forEach((button) => {
        button.onclick = () => {
          toggleMobilePanel(button.dataset.mobilePanel);
          infoMenu.open = false;
        };
      });
    }
    document.querySelectorAll(".mobile-panel-close").forEach((button) => {
      button.onclick = closeMobilePanels;
    });
    syncMobilePanels();
  }

  function toggleMobilePanel(name) {
    state.activeMobilePanel = state.activeMobilePanel === name ? null : name;
    syncMobilePanels();
  }

  function closeMobilePanels() {
    state.activeMobilePanel = null;
    syncMobilePanels();
  }

  function syncMobilePanels() {
    document.body.classList.toggle("mobile-panel-open", Boolean(state.activeMobilePanel));
    document.querySelectorAll("[data-mobile-panel-name]").forEach((panel) => {
      panel.classList.toggle("is-open", panel.dataset.mobilePanelName === state.activeMobilePanel);
    });
    document.querySelectorAll("[data-mobile-panel]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mobilePanel === state.activeMobilePanel);
    });
  }

  function showFaq() {
    state.faqVisible = true;
    const panel = document.getElementById("faq-panel");
    if (panel) {
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function hideFaq() {
    state.faqVisible = false;
    const panel = document.getElementById("faq-panel");
    if (panel) {
      panel.hidden = true;
    }
  }

  function bindAccountMenu() {
    const menu = document.getElementById("account-menu");
    const saveButton = document.getElementById("menu-save");
    const loadButton = document.getElementById("menu-load");
    const leaderboardButton = document.getElementById("menu-leaderboard");
    const faqButton = document.getElementById("menu-faq");
    const suggestButton = document.getElementById("menu-suggest");
    const issueButton = document.getElementById("menu-issue");
    const quitButton = document.getElementById("menu-quit");
    const logoutButton = document.getElementById("menu-logout");
    if (!saveButton || !loadButton || !leaderboardButton || !faqButton || !suggestButton || !issueButton || !quitButton || !logoutButton) {
      return;
    }
    if (menu) {
      menu.hidden = false;
    }
    saveButton.disabled = !state.player;
    logoutButton.disabled = !state.account;
    saveButton.onclick = () => runAccountMenuAction(saveGame);
    loadButton.onclick = () => runAccountMenuAction(loadGame);
    leaderboardButton.onclick = () => runAccountMenuAction(showLeaderboard);
    faqButton.onclick = () => runAccountMenuAction(showFaq);
    suggestButton.onclick = () => runAccountMenuAction(openSuggestionForm);
    issueButton.onclick = () => runAccountMenuAction(openIssueForm);
    quitButton.onclick = () => runAccountMenuAction(quitGame);
    logoutButton.onclick = () => runAccountMenuAction(logout);
  }

  function runAccountMenuAction(action) {
    const menu = document.getElementById("account-menu");
    if (menu) {
      menu.open = false;
    }
    action();
  }

  function openSuggestionForm() {
    openExternal(SUGGESTION_URL);
  }

  function openIssueForm() {
    openExternal(ISSUE_URL);
  }

  function openExternal(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function faqHtml() {
    const entries = lang === "es" ? [
      {
        question: "Que hacen las opciones de ataque?",
        answer: "Attack usa tus ataques normales. Heavy Attack hace un solo ataque mas fuerte, pero con -2 al tiro para golpear. Dodge sube tu AC por ese turno. Run intenta escapar con una tirada de sneak. Health Potion aparece cuando llevas una pocion y cura 2d4 + 6 antes de que el enemigo responda."
      },
      {
        question: "Como se calculan los puntajes?",
        answer: "Tu puntaje suma nivel x 100, experiencia, peleas ganadas x 75, decisiones x 15, logros x 50, oro x 5, suministros x 10 y equipo x 10. Terminar una ruta suma 1000. Algunos objetos importantes dan bonificaciones: la muneca, el orbe de magistone y los mapas. Morir resta 200."
      },
      {
        question: "Cuando puedo enviar un puntaje?",
        answer: "Puedes enviar un puntaje desde Game Over o desde un final de capitulo. Cada partida guardada solo puede enviarse una vez."
      },
      {
        question: "Que hacen los premios de nivel?",
        answer: "Gain HP aumenta la vida maxima y actual. Gain AC hace que seas mas dificil de golpear. Gain Damage aumenta tu bono de dano. Full Heal restaura toda tu vida."
      },
      {
        question: "Como funcionan las cuentas y guardados?",
        answer: "Los invitados guardan en este navegador. Si inicias sesion, el juego tambien intenta guardar tus estadisticas y partida en la nube para usarlas despues."
      }
    ] : [
      {
        question: "What do the attack options do?",
        answer: "Attack uses your normal number of attacks. Heavy Attack makes one stronger swing, but takes -2 on the hit roll. Dodge raises your AC for that enemy turn. Run tries to escape with a sneak roll. Health Potion appears when you have one and heals 2d4 + 6 before the enemy responds."
      },
      {
        question: "How are leaderboard scores calculated?",
        answer: "Your score adds level x 100, experience, fights won x 75, decisions x 15, and achievements x 50. Reaching an ending adds 1000. Key items can add bonuses too: the doll, magistone orb, and maps. Dying subtracts 200."
      },
      {
        question: "When can I submit a score?",
        answer: "You can submit from Game Over or from a chapter ending. Each saved run can only submit once."
      },
      {
        question: "What do level-up rewards do?",
        answer: "Gain HP raises max HP and current HP. Gain AC makes you harder to hit. Gain Damage increases your damage bonus. Full Heal restores you to max HP."
      },
      {
        question: "How do accounts and saves work?",
        answer: "Guests save in this browser. Signed-in players stay signed in unless they log out, and the game also tries to sync stats and saves to the cloud."
      }
    ];
    return entries.map((entry) => `
      <article class="faq-entry">
        <h3>${escapeHtml(entry.question)}</h3>
        <p>${escapeHtml(entry.answer)}</p>
      </article>
    `).join("");
  }

  function showStart() {
    const stats = plotText();
    write(t("story.start", { stats }), true);
    const choices = [
      choice(t("choice.new_game"), showCharacterSelect),
      choice(t("choice.load_game"), loadGame),
      choice(ui.leaderboard, showLeaderboard),
      choice(ui.suggest, openSuggestionForm),
      choice(ui.reportIssue, openIssueForm),
      choice(t("choice.quit"), quitGame)
    ];
    setChoices(choices);
  }

  function quitGame() {
    write("You can close this browser tab whenever you are ready.");
  }

  function showLoginScreen() {
    state.player = null;
    write(ui.loginScreen, true);
    setChoices([
      choice(ui.login, signIn),
      choice(ui.googleLogin, signInWithGoogle),
      choice(ui.createAccount, createAccount),
      choice(ui.playAsGuest, playAsGuest)
    ]);
  }

  async function signIn() {
    const email = promptText(ui.loginPrompt, state.account && state.account.email ? state.account.email : "");
    if (!email) {
      return;
    }
    const password = promptText(ui.passwordPrompt, "");
    if (!password) {
      return;
    }
    try {
      const session = await authRequest("token?grant_type=password", {
        email,
        password
      });
      setAuthenticatedAccount(session);
      await loadCloudData();
      showStart();
    } catch {
      write(ui.loginFailed);
    }
  }

  async function createAccount() {
    const displayName = promptText(ui.displayNamePrompt, "");
    if (!displayName) {
      return;
    }
    const email = promptText(ui.emailPrompt, "");
    if (!email) {
      return;
    }
    const password = promptText(ui.passwordPrompt, "");
    if (!password) {
      return;
    }
    try {
      const session = await authRequest("signup", {
        email,
        password,
        data: { display_name: displayName }
      });
      if (session.access_token) {
        setAuthenticatedAccount(session, displayName);
        await saveProfile();
        await saveCloudData();
        showStart();
      } else {
        state.account = {
          name: displayName.trim().slice(0, 32),
          email,
          guest: false,
          pendingConfirmation: true
        };
        localStorage.setItem(`${storagePrefix}account`, JSON.stringify(state.account));
        localStorage.setItem(`${storagePrefix}leaderboardName`, state.account.name);
        write(ui.accountCreated, true);
        setChoices([
          choice(ui.login, signIn),
          choice(ui.playAsGuest, playAsGuest)
        ]);
      }
    } catch {
      write(ui.signupFailed);
    }
  }

  function signInWithGoogle() {
    const redirectTo = window.location.href.split("#")[0];
    const params = new URLSearchParams({
      provider: "google",
      redirect_to: redirectTo
    });
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
  }

  function playAsGuest() {
    state.account = { name: ui.guest, guest: true };
    localStorage.removeItem(`${storagePrefix}account`);
    showStart();
  }

  async function logout() {
    state.account = null;
    state.player = null;
    localStorage.removeItem(`${storagePrefix}account`);
    write(ui.logoutDone, true);
    setChoices([
      choice(ui.login, signIn),
      choice(ui.googleLogin, signInWithGoogle),
      choice(ui.createAccount, createAccount),
      choice(ui.playAsGuest, playAsGuest)
    ]);
  }

  function showCharacterSelect() {
    const lines = [t("story.character_select"), ""];
    Object.keys(classes).forEach((key) => {
      const data = classes[key];
      lines.push(`${data.name} the ${data.title}: ${data.description}`);
    });
    write(lines.join("\n"), true);
    setChoices([
      choice("Cletus", () => newPlayer("warrior")),
      choice("Ren", () => newPlayer("ranger")),
      choice("Cal", () => newPlayer("scholar")),
      choice("Kili", () => newPlayer("dwarf")),
      choice("Jon the DM", () => newPlayer("dm")),
      choice(t("choice.back"), showStart)
    ]);
  }

  function newPlayer(characterClass) {
    const template = classes[characterClass];
    state.player = {
      class: characterClass,
      name: template.name,
      title: template.title,
      race: template.race,
      health: template.maxHealth,
      maxHealth: template.maxHealth,
      gold: template.gold,
      supplies: template.supplies,
      gear: [...template.gear],
      bonus: template.bonus,
      level: BASE_LEVEL,
      experience: 0,
      xpToNext: BASE_XP_TO_NEXT,
      upgrades: { ac: 0, damage: 0 },
      flags: {
        forestAttempts: 0,
        girlHint: "",
        girlHelped: false,
        monstersScattered: false,
        hasDoll: false,
        hasThroneMap: false,
        hasPartialMap: false,
        bridgeXpAwarded: false,
        bridgeRested: false,
        hasDwarvenAle: false,
        hasMagistoneOrb: false,
        hasSilverMask: false,
        wearingSilverMask: false,
        maskPowerClaimed: false,
        bridgeEndMaskResolved: false,
        maskCorruption: 0,
        orderQuestionsAsked: [],
        bridgeEndRested: false,
        completedRecorded: false,
        deathRecorded: false
      },
      score: {
        fightsWon: 0,
        decisions: 0,
        submitted: false,
        startedAt: Date.now()
      },
      gameOverReason: "default"
    };
    state.stats[characterClass].runs += 1;
    saveStats();
    checkPlayedEveryone();
    continueChapter(characterClass === "dm" ? "dmIntro" : "caravan", true);
  }

  function continueChapter(chapter, clear = false) {
    if (!state.player) {
      showStart();
      return;
    }
    if (state.player.health <= 0) {
      gameOver();
      return;
    }
    const chapters = {
      dmIntro,
      dmGhost,
      dmDistricts,
      dmBridgeEnd,
      dmOrcCamps: dmOrcCampsPreview,
      caravan,
      escape,
      cave,
      ghostGirl,
      districts,
      residential,
      bridge,
      bridgeEnd,
      orcCamps,
      complete
    };
    state.player.chapter = chapter;
    chapters[chapter](clear);
  }

  function dmIntro(clear = false) {
    writeKey("story.dm_intro", {}, clear);
    setChoices([
      choice(t("choice.dm_orcs"), () => {
        writeKey("story.dm_send_orcs");
        setChoices([
          choice(t("choice.caves"), () => dmChooseRoute("caves")),
          choice(t("choice.forest"), () => dmChooseRoute("forest"))
        ]);
      }),
      choice(t("choice.dm_hydra"), () => {
        unlock("send_hydra");
        state.player.gameOverReason = "hydra";
        state.player.health = 0;
        gameOver();
      })
    ]);
  }

  function dmChooseRoute(route) {
    writeKey(route === "forest" ? "story.dm_choose_forest" : "story.dm_choose_caves");
    continueChapter("dmGhost");
  }

  function dmGhost(clear = false) {
    writeKey("story.dm_ghost", {}, clear);
    setChoices([
      choice("Cletus", () => dmWatch("cletus")),
      choice("Cal", () => dmWatch("cal")),
      choice("Ren", () => dmWatch("ren")),
      choice("Kili", () => dmWatch("kili"))
    ]);
  }

  function dmWatch(name) {
    const roll = d20();
    const key = roll <= 10 ? "low" : "high";
    writeKey("story.dm_watch_result", { roll, result: t(`story.dm_watch_${name}_${key}`) });
    writeKey("story.dm_watch_continue");
    setChoices([choice(t("choice.keep_watching"), () => continueChapter("dmDistricts"))]);
  }

  function dmDistricts(clear = false) {
    writeKey("story.dm_districts", {}, clear);
    setChoices([
      choice(t("choice.dm_barracks"), dmBarracks),
      choice(t("choice.dm_merchant"), dmMerchant)
    ]);
  }

  function dmBarracks() {
    writeKey("story.dm_barracks");
    setChoices([
      choice(t("choice.dm_barracks_armory"), () => dmRollScene("story.dm_barracks_armory", "story.dm_barracks_armory", 10, dmBarracksLoot)),
      choice(t("choice.dm_barracks_quarters"), () => dmRollScene("story.dm_barracks_quarters", "story.dm_barracks_quarters", 10, dmBarracksLoot)),
      choice(t("choice.dm_barracks_combat"), () => {
        writeKey("story.dm_barracks_combat");
        setChoices([choice(t("choice.loot_bodies"), dmBarracksMap)]);
      })
    ]);
  }

  function dmRollScene(templateKey, resultPrefix, threshold, next) {
    const roll = d20();
    const result = t(`${resultPrefix}_${roll <= threshold ? "low" : "high"}`);
    writeKey(templateKey, { roll, result });
    setChoices([choice(t("choice.roll_loot"), next)]);
  }

  function dmBarracksLoot() {
    const roll = d20();
    const result = roll <= 7 ? "low" : roll <= 14 ? "mid" : "high";
    writeKey("story.dm_barracks_loot", { roll, result: t(`story.dm_barracks_loot_${result}`) });
    setChoices([choice(roll > 14 ? t("choice.read_map") : t("choice.move_houses"), roll > 14 ? dmBarracksMap : dmResidential)]);
  }

  function dmBarracksMap() {
    writeKey("story.dm_barracks_map");
    setChoices([choice(t("choice.move_houses"), dmResidential)]);
  }

  function dmMerchant() {
    writeKey("story.dm_merchant");
    setChoices([
      choice(t("choice.dm_merchant_shop"), dmMerchantShop),
      choice(t("choice.dm_merchant_sneak"), dmMerchantSneak),
      choice(t("choice.dm_merchant_combat"), dmMerchantCombat)
    ]);
  }

  function dmMerchantShop() {
    const roll = d20();
    const result = t(`story.dm_merchant_shop_${roll <= 10 ? "low" : "high"}`);
    writeKey("story.dm_merchant_shop", { roll, result });
    setChoices([choice(roll <= 10 ? t("choice.make_fight") : t("choice.roll_loot"), roll <= 10 ? dmMerchantCombat : dmMerchantLoot)]);
  }

  function dmMerchantSneak() {
    const roll = d20();
    const result = t(`story.dm_merchant_sneak_${roll <= 16 ? "low" : "high"}`);
    writeKey("story.dm_merchant_sneak", { roll, result });
    setChoices([choice(roll <= 16 ? t("choice.make_fight") : t("choice.move_houses"), roll <= 16 ? dmMerchantCombat : dmResidential)]);
  }

  function dmMerchantCombat() {
    writeKey("story.dm_merchant_combat");
    setChoices([choice(t("choice.loot_bodies"), dmMerchantMap)]);
  }

  function dmMerchantLoot() {
    const roll = d20();
    const result = roll <= 7 ? "low" : roll <= 14 ? "mid" : "high";
    writeKey("story.dm_merchant_loot", { roll, result: t(`story.dm_merchant_loot_${result}`) });
    setChoices([choice(roll > 14 ? t("choice.read_map") : t("choice.move_houses"), roll > 14 ? dmMerchantMap : dmResidential)]);
  }

  function dmMerchantMap() {
    writeKey("story.dm_merchant_map");
    setChoices([choice(t("choice.move_houses"), dmResidential)]);
  }

  function dmResidential() {
    writeKey("story.dm_residential");
    setChoices([
      choice(t("choice.dm_manor"), dmManor),
      choice(t("choice.dm_shack"), () => {
        writeKey("story.dm_shack");
        setChoices([choice(t("choice.move_bridge"), dmBridge)]);
      }),
      choice(t("choice.dm_mimic_house"), dmMimicHouse),
      choice(t("choice.dm_bridge"), dmBridge)
    ]);
  }

  function dmManor() {
    writeKey("story.dm_manor");
    setChoices([
      choice(t("choice.dm_manor_orb"), () => {
        writeKey("story.dm_manor_orb");
        setChoices([choice(t("choice.move_bridge"), dmBridge)]);
      }),
      choice(t("choice.dm_manor_boom"), () => {
        writeKey("story.dm_manor_boom");
        setChoices([choice(t("choice.rewind"), dmResidential)]);
      }),
      choice(t("choice.dm_bridge"), dmBridge)
    ]);
  }

  function dmMimicHouse() {
    writeKey("story.dm_mimic_house");
    setChoices([
      choice(t("choice.dm_mimic_burn"), () => {
        writeKey("story.dm_mimic_burn");
        setChoices([choice(t("choice.move_bridge"), dmBridge)]);
      }),
      choice(t("choice.dm_bridge"), dmBridge),
      choice(t("choice.dm_mimic_loot"), () => {
        writeKey("story.dm_mimic_loot");
        setChoices([choice(t("choice.drag_out"), dmBridge)]);
      }),
      choice(t("choice.dm_mimic_rest"), () => {
        writeKey("story.dm_mimic_rest");
        setChoices([choice(t("choice.rewind"), dmMimicHouse)]);
      })
    ]);
  }

  function dmBridge() {
    writeKey("story.dm_bridge");
    setChoices([
      choice(t("choice.dm_watch_sneak"), dmBridgeSneak),
      choice(t("choice.dm_skip_warehouse"), dmWarehouse)
    ]);
  }

  function dmBridgeSneak() {
    writeKey("story.dm_bridge_sneak_start");
    const roll = rollD20("sneak");
    const spotted = roll <= 10;
    writeKey("story.dm_bridge_sneak_result", {
      roll,
      result: t(spotted ? "story.dm_bridge_sneak_low" : "story.dm_bridge_sneak_high")
    });
    setChoices([
      spotted
        ? choice(t("choice.dm_bridge_patrol"), dmBridgePatrol)
        : choice(t("choice.dm_follow_warehouse"), dmWarehouse)
    ]);
  }

  function dmBridgePatrol() {
    writeKey("story.dm_bridge_patrol");
    setChoices([
      choice(t("choice.dm_if_win"), dmWarehouse),
      choice(t("choice.dm_if_lose"), () => dmGameOver("combat"))
    ]);
  }

  function dmWarehouse() {
    writeKey("story.dm_warehouse");
    setChoices([
      choice(t("choice.dm_if_win"), dmWarehouseLeaderRage),
      choice(t("choice.dm_if_lose"), () => dmGameOver("warehouse"))
    ]);
  }

  function dmWarehouseLeaderRage() {
    writeKey("story.dm_warehouse_leader_rage");
    setChoices([
      choice(t("choice.dm_if_win"), dmSilverMaskChoice),
      choice(t("choice.dm_if_lose"), () => dmGameOver("warehouse"))
    ]);
  }

  function dmSilverMaskChoice() {
    writeKey("story.dm_silver_mask_choice");
    setChoices([
      choice(t("choice.dm_leave_mask"), () => {
        state.player.flags.hasSilverMask = false;
        state.player.flags.wearingSilverMask = false;
        writeKey("story.dm_silver_mask_left");
        dmRitualSurge();
      }),
      choice(t("choice.dm_store_mask"), () => {
        state.player.flags.hasSilverMask = true;
        state.player.flags.wearingSilverMask = false;
        addItem("silver mask");
        writeKey("story.dm_silver_mask_stored");
        dmRitualSurge();
      }),
      choice(t("choice.dm_wear_mask"), () => {
        state.player.flags.hasSilverMask = true;
        state.player.flags.wearingSilverMask = true;
        applySilverMaskPower();
        addItem("silver mask");
        writeKey("story.dm_silver_mask_worn");
        dmRitualSurge();
      })
    ]);
  }

  function dmRitualSurge() {
    writeKey("story.dm_ritual_surge");
    setChoices([
      choice(t("choice.dm_leave_warehouse"), dmWarehouseLeave),
      choice(t("choice.dm_stop_ritual"), dmWarehouseStopRitual),
      choice(t("choice.dm_jump_hole"), dmWarehouseJumpHole)
    ]);
  }

  function dmWarehouseLeave() {
    writeKey("story.dm_warehouse_leave");
    setChoices([choice(t("choice.dm_order_arrive"), dmFalseHydraInterruption)]);
  }

  function dmFalseHydraInterruption() {
    writeKey("story.dm_false_hydra_interruption");
    setChoices([choice(t("choice.dm_listen_order"), dmOrderDialogue)]);
  }

  function dmOrderDialogue() {
    writeKey("story.dm_order_dialogue");
    dmBridgeEnd();
  }

  function dmWarehouseStopRitual() {
    writeKey("story.dm_warehouse_stop_ritual");
    dmBridgeEnd();
  }

  function dmWarehouseJumpHole() {
    writeKey("story.dm_warehouse_jump_hole");
    setChoices([choice(t("choice.dm_game_over"), () => dmGameOver("ritual_hole"))]);
  }

  function dmBridgeEnd() {
    state.player.chapter = "dmBridgeEnd";
    writeKey("story.dm_bridge_end");
    unlock("warehouse_survived");
    recordEnding();
    saveGame();
    showDmBridgeEndChoices();
  }

  function showDmBridgeEndChoices() {
    const choices = [
      choice(t("choice.dm_rest_bridge"), dmBridgeEndRest)
    ];
    if (state.player.flags.hasSilverMask && !state.player.flags.wearingSilverMask) {
      choices.push(choice(t("choice.dm_put_mask_on"), dmSilverMaskReworn));
    }
    choices.push(
      choice(t("choice.dm_move_orc_camps"), dmOrcCampsPreview),
      choice(t("choice.current_status"), currentGameStatus)
    );
    setChoices(choices);
  }

  function dmSilverMaskReworn() {
    state.player.flags.wearingSilverMask = true;
    applySilverMaskPower();
    writeKey("story.dm_silver_mask_reworn");
    showDmBridgeEndChoices();
  }

  function dmBridgeEndRest() {
    state.player.health = state.player.maxHealth;
    writeKey("story.dm_bridge_end_rest");
    showDmBridgeEndChoices();
  }

  function dmOrcCampsPreview() {
    state.player.chapter = "dmOrcCamps";
    writeKey("story.dm_orc_camps_preview");
    recordEnding();
    saveGame();
    setChoices([
      choice(t("choice.main_menu"), showStart),
      choice(t("choice.current_status"), currentGameStatus)
    ]);
  }

  function dmGameOver(reason) {
    state.player.gameOverReason = reason;
    state.player.health = 0;
    gameOver();
  }

  function currentGameStatus() {
    writeKey("story.current_status", { version: VERSION }, true);
    setChoices([choice(t("choice.back_start"), showStart)]);
  }

  function caravan(clear = false) {
    writeKey("story.caravan", {}, clear);
    setChoices([
      choice(t("choice.fight"), () => {
        writeKey("story.caravan_fight");
        startCombat(["orc", "goblin", "goblin"], "story.caravan_combat_victory", {
          attackersPerRound: 2,
          onWin: () => {
            unlock("first_fight");
            addItem("notched axe");
            writeKey("story.caravan_overrun");
            continueChapter("escape");
          },
          onRun: () => {
            writeKey("story.caravan_run");
            state.player.supplies += 1;
            writeKey("story.caravan_overrun");
            continueChapter("escape");
          }
        });
      }),
      choice(t("choice.run"), () => {
        writeKey("story.caravan_run");
        state.player.supplies += 1;
        awardDecisionXp("caravan_run");
        writeKey("story.caravan_overrun");
        continueChapter("escape");
      }),
      choice(t("choice.save"), saveGame),
      choice(t("choice.main_menu"), showStart)
    ]);
  }

  function escape(clear = false) {
    writeKey("story.escape", {}, clear);
    setChoices([
      choice(t("choice.forest"), () => {
        state.player.flags.forestAttempts += 1;
        state.stats[state.player.class].forest_attempts += 1;
        saveStats();
        writeKey("story.escape_forest");
        if (state.player.flags.forestAttempts > 5) {
          unlock("forest_mind_break");
          state.player.gameOverReason = "forest_mind_break";
          state.player.health = 0;
          gameOver();
          return;
        }
        writeKey("story.escape_forest_repeat");
        awardDecisionXp("forest_attempt");
        continueChapter("escape");
      }),
      choice(t("choice.cave"), () => {
        writeKey("story.escape_cave");
        awardDecisionXp("choose_cave");
        continueChapter("cave");
      })
    ]);
  }

  function cave(clear = false) {
    writeKey("story.cave", {}, clear);
    setChoices([
      choice(t("choice.fight"), () => {
        writeKey("story.cave_fight_start");
        startCombat(["goblin", "goblin"], "story.cave_fight_success", {
          attackersPerRound: 2,
          onWin: () => continueChapter("ghostGirl"),
          onRun: () => {
            writeKey("story.cave_deeper");
            continueChapter("ghostGirl");
          }
        });
      }),
      choice(t("choice.go_deeper"), () => {
        writeKey("story.cave_deeper");
        awardDecisionXp("go_deeper");
        continueChapter("ghostGirl");
      })
    ]);
  }

  function ghostGirl(clear = false) {
    writeKey("story.ghost_girl", {}, clear);
    setChoices([
      choice(t("choice.persuade"), ghostPersuade),
      choice(t("choice.fight"), ghostFight),
      choice(t("choice.sneak_past"), () => {
        writeKey("story.sneak_past_girl_start");
        writeKey("story.sneak_past_girl_result");
        writeKey("story.ghost_black_miasma");
        awardDecisionXp("ghost_choice");
        dollChoice();
      })
    ]);
  }

  function ghostPersuade() {
    const roll = rollD20("persuasion");
    if (roll <= 7) {
      writeKey("story.persuade_low");
      dollChoice();
    } else if (roll <= 15) {
      state.player.flags.girlHint = "merchant_glowy_ball";
      writeKey("story.persuade_mid");
      dollChoice();
    } else {
      state.player.flags.girlHelped = true;
      state.player.flags.monstersScattered = true;
      unlock("ghost_ally");
      writeKey("story.persuade_high");
      awardDecisionXp("ghost_choice");
      continueChapter("districts");
    }
  }

  function ghostFight() {
    const cls = state.player.class;
    writeKey(`story.fight_girl_${cls}`);
    awardDecisionXp("ghost_choice");
    if (cls === "scholar") {
      unlock("ghost_slayer");
      writeKey("story.ghost_black_miasma");
      dollChoice();
      return;
    }
    if (cls === "ranger") {
      writeKey("story.ghost_black_miasma");
      dollChoice();
      return;
    }
    if (cls === "dwarf") {
      unlock("ghost_kiss");
    }
    writeKey("story.ghost_play");
    state.player.gameOverReason = "ghost_black_pits";
    state.player.health = 0;
    gameOver();
  }

  function dollChoice() {
    writeKey("story.doll_choice");
    setChoices([
      choice(t("choice.grab_doll"), () => {
        state.player.flags.hasDoll = true;
        addItem("cracked doll");
        writeKey("story.doll_grab");
        awardDecisionXp("doll_choice");
        continueChapter("districts");
      }),
      choice(t("choice.leave_doll"), () => {
        addItem("cracked doll");
        state.player.flags.hasDoll = true;
        writeKey("story.doll_leave");
        awardDecisionXp("doll_choice");
        continueChapter("districts");
      })
    ]);
  }

  function districts(clear = false) {
    writeKey("story.districts", {}, clear);
    setChoices([
      choice(t("choice.barracks"), () => {
        awardDecisionXp("district_choice");
        barracks();
      }),
      choice(t("choice.merchant_district"), () => {
        awardDecisionXp("district_choice");
        merchant();
      }),
      choice(t("choice.rest"), () => {
        state.player.health = state.player.maxHealth;
        writeKey("story.districts_rest");
        districts();
      }),
      choice(t("choice.save"), saveGame)
    ]);
  }

  function barracks() {
    writeKey("story.barracks_enter");
    writeKey("story.barracks_description");
    setChoices([
      choice(t("choice.sneak_armory"), () => barracksSneak("armory")),
      choice(t("choice.center_ring"), barracksCombat),
      choice(t("choice.sneak_quarters"), () => barracksSneak("quarters"))
    ]);
  }

  function barracksSneak(type) {
    writeKey(type === "armory" ? "story.barracks_armory" : "story.barracks_quarters");
    const roll = rollD20("sneak");
    if (roll <= 10) {
      writeKey(type === "armory" ? "story.barracks_armory_fail" : "story.barracks_quarters_fail");
      barracksCombat();
    } else {
      writeKey(type === "armory" ? "story.barracks_armory_success" : "story.barracks_quarters_success");
      searchLoot(() => continueChapter("residential"));
    }
  }

  function barracksCombat() {
    writeKey("story.barracks_fight");
    startCombat(["orc", "orc", "orc"], "story.barracks_combat_victory", {
      attackersPerRound: 1,
      onWin: () => {
        writeKey("story.combat_loot_map");
        awardMap();
        continueChapter("residential");
      },
      onRun: () => continueChapter("residential")
    });
  }

  function merchant() {
    writeKey("story.city_enter");
    if (state.player.flags.girlHint === "merchant_glowy_ball") {
      writeKey("story.city_girl_hint");
    }
    writeKey("story.city_description");
    setChoices([
      choice(t("choice.sneak_shop"), () => merchantShop()),
      choice(t("choice.assault_monsters"), merchantCombat),
      choice(t("choice.sneak_past_monsters"), merchantSneak)
    ]);
  }

  function merchantShop() {
    writeKey("story.city_shop");
    const roll = rollD20("sneak");
    if (roll <= 10) {
      writeKey("story.city_shop_fail");
      merchantCombat();
    } else {
      writeKey("story.city_shop_success");
      searchLoot(() => continueChapter("residential"));
    }
  }

  function merchantSneak() {
    writeKey("story.city_sneak");
    const roll = rollD20("sneak");
    if (roll <= 16) {
      writeKey("story.city_sneak_fail");
      merchantCombat();
    } else {
      writeKey("story.city_sneak_success");
      continueChapter("residential");
    }
  }

  function merchantCombat() {
    writeKey("story.city_assault");
    startCombat(["goblin", "goblin", "goblin", "goblin", "goblin", "orc", "orc"], "story.city_combat_victory", {
      attackersPerRound: 1,
      onWin: () => {
        writeKey("story.combat_loot_map");
        awardMap();
        continueChapter("residential");
      },
      onRun: () => continueChapter("residential")
    });
  }

  function searchLoot(next) {
    const roll = rollD20("search");
    awardDecisionXp("search");
    if (roll <= 7) {
      writeKey("story.search_city_low");
      state.player.gold += 3;
      state.player.flags.hasDwarvenAle = true;
      addItem("dwarven ale");
    } else if (roll <= 14) {
      writeKey("story.search_potion");
      addItem("health potion");
    } else {
      awardMap();
    }
    setChoices([choice(ui.moveOn, next)]);
  }

  function awardMap() {
    state.player.flags.hasThroneMap = true;
    writeKey("story.throne_map", { directions: MAP_DIRECTIONS.join(", ") });
  }

  function residential(clear = false) {
    writeKey("story.residential_enter", {}, clear);
    writeKey("story.residential");
    const choices = [
      choice(t("choice.large_manor"), () => {
        awardDecisionXp("residential_choice");
        largeManor();
      }),
      choice(t("choice.small_shack"), () => {
        awardDecisionXp("residential_choice");
        smallShack();
      }),
      choice(t("choice.large_house"), () => {
        awardDecisionXp("residential_choice");
        mimicHouse();
      })
    ];
    if (!state.player.flags.bridgeRested) {
      choices.push(choice(t("choice.rest"), restBeforeBridge));
    }
    choices.push(
      choice(t("choice.proceed_bridge"), () => goBridge())
    );
    setChoices(choices);
  }

  function restBeforeBridge() {
    state.player.flags.bridgeRested = true;
    state.player.health = state.player.maxHealth;
    writeKey("story.residential_rest");
    setChoices([
      choice(t("choice.proceed_bridge"), goBridge),
      choice(t("choice.save"), saveGame)
    ]);
  }

  function largeManor() {
    writeKey("story.large_manor");
    const roll = rollD20("sneak");
    if (roll <= 14) {
      writeKey("story.large_manor_seen");
      manorCombat();
    } else if (roll <= 19) {
      writeKey("story.large_manor_unseen");
      setChoices([
        choice(t("choice.attack_them"), manorCombat),
        choice(t("choice.sneak_past"), manorSneak),
        choice(t("choice.proceed_bridge"), goBridge)
      ]);
    } else {
      writeKey("story.large_manor_grouped");
      setChoices([choice(t("choice.take_them_out"), manorGroupKill)]);
    }
  }

  function manorSneak() {
    writeKey("story.manor_sneak");
    setChoices([
      choice(t("choice.attack_them"), manorCombat),
      choice(t("choice.loot_manor"), manorLoot),
      choice(t("choice.proceed_bridge"), goBridge)
    ]);
  }

  function manorGroupKill() {
    writeKey(`story.manor_group_kill_${state.player.class}`);
    unlock("group_kill");
    ensureScoreState();
    state.player.score.fightsWon += 1;
    awardXp((monsterStats.goblin.xp * 5) + (monsterStats.orc.xp * 2), "combat");
    manorWin();
  }

  function manorCombat() {
    startCombat(["goblin", "goblin", "goblin", "goblin", "goblin", "orc", "orc"], "story.manor_combat_victory", {
      attackersPerRound: 1,
      onWin: manorWin,
      onRun: goBridge
    });
  }

  function manorWin() {
    writeKey("story.manor_win");
    setChoices([choice(t("choice.loot_manor"), manorLoot)]);
  }

  function manorLoot() {
    writeKey("story.manor_loot");
    setChoices(manorLootChoices(!state.player.flags.manorRested));
  }

  function manorLootChoices(includeRest) {
    const choices = [
      choice(t("choice.use_keys_chest"), manorChestKeys),
      choice(t("choice.leave_found"), goBridge),
      choice(t("choice.store_keys_chest"), () => {
        addItem("unmarked keys");
        addItem("small black chest");
        writeKey("story.manor_store_chest");
        setChoices([choice(t("choice.leave_house"), goBridge)]);
      })
    ];
    if (includeRest) {
      choices.push(choice(t("choice.rest"), manorRest));
    }
    return choices;
  }

  function manorRest() {
    state.player.flags.manorRested = true;
    state.player.health = state.player.maxHealth;
    writeKey("story.manor_rest");
    setChoices(manorLootChoices(false));
  }

  function manorChestKeys() {
    writeKey("story.manor_chest_keys");
    const keys = ["blue", "yellow", "red", "black", "iron", "gold", "silver", "green"];
    setChoices(keys.map((key) => choice(t(`choice.${key}_key`), () => {
      if (key === "red") {
        unlock("correct_chest_key");
        writeKey("story.manor_chest_unlock");
        setChoices([choice(t("choice.open_chest"), () => {
          state.player.flags.hasMagistoneOrb = true;
          addItem("magistone orb");
          writeKey("story.manor_magistone_orb");
          setChoices([choice(t("choice.leave_house"), goBridge)]);
        })]);
      } else {
        writeKey("story.manor_chest_trap");
        state.player.gameOverReason = "manor_chest";
        state.player.health = 0;
        gameOver();
      }
    })));
  }

  function smallShack() {
    writeKey("story.small_shack");
    startCombat(["gremlin", "ghoul"], "story.small_shack_win", {
      attackersPerRound: 2,
      onWin: () => {
        setChoices([
          choice(t("choice.return_street"), () => continueChapter("residential", true)),
          choice(t("choice.proceed_bridge"), goBridge)
        ]);
      },
      onRun: goBridge
    });
  }

  function mimicHouse() {
    writeKey("story.mimic_house");
    setChoices([
      choice(t("choice.burn_house"), () => {
        unlock("pyromaniac");
        writeKey("story.mimic_house_burn");
        setChoices([choice(t("choice.leave_house"), goBridge)]);
      }),
      choice(t("choice.leave_immediately"), () => {
        writeKey("story.mimic_house_leave");
        goBridge();
      }),
      choice(t("choice.loot_chests"), () => {
        writeKey("story.mimic_house_loot");
        writeKey("story.mimic_house_loot_clear");
        mimicFightOne();
      }),
      choice(t("choice.rest_here"), () => {
        unlock("mimic_nap");
        writeKey("story.mimic_house_rest");
        state.player.gameOverReason = "mimic";
        state.player.health = 0;
        gameOver();
      })
    ]);
  }

  function mimicFightOne() {
    startCombat(["mimic"], "story.mimic_house_fight_one_win", {
      attackersPerRound: 1,
      deathReason: "mimic",
      onWin: () => {
        writeKey("story.mimic_house_second_wave");
        setChoices([
          choice(t("choice.fight"), mimicFightTwo),
          choice(t("choice.flee"), mimicFlee)
        ]);
      },
      onRun: mimicFlee
    });
  }

  function mimicFightTwo() {
    startCombat(["mimic", "mimic"], "story.mimic_house_fight_two_win", {
      attackersPerRound: 2,
      deathReason: "mimic",
      onWin: () => {
        state.player.flags.hasPartialMap = true;
        state.player.flags.hasMagistoneOrb = true;
        addItem("torn bridge map");
        addItem("magistone orb");
        writeKey("story.mimic_house_escape");
        setChoices([choice(t("choice.proceed_bridge"), goBridge)]);
      },
      onRun: mimicFlee
    });
  }

  function mimicFlee() {
    writeKey("story.mimic_house_flee");
    const options = [
      choice(t("choice.black_hole"), () => {
        writeKey("story.mimic_house_black_hole");
        state.player.gameOverReason = "mimic";
        state.player.health = 0;
        gameOver();
      }),
      choice(t("choice.cast_fire"), () => {
        writeKey("story.mimic_house_fire");
        setChoices([choice(t("choice.proceed_bridge"), goBridge)]);
      }),
      choice(t("choice.attack_walls"), () => {
        writeKey("story.mimic_house_walls");
        state.player.gameOverReason = "mimic";
        state.player.health = 0;
        gameOver();
      })
    ];
    if (state.player.flags.hasDwarvenAle || state.player.gear.includes("dwarven ale")) {
      options.push(choice(t("choice.pour_ale"), () => {
        removeItem("dwarven ale");
        writeKey("story.mimic_house_ale");
        setChoices([choice(t("choice.proceed_bridge"), goBridge)]);
      }));
    }
    setChoices(options);
  }

  function goBridge() {
    if (!state.player.flags.bridgeXpAwarded) {
      state.player.flags.bridgeXpAwarded = true;
      awardDecisionXp("bridge");
    }
    continueChapter("bridge");
  }

  function bridge(clear = false) {
    let text = t("story.bridge");
    if (state.player.flags.hasThroneMap) {
      text += t("story.bridge_has_map");
    } else if (state.player.flags.hasPartialMap) {
      text += t("story.bridge_partial_map");
    } else {
      text += t("story.bridge_no_map");
    }
    write(text, clear);
    setChoices([
      choice(t("choice.sneak_bridge"), bridgeSneak),
      choice(t("choice.save"), saveGame)
    ]);
  }

  function bridgeSneak() {
    writeKey("story.bridge_sneak_start");
    if (rollD20("sneak") >= 13) {
      writeKey("story.bridge_sneak_success");
      warehouseRitual();
      return;
    }
    writeKey("story.bridge_sneak_fail");
    startCombat(["orc", "goblin", "goblin"], "story.bridge_patrol_defeated", {
      attackersPerRound: 2,
      deathReason: "combat",
      onWin: warehouseRitual
    });
  }

  function warehouseRitual() {
    writeKey("story.warehouse_enter");
    startWarehouseGuardCombat();
  }

  function startWarehouseGuardCombat() {
    startCombat(["orc", "orc", "orc", "orc", "orc", "cultist", "cultist", "cultist", "cultist"], "story.warehouse_cultists_defeated", {
      attackersPerRound: 3,
      deathReason: "warehouse",
      onWin: ritualLeaderRage,
      onRun: warehouseRunCaught
    });
  }

  function warehouseRunCaught() {
    writeKey("story.warehouse_run_caught");
    setChoices([
      choice(t("choice.fight_back"), warehouseFightBack),
      choice(t("choice.watch_ritual"), warehouseWatchRitual)
    ]);
  }

  function warehouseFightBack() {
    writeKey("story.warehouse_fight_back");
    startWarehouseGuardCombat();
  }

  function warehouseWatchRitual() {
    state.player.gameOverReason = "warehouse";
    state.player.health = 0;
    writeKey("story.warehouse_watch_ritual");
    gameOver();
  }

  function ritualLeaderRage() {
    writeKey("story.warehouse_leader_rage");
    startCombat(["ritualLeader"], "story.warehouse_leader_defeated", {
      attackersPerRound: 1,
      deathReason: "warehouse",
      onWin: silverMaskChoice
    });
  }

  function silverMaskChoice() {
    writeKey("story.silver_mask_choice");
    setChoices([
      choice(t("choice.leave_mask"), confirmLeaveMask),
      choice(t("choice.store_mask"), storeSilverMask),
      choice(t("choice.wear_mask"), wearSilverMask)
    ]);
  }

  function confirmLeaveMask() {
    writeKey("story.silver_mask_leave_confirm");
    setChoices([
      choice(t("choice.leave_mask_confirm"), leaveSilverMask),
      choice(t("choice.store_mask"), storeSilverMask),
      choice(t("choice.wear_mask"), wearSilverMask)
    ]);
  }

  function leaveSilverMask() {
    state.player.flags.hasSilverMask = false;
    state.player.flags.wearingSilverMask = false;
    writeKey("story.silver_mask_left");
    warehouseAfterMask();
  }

  function storeSilverMask() {
    state.player.flags.hasSilverMask = true;
    state.player.flags.wearingSilverMask = false;
    addItem("silver mask");
    writeKey("story.silver_mask_stored");
    warehouseAfterMask();
  }

  function wearSilverMask() {
    state.player.flags.hasSilverMask = true;
    state.player.flags.wearingSilverMask = true;
    applySilverMaskPower();
    addItem("silver mask");
    writeKey("story.silver_mask_worn");
    warehouseAfterMask();
  }

  function applySilverMaskPower() {
    state.player.flags.maskCorruption = Math.max(state.player.flags.maskCorruption || 0, 1);
    unlock("mask_on");
    if (!state.player.flags.maskPowerClaimed) {
      state.player.maxHealth += 6;
      state.player.health += 6;
      state.player.upgrades.damage += 3;
      state.player.flags.maskPowerClaimed = true;
    }
  }

  function warehouseAfterMask() {
    writeKey("story.warehouse_ritual_surges");
    setChoices([
      choice(t("choice.leave_warehouse"), warehouseLeave),
      choice(t("choice.stop_ritual"), warehouseStopRitual),
      choice(t("choice.jump_hole"), warehouseJumpHole)
    ]);
  }

  function warehouseLeave() {
    writeKey("story.warehouse_leave");
    setChoices([
      choice(t("choice.stand_ground"), falseHydraInterruption),
      choice(t("choice.run_for_life"), falseHydraInterruption)
    ]);
  }

  function falseHydraInterruption() {
    writeKey("story.false_hydra_interruption");
    if (state.player.flags.wearingSilverMask) {
      writeKey("story.order_mask_warning");
    }
    writeKey("story.order_arrival");
    state.player.flags.orderQuestionsAsked = [];
    showOrderQuestionChoices();
  }

  function showOrderQuestionChoices() {
    const asked = state.player.flags.orderQuestionsAsked || [];
    const questions = [
      ["who", "choice.ask_who_order"],
      ["monster", "choice.ask_monster"],
      ["why", "choice.ask_why_here"]
    ];
    setChoices(
      questions
        .filter(([topic]) => !asked.includes(topic))
        .map(([topic, label]) => choice(t(label), () => orderDialogue(topic)))
    );
  }

  function orderDialogue(topic) {
    writeKey(`story.order_dialogue_${topic}`);
    const asked = state.player.flags.orderQuestionsAsked || [];
    if (!asked.includes(topic)) {
      asked.push(topic);
    }
    state.player.flags.orderQuestionsAsked = asked;
    if (asked.length < 3) {
      showOrderQuestionChoices();
      return;
    }
    writeKey("story.order_departure");
    if (state.player.flags.wearingSilverMask) {
      writeKey("story.order_mask_missed_one");
    }
    bridgeEnd();
  }

  function warehouseStopRitual() {
    writeKey("story.warehouse_stop_ritual");
    bridgeEnd();
  }

  function warehouseJumpHole() {
    writeKey("story.warehouse_jump_hole");
    state.player.gameOverReason = "ritual_hole";
    state.player.health = 0;
    gameOver();
  }

  function bridgeEnd(clear = false) {
    state.player.chapter = "bridgeEnd";
    writeKey("story.bridge_temp_end", {}, clear);
    resolveBridgeEndMask();
    unlock("warehouse_survived");
    recordEnding();
    saveGame();
    showBridgeEndChoices();
  }

  function resolveBridgeEndMask() {
    if (state.player.flags.bridgeEndMaskResolved) {
      return;
    }
    if (state.player.flags.wearingSilverMask) {
      writeKey("story.silver_mask_reworn");
      state.player.flags.bridgeEndMaskResolved = true;
    } else if (!state.player.flags.hasSilverMask) {
      state.player.flags.bridgeEndMaskResolved = true;
    }
  }

  function showBridgeEndChoices() {
    const choices = [];
    if (state.player.flags.hasSilverMask && !state.player.flags.wearingSilverMask) {
      choices.push(choice(t("choice.put_mask_on"), putSilverMaskBackOn));
    }
    if (!state.player.flags.bridgeEndRested) {
      choices.push(choice(t("choice.rest"), restAfterBridge));
    }
    choices.push(
      choice(t("choice.move_orc_camps"), moveToOrcCamps),
      choice(t("choice.current_status"), currentGameStatus),
      choice(ui.submitScore, submitScore),
      choice(ui.leaderboard, showLeaderboard),
      choice(t("choice.main_menu"), showStart),
      choice(t("choice.save"), saveGame)
    );
    setChoices(choices);
  }

  function restAfterBridge() {
    state.player.flags.bridgeEndRested = true;
    state.player.health = state.player.maxHealth;
    writeKey("story.bridge_end_rest");
    showBridgeEndChoices();
  }

  function putSilverMaskBackOn() {
    state.player.flags.wearingSilverMask = true;
    state.player.flags.bridgeEndMaskResolved = true;
    applySilverMaskPower();
    writeKey("story.silver_mask_put_on_after_order");
    showBridgeEndChoices();
  }

  function moveToOrcCamps() {
    continueChapter("orcCamps", true);
  }

  function orcCamps(clear = false) {
    state.player.chapter = "orcCamps";
    writeKey("story.orc_camps_preview", {}, clear);
    recordEnding();
    saveGame();
    setChoices([
      choice(ui.submitScore, submitScore),
      choice(ui.leaderboard, showLeaderboard),
      choice(t("choice.current_status"), currentGameStatus),
      choice(t("choice.main_menu"), showStart),
      choice(t("choice.save"), saveGame)
    ]);
  }

  function complete(clear = false) {
    writeKey("story.complete", {}, clear);
    recordEnding();
    saveGame();
    setChoices([
      choice(ui.submitScore, submitScore),
      choice(ui.leaderboard, showLeaderboard),
      choice(t("choice.current_status"), currentGameStatus),
      choice(t("choice.main_menu"), showStart)
    ]);
  }

  function startCombat(enemyTypes, victoryKey, options = {}) {
    const typeCounts = {};
    const enemies = enemyTypes.map((type, index) => {
      const base = monsterStats[type];
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      const typeTotal = enemyTypes.filter((enemyType) => enemyType === type).length;
      const name = typeTotal > 1 ? `${base.name} ${typeCounts[type]}` : base.name;
      return { ...base, type, id: index + 1, name, hp: base.hp, maxHp: base.hp };
    });
    state.combat = {
      enemies,
      victoryKey,
      attackersPerRound: options.attackersPerRound || 1,
      onWin: options.onWin || null,
      onRun: options.onRun || null,
      deathReason: options.deathReason || "combat",
      guarding: false
    };
    writeKey("ui.initiate_combat");
    showCombatChoices();
  }

  function showCombatChoices() {
    if (!state.combat) {
      return;
    }
    if (state.player.health <= 0) {
      finishCombatDeath();
      return;
    }
    const labels = [
      choice(t("choice.attack"), () => playerAttack(false)),
      choice(t("choice.heavy_attack"), () => playerAttack(true)),
      choice(t("choice.dodge"), dodge),
      choice(t("choice.run"), runCombat)
    ];
    if (state.player.gear.includes("health potion")) {
      labels.push(choice(t("choice.health_potion"), drinkPotion));
    }
    setChoices(labels);
  }

  function playerAttack(heavy) {
    if (!state.combat || finishCombatDeath()) {
      return;
    }
    const stats = combatStats();
    const target = state.combat.enemies.find((enemy) => enemy.hp > 0);
    if (!target) {
      combatVictory();
      return;
    }
    const attacks = heavy ? 1 : stats.attacks;
    const damageDie = heavy ? stats.damageDie + 4 : stats.damageDie;
    const attackBonus = heavy ? stats.attackBonus - 2 : stats.attackBonus;
    for (let i = 1; i <= attacks; i += 1) {
      const currentTarget = state.combat.enemies.find((enemy) => enemy.hp > 0);
      if (!currentTarget) {
        break;
      }
      const natural = d20();
      const total = natural + attackBonus;
      writeKey("story.combat_attack_roll", {
        attack_number: i,
        natural,
        bonus: attackBonus,
        total,
        enemy: currentTarget.name,
        ac: currentTarget.ac
      });
      if (natural === 1) {
        writeKey("story.combat_miss");
      } else if (natural === 20 || total >= currentTarget.ac) {
        const damageRoll = rollDie(damageDie);
        const critDamageRoll = natural === 20 ? rollDie(damageDie) : 0;
        let damage = damageRoll + stats.damageBonus;
        if (natural === 20) {
          damage += critDamageRoll;
        }
        const damageDealt = Math.min(currentTarget.hp, damage);
        currentTarget.hp -= damage;
        writeKey("story.combat_hit", {
          enemy: currentTarget.name,
          damage,
          damage_dealt: damageDealt,
          damage_roll: damageRollText(damageDie, damageRoll, stats.damageBonus, critDamageRoll)
        });
        if (damageDealt > 20) {
          unlock("big_damage");
        }
        if (currentTarget.hp <= 0) {
          writeKey("story.combat_enemy_drops", { enemy: currentTarget.name });
        }
      } else {
        writeKey("story.combat_miss");
      }
    }
    if (state.combat.enemies.every((enemy) => enemy.hp <= 0)) {
      combatVictory();
      return;
    }
    enemyTurn();
    if (!finishCombatDeath()) {
      showCombatChoices();
    }
  }

  function dodge() {
    if (!state.combat || finishCombatDeath()) {
      return;
    }
    state.combat.guarding = true;
    writeKey("story.combat_dodge");
    enemyTurn();
    if (!finishCombatDeath()) {
      showCombatChoices();
    }
  }

  function runCombat() {
    if (!state.combat || finishCombatDeath()) {
      return;
    }
    const roll = rollD20("sneak");
    if (roll >= 12) {
      writeKey("story.combat_run_success");
      const onRun = state.combat.onRun;
      state.combat = null;
      if (onRun) {
        onRun();
      } else {
        goBridge();
      }
    } else {
      writeKey("story.combat_run_fail");
      enemyTurn();
      if (!finishCombatDeath()) {
        showCombatChoices();
      }
    }
  }

  function drinkPotion() {
    if (!state.combat || finishCombatDeath()) {
      return;
    }
    removeItem("health potion");
    const healing = rollDie(4) + rollDie(4) + 6;
    state.player.health = Math.min(state.player.maxHealth, state.player.health + healing);
    writeKey("story.combat_potion", { healing });
    enemyTurn();
    if (!finishCombatDeath()) {
      showCombatChoices();
    }
  }

  function enemyTurn() {
    const playerAc = combatStats().ac + (state.combat.guarding ? 5 : 0);
    const attackers = state.combat.enemies.filter((enemy) => enemy.hp > 0).slice(0, state.combat.attackersPerRound);
    for (const enemy of attackers) {
      const natural = d20(false);
      const total = natural + enemy.attackBonus;
      if (natural === 1) {
        writeKey("story.enemy_miss", { enemy: enemy.name, natural, total, ac: playerAc });
      } else if (natural === 20 || total >= playerAc) {
        const damageRoll = rollDie(enemy.damageDie);
        const critDamageRoll = natural === 20 ? rollDie(enemy.damageDie) : 0;
        let damage = damageRoll + enemy.damageBonus;
        if (natural === 20) {
          damage += critDamageRoll;
        }
        state.player.health = Math.max(0, state.player.health - damage);
        writeKey("story.enemy_hit", {
          enemy: enemy.name,
          natural,
          total,
          ac: playerAc,
          damage,
          damage_roll: damageRollText(enemy.damageDie, damageRoll, enemy.damageBonus, critDamageRoll)
        });
      } else {
        writeKey("story.enemy_miss", { enemy: enemy.name, natural, total, ac: playerAc });
      }
      if (state.player.health <= 0) {
        break;
      }
    }
    state.combat.guarding = false;
    finishCombatDeath();
  }

  function finishCombatDeath() {
    if (!state.combat || state.player.health > 0) {
      return false;
    }
    state.player.gameOverReason = state.combat.deathReason;
    state.combat = null;
    gameOver();
    return true;
  }

  function combatVictory() {
    const combat = state.combat;
    state.combat = null;
    writeKey(combat.victoryKey);
    ensureScoreState();
    state.player.score.fightsWon += 1;
    const xp = combat.enemies.reduce((total, enemy) => total + enemy.xp, 0);
    if (awardXp(xp, "combat", combat.onWin)) {
      return;
    }
    if (combat.onWin) {
      combat.onWin();
    }
  }

  function combatStats() {
    const base = classes[state.player.class];
    return {
      ac: base.ac + state.player.upgrades.ac,
      attackBonus: base.attackBonus,
      damageDie: base.damageDie,
      damageBonus: base.damageBonus + state.player.upgrades.damage,
      attacks: base.attacks
    };
  }

  function checkStatAchievements() {
    if (!state.player || state.player.class === "dm") {
      return;
    }
    if (combatStats().ac > 20) {
      unlock("high_ac");
    }
    if (state.player.level >= 20) {
      unlock("maxed_out");
    }
  }

  function awardDecisionXp(reason) {
    if (state.player && !isPlayerDead()) {
      ensureScoreState();
      state.player.score.decisions += 1;
    }
    awardXp(decisionXp[reason] || 0, reason);
  }

  function awardXp(amount, reason, continuation = null) {
    if (!state.player || state.player.class === "dm" || amount <= 0 || isPlayerDead()) {
      return false;
    }
    state.player.experience += amount;
    writeKey("story.xp_gain", { amount, reason: xpReasons[reason] || reason });
    while (state.player.experience >= state.player.xpToNext) {
      state.player.experience -= state.player.xpToNext;
      state.player.level += 1;
      if (state.player.level >= 20) {
        unlock("maxed_out");
      }
      state.player.xpToNext = BASE_XP_TO_NEXT + Math.max(0, state.player.level - BASE_LEVEL) * XP_PER_LEVEL;
      state.player.maxHealth += 2;
      state.player.health += 2;
      state.pendingLevelContinuation = continuation;
      state.pendingChoices = null;
      showLevelUpChoices();
      return true;
    }
    return false;
  }

  function showLevelUpChoices() {
    if (isPlayerDead()) {
      clearLevelRewardState();
      gameOver();
      return;
    }
    state.awaitingLevelReward = true;
    state.levelRewardChoices = [
      choice(t("choice.level_hp"), () => {
        if (cancelLevelRewardIfDead()) {
          return;
        }
        state.player.maxHealth += 5;
        state.player.health += 5;
        writeKey("story.level_hp");
        continueAfterLevel();
      }),
      choice(t("choice.level_ac"), () => {
        if (cancelLevelRewardIfDead()) {
          return;
        }
        state.player.upgrades.ac += 1;
        checkStatAchievements();
        writeKey("story.level_ac");
        continueAfterLevel();
      }),
      choice(t("choice.level_damage"), () => {
        if (cancelLevelRewardIfDead()) {
          return;
        }
        state.player.upgrades.damage += 1;
        writeKey("story.level_damage");
        continueAfterLevel();
      }),
      choice(t("choice.level_heal"), () => {
        if (cancelLevelRewardIfDead()) {
          return;
        }
        state.player.health = state.player.maxHealth;
        writeKey("story.level_heal");
        continueAfterLevel();
      })
    ];
    render();
  }

  function continueAfterLevel() {
    if (isPlayerDead()) {
      clearLevelRewardState();
      gameOver();
      return;
    }
    const continuation = state.pendingLevelContinuation;
    const pendingChoices = state.pendingChoices;
    state.awaitingLevelReward = false;
    state.levelRewardChoices = [];
    state.pendingLevelContinuation = null;
    state.pendingChoices = null;
    if (continuation) {
      continuation();
    } else if (pendingChoices) {
      state.choices = pendingChoices;
      render();
    } else if (state.combat) {
      showCombatChoices();
    } else {
      render();
    }
  }

  function cancelLevelRewardIfDead() {
    if (!isPlayerDead()) {
      return false;
    }
    clearLevelRewardState();
    gameOver();
    return true;
  }

  function clearLevelRewardState() {
    state.awaitingLevelReward = false;
    state.levelRewardChoices = [];
    state.pendingLevelContinuation = null;
    state.pendingChoices = null;
  }

  function isPlayerDead() {
    return Boolean(state.player && (state.player.health <= 0 || (state.player.flags && state.player.flags.deathRecorded)));
  }

  function rollD20(skill) {
    const natural = d20();
    const bonus = state.player && state.player.bonus === skill ? 2 : 0;
    const result = natural + bonus;
    writeKey("ui.roll", { result });
    return result;
  }

  function d20(track = true) {
    const roll = rollDie(20);
    if (track) {
      if (roll === 20) unlock("lucky");
      if (roll === 1) unlock("unlucky");
    }
    return roll;
  }

  function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function damageRollText(damageDie, damageRoll, damageBonus, critDamageRoll) {
    if (critDamageRoll) {
      return `d${damageDie} roll ${damageRoll} + crit d${damageDie} roll ${critDamageRoll} + ${damageBonus}`;
    }
    return `d${damageDie} roll ${damageRoll} + ${damageBonus}`;
  }

  function addItem(item) {
    if (!state.player.gear.includes(item)) {
      state.player.gear.push(item);
    }
  }

  function removeItem(item) {
    const index = state.player.gear.indexOf(item);
    if (index >= 0) {
      state.player.gear.splice(index, 1);
    }
  }

  function unlock(id) {
    if (!state.stats._achievements[id]) {
      state.stats._achievements[id] = true;
      saveStats();
      writeKey("ui.achievement_unlocked", { name: achievements[id] || id, description: "" });
    }
  }

  function checkPlayedEveryone() {
    const playedAll = Object.keys(classes).every((key) => state.stats[key].runs > 0);
    if (playedAll) {
      unlock("played_everyone");
    }
  }

  function recordEnding() {
    if (state.player && !state.player.flags.completedRecorded) {
      state.stats[state.player.class].reached_end += 1;
      state.player.flags.completedRecorded = true;
      saveStats();
    }
  }

  function gameOver() {
    clearLevelRewardState();
    if (state.player && !state.player.flags.deathRecorded) {
      state.stats[state.player.class].died += 1;
      state.player.flags.deathRecorded = true;
      saveStats();
    }
    state.showGameOverImage = false;
    setChoices([choice(ui.deathScorePrompt, showGameOverScores)]);
  }

  function showGameOverScores() {
    const reason = state.player ? state.player.gameOverReason : "default";
    const achievementsUnlocked = Object.keys(state.stats._achievements).filter((key) => state.stats._achievements[key]).length;
    const scoreDetails = state.player ? scoreBreakdown(achievementsUnlocked) : { total: 0, lines: [] };
    write(`${t("story.game_over_header")}\n\n${t(`game_over.${reason}`)}\n\n${t("story.final_score", { score: scoreDetails.total })}\n\n${t("story.score_breakdown_heading")}\n${scoreDetails.lines.join("\n")}\n\n${t("story.game_over_footer")}`, true);
    state.showGameOverImage = true;
    setChoices([
      choice(ui.submitScore, submitScore),
      choice(ui.leaderboard, showLeaderboard),
      choice(t("choice.new_game"), showCharacterSelect),
      choice(t("choice.main_menu"), showStart)
    ]);
  }

  async function showLeaderboard() {
    write(ui.leaderboardLoading, true);
    setChoices([choice(t("choice.main_menu"), showStart)]);
    try {
      await refreshAccountSession();
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${LEADERBOARD_TABLE}?select=player_name,character_name,score,ending_reached,fights_won,achievements_unlocked,created_at&order=score.desc&limit=25`, {
        headers: supabaseHeaders(true)
      });
      if (!response.ok) {
        throw new Error(`Leaderboard request failed: ${response.status}`);
      }
      const scores = await response.json();
      if (!scores.length) {
        writeLeaderboard([ui.leaderboardEmpty]);
        return;
      }
      const lines = [];
      scores.forEach((score, index) => {
        lines.push(format(ui.leaderboardLine, {
          rank: index + 1,
          name: score.player_name,
          score: score.score,
          character: score.character_name
        }));
      });
      writeLeaderboard(lines);
    } catch {
      writeLeaderboard([ui.leaderboardFailed]);
    }
  }

  function writeLeaderboard(lines) {
    state.storyParts = [
      `<div class="leaderboard-view"><h2>${escapeHtml(ui.leaderboardHeader)}</h2><p class="leaderboard-warning">${escapeHtml(ui.leaderboardWarning)}</p><pre>${escapeHtml(lines.join("\n"))}</pre></div>`
    ];
    state.showGameOverImage = false;
    render();
  }

  async function submitScore() {
    if (!state.player) {
      return;
    }
    ensureScoreState();
    if (state.player.score.submitted) {
      write(ui.scoreSubmitted);
      return;
    }
    const previousName = preferredLeaderboardName();
    const playerName = window.prompt(ui.playerNamePrompt, previousName);
    if (!playerName) {
      return;
    }
    const cleanName = playerName.trim().slice(0, 32);
    if (!cleanName) {
      return;
    }
    localStorage.setItem(`${storagePrefix}leaderboardName`, cleanName);
    const payload = leaderboardPayload(cleanName);
    try {
      await refreshAccountSession();
      let response = await postLeaderboardScore(payload);
      if (!response.ok && payload.user_id) {
        delete payload.user_id;
        response = await postLeaderboardScore(payload, true);
      }
      if (!response.ok) {
        throw new Error(`Score submit failed: ${response.status}`);
      }
      state.player.score.submitted = true;
      saveGame();
      write(`${ui.scoreSubmitted}\n\n${cleanName}: ${payload.score}`);
      setChoices([
        choice(ui.leaderboard, showLeaderboard),
        choice(t("choice.main_menu"), showStart)
      ]);
    } catch {
      write(ui.scoreSubmitFailed);
    }
  }

  function postLeaderboardScore(payload, useAnonToken = false) {
    return fetch(`${SUPABASE_URL}/rest/v1/${LEADERBOARD_TABLE}`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(useAnonToken),
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });
  }

  function leaderboardPayload(playerName) {
    ensureScoreState();
    const achievementsUnlocked = Object.keys(state.stats._achievements || {}).filter((key) => state.stats._achievements[key]).length;
    const payload = {
      player_name: playerName,
      character_name: state.player.name,
      character_class: state.player.title,
      score: calculateScore(achievementsUnlocked),
      ending_reached: Boolean(state.player.flags.completedRecorded),
      fights_won: state.player.score.fightsWon,
      deaths: state.player.flags.deathRecorded ? 1 : 0,
      achievements_unlocked: achievementsUnlocked,
      forest_attempts: state.player.flags.forestAttempts || 0,
      route: scoreRoute(),
      language: lang
    };
    if (isCloudAccount()) {
      payload.user_id = state.account.id;
    }
    return payload;
  }

  function calculateScore(achievementsUnlocked) {
    return scoreBreakdown(achievementsUnlocked).total;
  }

  function scoreBreakdown(achievementsUnlocked) {
    const player = state.player;
    const lines = [];
    let rawScore = 0;
    const addLine = (labelKey, value, vars = {}) => {
      rawScore += value;
      lines.push(`${t(labelKey, vars)}: ${value >= 0 ? "+" : ""}${value}`);
    };
    addLine("score.level", player.level * 100, { level: player.level });
    addLine("score.experience", player.experience);
    addLine("score.fights_won", player.score.fightsWon * 75, { count: player.score.fightsWon });
    addLine("score.decisions", player.score.decisions * 15, { count: player.score.decisions });
    addLine("score.achievements", achievementsUnlocked * 50, { count: achievementsUnlocked });
    if (player.flags.completedRecorded) {
      addLine("score.current_ending", 1000);
    }
    if (player.flags.hasDoll) {
      addLine("score.cracked_doll", 100);
    }
    if (player.flags.hasMagistoneOrb) {
      addLine("score.magistone_orb", 150);
    }
    if (player.flags.hasSilverMask) {
      addLine(player.flags.wearingSilverMask ? "score.wore_silver_mask" : "score.stored_silver_mask", player.flags.wearingSilverMask ? 250 : 125);
    }
    if (player.flags.hasThroneMap) {
      addLine("score.throne_map", 150);
    } else if (player.flags.hasPartialMap) {
      addLine("score.partial_bridge_map", 75);
    }
    if (player.flags.deathRecorded) {
      addLine("score.death_penalty", -200);
    }
    const total = Math.max(0, Math.round(rawScore));
    lines.push(`${t("story.score_raw_total")}: ${Math.round(rawScore)}`);
    if (total !== Math.round(rawScore)) {
      lines.push(`${t("story.score_minimum")}: ${total}`);
    }
    return { total, lines };
  }

  function scoreRoute() {
    if (!state.player) {
      return "unknown";
    }
    const flags = state.player.flags;
    const pieces = [state.player.chapter || "unknown"];
    if (flags.hasThroneMap) {
      pieces.push("full map");
    } else if (flags.hasPartialMap) {
      pieces.push("partial map");
    }
    if (flags.hasMagistoneOrb) {
      pieces.push("magistone orb");
    }
    if (flags.wearingSilverMask) {
      pieces.push("wore silver mask");
    } else if (flags.hasSilverMask) {
      pieces.push("stored silver mask");
    }
    if (flags.girlHelped) {
      pieces.push("ghost ally");
    }
    return pieces.join(" | ");
  }

  function supabaseHeaders(useAnonToken = false) {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${useAnonToken ? SUPABASE_KEY : authToken()}`
    };
  }

  async function authRequest(path, body) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error_description || payload.msg || "Auth request failed");
    }
    return payload;
  }

  async function handleOAuthRedirect() {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!hash) {
      return;
    }
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    if (!accessToken) {
      return;
    }
    try {
      const user = await authUserRequest(accessToken);
      setAuthenticatedAccount({
        access_token: accessToken,
        refresh_token: params.get("refresh_token") || "",
        expires_in: Number(params.get("expires_in") || 0),
        user
      });
      await saveProfile();
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } catch {
      state.oauthLoginFailed = true;
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
  }

  async function authUserRequest(accessToken) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.msg || "User request failed");
    }
    return payload;
  }

  function setAuthenticatedAccount(session, fallbackName = "") {
    const user = session.user || state.account || {};
    const metadataName = user.user_metadata ? user.user_metadata.display_name : "";
    const name = (metadataName || fallbackName || state.account?.name || user.email || ui.guest).trim().slice(0, 32);
    state.account = {
      id: user.id || state.account?.id || "",
      email: user.email || state.account?.email || "",
      name,
      guest: false,
      accessToken: session.access_token || state.account?.accessToken || "",
      refreshToken: session.refresh_token || state.account?.refreshToken || "",
      expiresAt: session.expires_at ? session.expires_at * 1000 : Date.now() + (session.expires_in || 0) * 1000
    };
    localStorage.setItem(`${storagePrefix}account`, JSON.stringify(state.account));
    localStorage.setItem(`${storagePrefix}leaderboardName`, name);
  }

  function authToken() {
    return state.account && state.account.accessToken ? state.account.accessToken : SUPABASE_KEY;
  }

  function isCloudAccount() {
    return Boolean(state.account && !state.account.guest && state.account.accessToken && state.account.id);
  }

  async function refreshAccountSession(force = false) {
    if (!state.account || state.account.guest || !state.account.refreshToken) {
      return false;
    }
    const expiresAt = state.account.expiresAt || 0;
    if (!force && expiresAt && expiresAt - Date.now() > 60000) {
      return true;
    }
    try {
      const session = await authRequest("token?grant_type=refresh_token", {
        refresh_token: state.account.refreshToken
      });
      setAuthenticatedAccount(session, state.account.name);
      return true;
    } catch {
      return false;
    }
  }

  async function saveProfile() {
    if (!isCloudAccount()) {
      return;
    }
    await refreshAccountSession();
    await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?on_conflict=user_id`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        user_id: state.account.id,
        display_name: state.account.name,
        updated_at: new Date().toISOString()
      })
    });
  }

  async function loadCloudData() {
    if (!isCloudAccount()) {
      return;
    }
    try {
      await refreshAccountSession();
      const response = await fetch(`${SUPABASE_URL}/rest/v1/user_game_data?select=stats,saved_game,settings&user_id=eq.${state.account.id}&limit=1`, {
        headers: supabaseHeaders()
      });
      if (!response.ok) {
        return;
      }
      const rows = await response.json();
      if (!rows.length) {
        return;
      }
      if (rows[0].stats) {
        state.stats = rows[0].stats;
        localStorage.setItem(`${storagePrefix}stats`, JSON.stringify(state.stats));
      }
      if (rows[0].saved_game) {
        localStorage.setItem(`${storagePrefix}${lang}.save`, JSON.stringify(rows[0].saved_game));
      }
    } catch {
      // Cloud sync is best-effort so the game stays playable offline.
    }
  }

  async function saveCloudData() {
    if (!isCloudAccount()) {
      return;
    }
    try {
      await refreshAccountSession();
      await fetch(`${SUPABASE_URL}/rest/v1/user_game_data?on_conflict=user_id`, {
        method: "POST",
        headers: {
          ...supabaseHeaders(),
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          user_id: state.account.id,
          stats: state.stats,
          saved_game: state.player,
          settings: { language: lang },
          updated_at: new Date().toISOString()
        })
      });
    } catch {
      // Keep local saves working even if the network is unavailable.
    }
  }

  function loadAccount() {
    try {
      const saved = localStorage.getItem(`${storagePrefix}account`);
      const account = saved ? JSON.parse(saved) : null;
      return account;
    } catch {
      return null;
    }
  }

  function accountStatusText() {
    return state.account ? state.account.name : ui.login;
  }

  function preferredLeaderboardName() {
    if (state.account && !state.account.guest && state.account.name) {
      return state.account.name;
    }
    return localStorage.getItem(`${storagePrefix}leaderboardName`) || state.player.name;
  }

  function ensureScoreState() {
    if (!state.player.score) {
      state.player.score = {
        fightsWon: 0,
        decisions: 0,
        submitted: false,
        startedAt: Date.now()
      };
    }
  }

  function ensurePlayerState() {
    ensureScoreState();
    if (!state.player.flags) {
      state.player.flags = {};
    }
    if (state.player.flags.hasSilverMask === undefined) {
      state.player.flags.hasSilverMask = state.player.gear ? state.player.gear.includes("silver mask") : false;
    }
    if (state.player.flags.wearingSilverMask === undefined) {
      state.player.flags.wearingSilverMask = false;
    }
    if (state.player.flags.maskPowerClaimed === undefined) {
      state.player.flags.maskPowerClaimed = state.player.flags.wearingSilverMask;
    }
    if (state.player.flags.bridgeEndMaskResolved === undefined) {
      state.player.flags.bridgeEndMaskResolved = false;
    }
    if (state.player.flags.maskCorruption === undefined) {
      state.player.flags.maskCorruption = 0;
    }
    if (!Array.isArray(state.player.flags.orderQuestionsAsked)) {
      state.player.flags.orderQuestionsAsked = [];
    }
    if (state.player.flags.bridgeEndRested === undefined) {
      state.player.flags.bridgeEndRested = false;
    }
    if (state.player.flags.bridgeXpAwarded === undefined) {
      state.player.flags.bridgeXpAwarded = false;
    }
    if (!state.player.upgrades) {
      state.player.upgrades = { ac: 0, damage: 0 };
    }
    if (state.player.upgrades.ac === undefined) {
      state.player.upgrades.ac = 0;
    }
    if (state.player.upgrades.damage === undefined) {
      state.player.upgrades.damage = 0;
    }
  }

  function saveGame() {
    if (state.player) {
      localStorage.setItem(`${storagePrefix}${lang}.save`, JSON.stringify(state.player));
      saveCloudData();
      writeKey("ui.game_saved");
    }
  }

  function loadGame() {
    const saved = localStorage.getItem(`${storagePrefix}${lang}.save`);
    if (!saved) {
      writeKey("ui.no_saved_game");
      return;
    }
    try {
      state.player = JSON.parse(saved);
      ensurePlayerState();
      checkStatAchievements();
      writeKey("ui.loaded_game", {}, true);
      continueChapter(state.player.chapter || "caravan");
    } catch {
      writeKey("ui.save_read_error");
    }
  }

  function defaultStats() {
    const stats = { _achievements: {} };
    Object.keys(classes).forEach((key) => {
      stats[key] = {
        name: classes[key].name,
        runs: 0,
        reached_end: 0,
        died: 0,
        forest_attempts: 0
      };
    });
    return stats;
  }

  function saveStats() {
    localStorage.setItem(`${storagePrefix}stats`, JSON.stringify(state.stats));
    saveCloudData();
  }

  function promptText(message, fallback) {
    const value = window.prompt(message, fallback);
    return value ? value.trim() : "";
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(`${storagePrefix}${key}`)) || fallback;
    } catch {
      return fallback;
    }
  }

  function statusText() {
    if (!state.player) {
      return "";
    }
    return `${state.player.name} the ${state.player.title}   Health: ${state.player.health}/${state.player.maxHealth}   Gold: ${state.player.gold}   Supplies: ${state.player.supplies}   Gear: ${state.player.gear.join(", ") || t("ui.none")}`;
  }

  function sheetText() {
    if (!state.player) {
      return ui.noCharacter;
    }
    const stats = combatStats();
    return [
      `${ui.trait.padEnd(18)}${ui.value}`,
      "------------------------------",
      `${ui.name.padEnd(18)}${state.player.name}`,
      `${ui.race.padEnd(18)}${state.player.race}`,
      `${ui.className.padEnd(18)}${state.player.title}`,
      `${ui.level.padEnd(18)}${state.player.class === "dm" ? "DM" : state.player.level}`,
      `${ui.experience.padEnd(18)}${state.player.experience}/${state.player.xpToNext}`,
      `${ui.hp.padEnd(18)}${state.player.health}/${state.player.maxHealth}`,
      `${ui.ac.padEnd(18)}${stats.ac}`,
      `${ui.attackBonus.padEnd(18)}+${stats.attackBonus}`,
      `${ui.damage.padEnd(18)}d${stats.damageDie} + ${stats.damageBonus}`,
      "",
      ui.equipment,
      "------------------------------",
      state.player.gear.join("\n") || t("ui.none"),
      enemyHpText()
    ].join("\n");
  }

  function enemyHpText() {
    if (!state.combat) {
      return "";
    }
    const lines = [
      "",
      ui.enemyHp,
      "------------------------------"
    ];
    const nameWidth = Math.max(...state.combat.enemies.map((enemy) => enemy.name.length)) + 2;
    state.combat.enemies.forEach((enemy) => {
      lines.push(`${enemy.name.padEnd(nameWidth)}${Math.max(0, enemy.hp)}/${enemy.maxHp}`);
    });
    return lines.join("\n");
  }

  function plotText() {
    const lines = [t("ui.stats_heading")];
    Object.keys(classes).forEach((key) => {
      const stats = state.stats[key];
      lines.push(`${stats.name}: Runs ${stats.runs} | Endings ${stats.reached_end} | Deaths ${stats.died} | Forest attempts ${stats.forest_attempts}`);
    });
    lines.push("", ...achievementLines());
    return lines.join("\n");
  }

  function achievementsText() {
    return achievementLines().join("\n");
  }

  function achievementLines() {
    const lines = [t("ui.achievements_heading")];
    const unlocked = Object.keys(achievements).filter((key) => state.stats._achievements[key]);
    lines.push(t("ui.achievements_progress", { unlocked: unlocked.length, total: Object.keys(achievements).length }));
    if (!unlocked.length) {
      lines.push(t("ui.no_achievements"));
    } else {
      unlocked.forEach((id) => lines.push(achievements[id]));
    }
    return lines;
  }

  function choice(label, action, options = {}) {
    return { label, action, ...options };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}());
