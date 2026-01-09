<script setup>
import { ref, reactive, computed } from "vue";
import { categoriesDB } from "./data.js";
import confetti from "canvas-confetti";

// --- 1. إعدادات الصوت ---
const sounds = {
  correct: new Audio("sounds/correct.mp3"),
  skip: new Audio("sounds/skip.mp3"),
  timeout: new Audio("sounds/timeout.mp3"),
  tick: new Audio("sounds/tick.mp3"),
};

const isMuted = ref(false);

const playEffect = (type) => {
  if (isMuted.value) return;
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(() => {});
  }
};

const endEffect = (type) => {
  if (isMuted.value) return;
  if (type === "tick" && sounds["tick"]) {
    sounds["tick"].pause();
    sounds["tick"].currentTime = 0;
  }
};
// --- إعدادات عرض المزيد ---
const visibleCount = ref(10); 

const visibleCategories = computed(() => {
  return categoriesDB.slice(0, visibleCount.value);
});

const showMore = () => {
  visibleCount.value += 10;
};

// --- 2. حالة اللعبة ---
const currentScreen = ref("home"); 
const teams = ref([]);

// متغيرات العد التنازلي (جديد)
const showCountdown = ref(false);
const countdownValue = ref(3);

const settings = reactive({
  teamsCount: 2,
  gameMode: "levels", 
  timeLimit: 60, 
  winScore: 30, 
  maxSkips: 3, 
  customNames: ["", "", "", ""],
  selectedCategories: ["colors_shapes"],
});

const gameState = reactive({
  currentTeamIndex: 0,
  currentRoundNumber: 1, 
  currentWordObj: { word: "", hint: "" }, 
  timer: 0,
  isPlaying: false,
  isPaused: false,
  timerInterval: null,
  skipsUsedInTurn: 0, 
  freshWordsPool: [], 
  skippedWordsPool: [], 
});

// --- دوال التنقل ---
const showTutorial = () => {
  currentScreen.value = "tutorial";
};

const goToSetup = () => {
  currentScreen.value = "setup";
};

const startGame = () => {
  let pool = [];
  categoriesDB.forEach((cat) => {
    if (settings.selectedCategories.includes(cat.id)) {
      pool = [...pool, ...JSON.parse(JSON.stringify(cat.words))];
    }
  });

  if (pool.length === 0) {
    alert("الرجاء اختيار تصنيف واحد على الأقل!");
    return;
  }

  gameState.freshWordsPool = pool.sort(() => Math.random() - 0.5);
  gameState.skippedWordsPool = [];

  teams.value = [];
  for (let i = 0; i < settings.teamsCount; i++) {
    const name = settings.customNames[i].trim() || `الفريق ${i + 1}`;
    teams.value.push({ id: i, name: name, score: 0 });
  }

  gameState.currentTeamIndex = 0;
  gameState.currentRoundNumber = 1; 
  startRoundIntro();
};

const startRoundIntro = () => {
  currentScreen.value = "round-start";
  
  if (settings.gameMode === 'levels') {
    if (gameState.currentRoundNumber === 3) gameState.timer = 30;
    else gameState.timer = 60;
  } else {
    gameState.timer = settings.timeLimit;
  }
  
  gameState.isPaused = false;
  gameState.skipsUsedInTurn = 0;
};

// --- التعديل الرئيسي: بدء العد التنازلي قبل اللعب ---
const playNow = () => {
  currentScreen.value = "game";
  showCountdown.value = true;
  countdownValue.value = 3;
  gameState.isPaused = true; // إيقاف مؤقت حتى ينتهي العد
  gameState.isPlaying = false; // لم يبدأ اللعب بعد

  const countInterval = setInterval(() => {
    countdownValue.value--;
    if (countdownValue.value > 0) {
    }
    
    if (countdownValue.value <= 0) {
      clearInterval(countInterval);
      showCountdown.value = false;
      startActualGame(); // بدء اللعبة فعلياً
    }
  }, 1000);
};

