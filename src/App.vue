<script setup>
import { ref, reactive, computed, onMounted } from "vue";

// --- 1. قاعدة البيانات (تم نقلها هنا) ---
import { categoriesDB } from "./data.js"; 
// --- 2. إعدادات الصوت والتهيئة ---
onMounted(() => {
  sounds.bgm.play().catch(() => {
    console.log("Autoplay blocked - waiting for interaction");
    const playOnFirstClick = () => {
      sounds.bgm.play();
      document.removeEventListener('click', playOnFirstClick);
    };
    document.addEventListener('click', playOnFirstClick);
  });
});

const sounds = {
  bgm: new Audio(getPath("sounds/bg-music.mp3")),
  correct: new Audio(getPath("sounds/correct.mp3")),
  skip: new Audio(getPath("sounds/skip.mp3")),
  timeout: new Audio(getPath("sounds/timeout.mp3")),
};

sounds.bgm.loop = true;
sounds.bgm.volume = 0.3;

const isMuted = ref(false);

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (isMuted.value) sounds.bgm.pause();
  else if (currentScreen.value === "home") sounds.bgm.play().catch(() => {});
};

const playEffect = (type) => {
  if (isMuted.value) return;
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(() => {});
  }
};

// --- 3. حالة اللعبة ---
const currentScreen = ref("home");
const teams = ref([]);

const settings = reactive({
  teamsCount: 2,
  timeLimit: 60,
  winScore: 10,
  customNames: ["", "", "", ""],
  // تم تغيير القيمة الافتراضية لتناسب أول تصنيف في البيانات الجديدة
  selectedCategories: ["colors_shapes"], 
});

const gameState = reactive({
  currentTeamIndex: 0,
  currentWord: "",
  timer: 0,
  isPlaying: false,
  isPaused: false,
  timerInterval: null,
  activeWordsPool: [],
});

// --- الدوال ---

const enterHome = () => {
  if (!isMuted.value) sounds.bgm.play().catch(() => {});
};

const goToSetup = () => {
  playEffect("correct");
  currentScreen.value = "setup";
};

const startGame = () => {
  sounds.bgm.pause();
  sounds.bgm.currentTime = 0;

  // تجميع الكلمات بناءً على البيانات المحلية الجديدة
  let pool = [];
  categoriesDB.forEach((cat) => {
    if (settings.selectedCategories.includes(cat.id)) {
      pool = [...pool, ...cat.words];
    }
  });

  if (pool.length === 0) {
    alert("الرجاء اختيار تصنيف واحد على الأقل!");
    return;
  }

  gameState.activeWordsPool = pool.sort(() => Math.random() - 0.5);

  teams.value = [];
  for (let i = 0; i < settings.teamsCount; i++) {
    const name = settings.customNames[i].trim() || `الفريق ${i + 1}`;
    teams.value.push({ id: i, name: name, score: 0 });
  }

  gameState.currentTeamIndex = 0;
  startRound();
};

const startRound = () => {
  currentScreen.value = "round-start";
  gameState.timer = settings.timeLimit;
  gameState.isPaused = false;
};

const playNow = () => {
  currentScreen.value = "game";
  gameState.isPlaying = true;
  gameState.isPaused = false;
  nextWord();

  if (gameState.timerInterval) clearInterval(gameState.timerInterval);

  gameState.timerInterval = setInterval(() => {
    if (!gameState.isPaused) {
      gameState.timer--;
      if (gameState.timer <= 0) endTurn();
    }
  }, 1000);
};

const togglePause = () => {
  gameState.isPaused = !gameState.isPaused;
};

const nextWord = () => {
  if (gameState.activeWordsPool.length === 0) {
    gameState.currentWord = "انتهت جميع الكلمات!";
    gameState.isPlaying = false;
    clearInterval(gameState.timerInterval);
    playEffect("timeout");
    return;
  }
  gameState.currentWord = gameState.activeWordsPool.pop();
};

const handleAnswer = (isCorrect) => {
  if (gameState.isPaused) return;

  if (isCorrect) {
    playEffect("correct");
    teams.value[gameState.currentTeamIndex].score++;
    if (teams.value[gameState.currentTeamIndex].score >= settings.winScore) {
      endGame();
      return;
    }
  } else {
    playEffect("skip");
  }
  nextWord();
};

const endTurn = () => {
  playEffect("timeout");
  clearInterval(gameState.timerInterval);
  gameState.isPlaying = false;
  gameState.currentTeamIndex =
    (gameState.currentTeamIndex + 1) % teams.value.length;
  startRound();
};

const endGame = () => {
  clearInterval(gameState.timerInterval);
  currentScreen.value = "winner";
  if (!isMuted.value) sounds.bgm.play().catch(() => {});
};

const resetGame = () => {
  currentScreen.value = "home";
  enterHome();
  teams.value = [];
  settings.customNames = ["", "", "", ""];
};

const toggleCategory = (catId) => {
  const index = settings.selectedCategories.indexOf(catId);
  if (index === -1) settings.selectedCategories.push(catId);
  else if (settings.selectedCategories.length > 1)
    settings.selectedCategories.splice(index, 1);
};

// Computed
const currentTeamName = computed(() =>
  teams.value.length ? teams.value[gameState.currentTeamIndex].name : ""
);
const winnerTeam = computed(
  () => teams.value.sort((a, b) => b.score - a.score)[0]
);
</script>

<template>
  <div class="app-container">
    <Transition name="fade" mode="out-in">
      <div v-if="currentScreen === 'home'" class="game-card" key="home">
        <div style="position: absolute; top: 15px; left: 15px">
          <button class="icon-btn" @click="toggleMute">
            {{ isMuted ? "🔇" : "🔊" }}
          </button>
        </div>

        <div style="font-size: 4rem; margin-bottom: 10px">🎭</div>
        <h1>ولا كلمة</h1>
        <p>تحدى أصحابك، اختبر تمثيلك!</p>
        <button
          @click="
            () => {
              enterHome();
              goToSetup();
            }
          "
          class="btn btn-primary"
        >
          🎮 ابدأ اللعب
        </button>
      </div>

      <div v-else-if="currentScreen === 'setup'" class="game-card" key="setup">
        <h2>إعداد المباراة</h2>

        <label>عدد الفرق</label>
        <div class="team-selector">
          <div
            v-for="num in [2, 3, 4]"
            :key="num"
            class="team-option"
            :class="{ selected: settings.teamsCount === num }"
            @click="settings.teamsCount = num"
          >
            {{ num }} فرق
          </div>
        </div>

        <div class="input-group" v-for="n in settings.teamsCount" :key="n">
          <input
            type="text"
            v-model="settings.customNames[n - 1]"
            :placeholder="`اسم الفريق ${n}`"
          />
        </div>

        <label style="margin-top: 20px">مواضيع الكلمات</label>
        <div class="categories-grid">
          <div
            v-for="cat in categoriesDB"
            :key="cat.id"
            class="category-card"
            :class="{ selected: settings.selectedCategories.includes(cat.id) }"
            @click="toggleCategory(cat.id)"
          >
            <span>{{ cat.icon }}</span>
            <p>{{ cat.label }}</p>
          </div>
        </div>

        <div
          class="input-group"
          style="display: flex; gap: 10px; margin-top: 15px"
        >
          <div style="flex: 1">
            <label>الثواني</label>
            <input type="number" v-model="settings.timeLimit" />
          </div>
          <div style="flex: 1">
            <label>النقاط للفوز</label>
            <input type="number" v-model="settings.winScore" />
          </div>
        </div>

        <button @click="startGame" class="btn btn-primary">انطلق 🔥</button>
      </div>

      <div
        v-else-if="currentScreen === 'round-start'"
        class="game-card"
        key="round-start"
      >
        <p>الدور الآن على</p>
        <h1 style="color: var(--primary)">{{ currentTeamName }}</h1>

        <div style="margin: 30px 0; text-align: right">
          <label style="margin-bottom: 10px">النتيجة:</label>
          <div
            v-for="(team, index) in teams"
            :key="team.id"
            class="score-badge"
            :class="{ active: index === gameState.currentTeamIndex }"
          >
            <span>{{ team.name }}</span>
            <span style="font-weight: bold; color: var(--accent)">{{
              team.score
            }}</span>
          </div>
        </div>
        <button @click="playNow" class="btn btn-primary">
          جاهزين؟ ابدأ الوقت ⏱️
        </button>
      </div>

      <div v-else-if="currentScreen === 'game'" class="game-card" key="game">
        <div class="top-controls">
          <button
            class="icon-btn"
            @click="togglePause"
            :class="{ active: gameState.isPaused }"
          >
            {{ gameState.isPaused ? "▶️" : "⏸️" }}
          </button>
          <div class="timer-box" :class="{ 'low-time': gameState.timer < 10 }">
            {{ gameState.timer }}
          </div>
          <div style="width: 40px"></div>
        </div>

        <div class="word-display" :key="gameState.currentWord">
          {{ gameState.currentWord }}
        </div>

        <div style="margin-top: 40px">
          <button
            @click="handleAnswer(true)"
            class="btn btn-success"
            :disabled="gameState.isPaused"
          >
            ✅ عرفوها!
          </button>
          <button
            @click="handleAnswer(false)"
            class="btn btn-danger"
            :disabled="gameState.isPaused"
          >
            ⏭️ تخطي
          </button>
        </div>

        <div v-if="gameState.isPaused" class="paused-overlay">
          <h2 style="font-size: 3rem; margin: 0">⏸️</h2>
          <h2>اللعبة متوقفة</h2>
          <button
            @click="togglePause"
            class="btn btn-primary"
            style="width: auto; padding: 10px 40px; margin-top: 20px"
          >
            استئناف
          </button>
        </div>
      </div>

      <div
        v-else-if="currentScreen === 'winner'"
        class="game-card"
        key="winner"
      >
        <div style="font-size: 5rem; margin-bottom: 10px">🏆</div>
        <h1>مبروووك!</h1>
        <h2 style="color: var(--accent); font-size: 2rem">
          {{ winnerTeam.name }}
        </h2>
        <button @click="resetGame" class="btn btn-primary">
          لعبة جديدة 🔄
        </button>
      </div>
    </Transition>
  </div>
</template>