// دالة جديدة لبدء العداد ومنطق اللعب بعد انتهاء العد التنازلي
const startActualGame = () => {
  gameState.isPlaying = true;
  gameState.isPaused = false;
  nextWord(); 

  if (gameState.timerInterval) clearInterval(gameState.timerInterval);

  gameState.timerInterval = setInterval(() => {
    if (!gameState.isPaused) {
      gameState.timer--;

      if (gameState.timer <= 8 && gameState.timer > 0) {
         playEffect("tick");
      }

      if (gameState.timer <= 0) endTurn();
    }
  }, 1000);
};

const togglePause = () => {
  gameState.isPaused = !gameState.isPaused;
};

// --- منطق الكلمات ---
const nextWord = () => {
  if (gameState.freshWordsPool.length > 0) {
    gameState.currentWordObj = gameState.freshWordsPool.pop();
  } 
  else if (gameState.skippedWordsPool.length > 0) {
    gameState.freshWordsPool = gameState.skippedWordsPool.sort(() => Math.random() - 0.5);
    gameState.skippedWordsPool = []; 
    gameState.currentWordObj = gameState.freshWordsPool.pop();
  } 
  else {
    gameState.currentWordObj = { word: "انتهت الكلمات!", hint: "" };
    gameState.isPlaying = false;
    clearInterval(gameState.timerInterval);
    playEffect("timeout");
  }
};

const handleAnswer = (isCorrect) => {
  if (gameState.isPaused || !gameState.isPlaying) return;

  if (isCorrect) {
    playEffect("correct");
    teams.value[gameState.currentTeamIndex].score++;
    
    if (settings.gameMode === 'score' && teams.value[gameState.currentTeamIndex].score >= settings.winScore) {
      endGame();
      return;
    }
  } else {
    if (gameState.skipsUsedInTurn >= settings.maxSkips) return; 
    
    playEffect("skip");
    gameState.skipsUsedInTurn++;
    gameState.skippedWordsPool.push(gameState.currentWordObj);
  }
  
  nextWord();
};

const endTurn = () => {
  playEffect("timeout");
  endEffect("tick");
  clearInterval(gameState.timerInterval);
  gameState.isPlaying = false;

  gameState.currentTeamIndex = (gameState.currentTeamIndex + 1) % teams.value.length;

  if (gameState.currentTeamIndex === 0) {
    if (settings.gameMode === 'levels') {
      gameState.currentRoundNumber++;
      if (gameState.currentRoundNumber > 3) {
        endGame();
        return;
      }
    }
  }

  startRoundIntro();
};

const endGame = () => {
  clearInterval(gameState.timerInterval);
  currentScreen.value = "winner";
  playEffect("correct"); 
  launchConfetti(); // تشغيل الاحتفال (جديد)
};

const resetGame = () => {
  currentScreen.value = "home";
  teams.value = [];
  settings.customNames = ["", "", "", ""];
};

// دالة إطلاق الاحتفال (جديد)
const launchConfetti = () => {
  var duration = 3 * 1000;
  var animationEnd = Date.now() + duration;
  var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  var interval = setInterval(function() {
    var timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    var particleCount = 50 * (timeLeft / duration);
    confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } }));
  }, 250);
};

const toggleCategory = (catId) => {
  const index = settings.selectedCategories.indexOf(catId);
  if (index === -1) settings.selectedCategories.push(catId);
  else if (settings.selectedCategories.length > 1)
    settings.selectedCategories.splice(index, 1);
};

// Computed Properties
const currentTeamName = computed(() => teams.value.length ? teams.value[gameState.currentTeamIndex].name : "");
const winnerTeam = computed(() => teams.value.sort((a, b) => b.score - a.score)[0]);

const isHintAllowed = computed(() => {
  if (settings.gameMode === 'levels' && gameState.currentRoundNumber === 1) return true;
  return false;
});

const levelDescription = computed(() => {
  if (settings.gameMode !== 'levels') return '';
  if (gameState.currentRoundNumber === 1) return '🔥 الجولة 1: 60 ثانية + تلميحات';
  if (gameState.currentRoundNumber === 2) return '😨 الجولة 2: 60 ثانية (بدون تلميح)';
  if (gameState.currentRoundNumber === 3) return '🚀 الجولة 3: 30 ثانية (سرعة قصوى)';
  return '';
});

</script>

<template>
  <div class="app-container">
    <Transition name="fade" mode="out-in">
      
      <div v-if="currentScreen === 'home'" class="game-card home-card" key="home">
         <div class="sound-toggle">
          <button class="icon-btn" @click="isMuted = !isMuted">
            {{ isMuted ? "🔇" : "🔊" }}
          </button>
        </div>

        <div class="logo-area">🎭</div>
        <h1 class="main-title">ولا كلمة</h1>
        <p class="subtitle">تحدى أصحابك، اختبر تمثيلك!</p>
        
        <div class="home-buttons">
          <button @click="goToSetup" class="btn btn-primary">🎮 ابدأ اللعب</button>
          <button @click="showTutorial" class="btn btn-outline">💡 كيف نلعب؟</button>
        </div>
      </div>

      <div v-else-if="currentScreen === 'tutorial'" class="game-card" key="tutorial">
        <h2>كيف نلعب؟ 🤔</h2>
        <div class="tutorial-steps">
          <div class="step">
            <span>1️⃣</span>
            <p>قسموا حالكم فرقين أو أكثر.</p>
          </div>
          <div class="step">
            <span>2️⃣</span>
            <p>واحد من الفريق يمثل الكلمة بدون كلام!</p>
          </div>
          <div class="step">
            <span>3️⃣</span>
            <p><strong>نمط المستويات:</strong> 3 جولات بصعوبة متزايدة (مع تلميح، بدون تلميح، سرعة).</p>
          </div>
           <div class="step">
            <span>4️⃣</span>
            <p>الكلمة اللي تعرفوها ما رح تتكرر، واللي تطوفوها ترجع في النهاية.</p>
          </div>
        </div>
        <button @click="currentScreen = 'home'" class="btn btn-primary">فهمت، رجعني للقائمة</button>
      </div>

      <div v-else-if="currentScreen === 'setup'" class="game-card" key="setup">
        <h2>إعداد المباراة ⚙️</h2>

        <label>نمط اللعبة</label>
        <div class="mode-selector">
          <div class="mode-option" :class="{ selected: settings.gameMode === 'levels' }" @click="settings.gameMode = 'levels'">
            🏆 مستويات (3 جولات)
          </div>
          <div class="mode-option" :class="{ selected: settings.gameMode === 'score' }" @click="settings.gameMode = 'score'">
            🎯 نقاط محددة
          </div>
        </div>

        <label>عدد الفرق</label>
        <div class="team-selector">
          <div v-for="num in [2, 3, 4]" :key="num" class="team-option"
            :class="{ selected: settings.teamsCount === num }" @click="settings.teamsCount = num">
            {{ num }}
          </div>
        </div>

        <div class="names-grid">
           <div class="input-group" v-for="n in settings.teamsCount" :key="n">
            <input type="text" v-model="settings.customNames[n - 1]" :placeholder="`اسم الفريق ${n}`" />
          </div>
        </div>

        <label style="margin-top: 15px">التصنيفات ({{ settings.selectedCategories.length }})</label>
        
        <div class="categories-grid">
          <div
            v-for="cat in visibleCategories"
            :key="cat.id"
            class="category-card"
            :class="{ selected: settings.selectedCategories.includes(cat.id) }"
            @click="toggleCategory(cat.id)"
          >
            <span>{{ cat.icon }}</span>
            <p>{{ cat.label }}</p>
          </div>
        </div>

        <div v-if="visibleCount < categoriesDB.length" style="text-align: center; margin-top: 10px;">
          <button @click="showMore" class="btn-show-more">
            عرض المزيد 🔽
          </button>
        </div>

        <div class="settings-row">
           <div class="setting-item">
            <label>تخطي مسموح</label>
            <input type="number" v-model="settings.maxSkips" min="0" max="10" />
          </div>
          
          <div v-if="settings.gameMode === 'score'" class="setting-item">
            <label>نقاط الفوز</label>
            <input type="number" v-model="settings.winScore" />
          </div>
           <div v-if="settings.gameMode === 'score'" class="setting-item">
            <label>الوقت (ثواني)</label>
            <input type="number" v-model="settings.timeLimit" />
          </div>
        </div>

        <button @click="startGame" class="btn btn-primary" style="margin-top: 20px">انطلق 🔥</button>
      </div>

      <div v-else-if="currentScreen === 'round-start'" class="game-card" key="round-start">
        <p>الدور الآن على</p>
        <h1 class="active-team-name">{{ currentTeamName }}</h1>

        <div v-if="settings.gameMode === 'levels'" class="level-badge">
          {{ levelDescription }}
        </div>

        <div class="score-board">
          <div v-for="(team, index) in teams" :key="team.id" class="score-badge"
            :class="{ active: index === gameState.currentTeamIndex }">
            <span>{{ team.name }}</span>
            <span class="score-num">{{ team.score }}</span>
          </div>
        </div>
        <button @click="playNow" class="btn btn-primary">جاهزين؟ ابدأ الوقت ⏱️</button>
      </div>

      <div v-else-if="currentScreen === 'game'" class="game-card game-play-card" key="game">
        
        <div v-if="showCountdown" class="countdown-overlay">
           <div class="countdown-number">{{ countdownValue }}</div>
        </div>

        <div class="top-controls">
          <button class="icon-btn" @click="togglePause" :class="{ active: gameState.isPaused }">
            {{ gameState.isPaused ? "▶️" : "⏸️" }}
          </button>
          
          <div class="timer-container">
            <svg class="timer-svg" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="timer-bg"></circle>
              <circle cx="50" cy="50" r="45" class="timer-progress"
                :stroke-dasharray="283"
                :stroke-dashoffset="283 - (283 * gameState.timer) / (settings.gameMode === 'levels' ? (gameState.currentRoundNumber === 3 ? 30 : 60) : settings.timeLimit)"
                :class="{ 'urgent': gameState.timer <= 10 }">
              </circle>
            </svg>
            <div class="timer-text">{{ gameState.timer }}</div>
          </div>
          
          <div class="skips-counter">
             <span class="skip-label">تخطي:</span>
             <span class="skip-val">{{ settings.maxSkips - gameState.skipsUsedInTurn }}</span>
          </div>
        </div>

        <div class="word-container">
           <div class="word-display">{{ gameState.currentWordObj.word }}</div>
           
           <div v-if="isHintAllowed && gameState.currentWordObj.hint" class="hint-box">
             💡 تلميح: {{ gameState.currentWordObj.hint }}
           </div>
        </div>

        <div class="actions-area">
          <button @click="handleAnswer(true)" class="btn btn-success" :disabled="gameState.isPaused || showCountdown">
            ✅ عرفوها!
          </button>
          
          <button @click="handleAnswer(false)" class="btn btn-danger" 
            :disabled="gameState.isPaused || showCountdown || gameState.skipsUsedInTurn >= settings.maxSkips">
            ⏭️ تخطي
          </button>
        </div>

        <div v-if="gameState.isPaused && !showCountdown" class="paused-overlay">
          <h2>⏸️ استراحة</h2>
          <button @click="togglePause" class="btn btn-primary">استئناف</button>
        </div>
      </div>

      <div v-else-if="currentScreen === 'winner'" class="game-card" key="winner">
        <div style="font-size: 5rem; margin-bottom: 10px">🏆</div>
        <h1>مبروووك!</h1>
        <h2 class="winner-name">{{ winnerTeam.name }}</h2>
        <p>مجموع النقاط: {{ winnerTeam.score }}</p>
        
        <div class="final-scores">
           <div v-for="team in teams" :key="team.id" class="mini-score">
             <span>{{ team.name }}</span>: {{ team.score }}
           </div>
        </div>

        <button @click="resetGame" class="btn btn-primary">لعبة جديدة 🔄</button>
      </div>

    </Transition>
  </div>
</template>