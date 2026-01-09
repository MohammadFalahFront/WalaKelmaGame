<script setup>
import { ref, reactive, computed } from "vue";
import { categoriesDB } from "./data.js";

// --- 1. إعدادات الصوت (تم إلغاء الموسيقى الخلفية) ---
const sounds = {
  correct: new Audio("sounds/correct.mp3"),
  skip: new Audio("sounds/skip.mp3"),
  timeout: new Audio("sounds/timeout.mp3"),
};

const isMuted = ref(false); 

const playEffect = (type) => {
  if (isMuted.value) return;
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(() => {});
  }
};

// ... المتغيرات السابقة موجودة هنا

// --- إعدادات عرض المزيد ---
const visibleCount = ref(10); // نبدأ بعرض 10 فقط

// مصفوفة محسوبة ترجع فقط العدد المطلوب من التصنيفات
const visibleCategories = computed(() => {
  return categoriesDB.slice(0, visibleCount.value);
});

// دالة لزيادة العدد عند الضغط على الزر
const showMore = () => {
  visibleCount.value += 10; // عرض 10 إضافية في كل مرة
};

// --- 2. حالة اللعبة ---
const currentScreen = ref("home"); // home, tutorial, setup, round-start, game, winner
const teams = ref([]);

const settings = reactive({
  teamsCount: 2,
  gameMode: "levels", // 'score' or 'levels'
  timeLimit: 60, // للنمط الكلاسيكي فقط
  winScore: 30, // للنمط الكلاسيكي فقط
  maxSkips: 3, // عدد مرات التخطي المسموحة
  customNames: ["", "", "", ""],
  selectedCategories: ["colors_shapes"],
});

const gameState = reactive({
  currentTeamIndex: 0,
  currentRoundNumber: 1, // رقم الجولة الحالية (لنمط المستويات)
  currentWordObj: { word: "", hint: "" }, // تم تغييرها لكائن
  timer: 0,
  isPlaying: false,
  isPaused: false,
  timerInterval: null,
  skipsUsedInTurn: 0, // عدد التخطي المستخدم في الدور الحالي
  freshWordsPool: [], // كلمات لم تظهر بعد
  skippedWordsPool: [], // كلمات تم تخطيها (تنتظر إعادة التدوير)
});

// --- دوال التنقل ---
const showTutorial = () => {
  currentScreen.value = "tutorial";
};

const goToSetup = () => {
  currentScreen.value = "setup";
};

const startGame = () => {
  // تجميع الكلمات
  let pool = [];
  categoriesDB.forEach((cat) => {
    if (settings.selectedCategories.includes(cat.id)) {
      // نسخ عميق لتجنب تعديل البيانات الأصلية
      pool = [...pool, ...JSON.parse(JSON.stringify(cat.words))];
    }
  });

  if (pool.length === 0) {
    alert("الرجاء اختيار تصنيف واحد على الأقل!");
    return;
  }

  // خلط الكلمات
  gameState.freshWordsPool = pool.sort(() => Math.random() - 0.5);
  gameState.skippedWordsPool = [];

  // إعداد الفرق
  teams.value = [];
  for (let i = 0; i < settings.teamsCount; i++) {
    const name = settings.customNames[i].trim() || `الفريق ${i + 1}`;
    teams.value.push({ id: i, name: name, score: 0 });
  }

  gameState.currentTeamIndex = 0;
  gameState.currentRoundNumber = 1; // البداية دائماً من الجولة 1
  startRoundIntro();
};

const startRoundIntro = () => {
  currentScreen.value = "round-start";
  
  // تحديد الوقت بناءً على النمط والمستوى
  if (settings.gameMode === 'levels') {
    if (gameState.currentRoundNumber === 3) gameState.timer = 30;
    else gameState.timer = 60;
  } else {
    gameState.timer = settings.timeLimit;
  }
  
  gameState.isPaused = false;
  gameState.skipsUsedInTurn = 0;
};

const playNow = () => {
  currentScreen.value = "game";
  gameState.isPlaying = true;
  gameState.isPaused = false;
  nextWord(); // جلب أول كلمة

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

// --- منطق الكلمات الجديد ---
const nextWord = () => {
  // الأولوية للكلمات الجديدة
  if (gameState.freshWordsPool.length > 0) {
    gameState.currentWordObj = gameState.freshWordsPool.pop();
  } 
  // إذا نفدت الجديدة، نستخدم التي تم تخطيها (بعد خلطها)
  else if (gameState.skippedWordsPool.length > 0) {
    gameState.freshWordsPool = gameState.skippedWordsPool.sort(() => Math.random() - 0.5);
    gameState.skippedWordsPool = []; // تفريغ صندوق التخطي
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
  if (gameState.isPaused) return;

  if (isCorrect) {
    playEffect("correct");
    teams.value[gameState.currentTeamIndex].score++;
    
    // شرط الفوز بالنقاط (للنمط الكلاسيكي فقط)
    if (settings.gameMode === 'score' && teams.value[gameState.currentTeamIndex].score >= settings.winScore) {
      endGame();
      return;
    }
    // ملاحظة: الكلمة الصحيحة لا تعود لأي مصفوفة (تختفي)
  } else {
    // حالة التخطي
    if (gameState.skipsUsedInTurn >= settings.maxSkips) return; // حماية إضافية
    
    playEffect("skip");
    gameState.skipsUsedInTurn++;
    // الكلمة التي تم تخطيها تذهب لصندوق التخطي
    gameState.skippedWordsPool.push(gameState.currentWordObj);
  }
  
  nextWord();
};

const endTurn = () => {
  playEffect("timeout");
  clearInterval(gameState.timerInterval);
  gameState.isPlaying = false;

  // الانتقال للفريق التالي
  gameState.currentTeamIndex = (gameState.currentTeamIndex + 1) % teams.value.length;

  // إذا عادت الدورة للفريق الأول
  if (gameState.currentTeamIndex === 0) {
    if (settings.gameMode === 'levels') {
      gameState.currentRoundNumber++;
      // إذا انتهت الجولة الثالثة
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
  playEffect("correct"); // صوت احتفالي بسيط
};

const resetGame = () => {
  currentScreen.value = "home";
  teams.value = [];
  settings.customNames = ["", "", "", ""];
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

// هل التلميح مسموح؟ (فقط في المستوى 1 من نمط المستويات)
const isHintAllowed = computed(() => {
  if (settings.gameMode === 'levels' && gameState.currentRoundNumber === 1) return true;
  return false;
});

// نصوص شرح المستوى
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

        <label style="margin-top: 15px">التصنيفات</label>
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
        <div class="top-controls">
          <button class="icon-btn" @click="togglePause" :class="{ active: gameState.isPaused }">
            {{ gameState.isPaused ? "▶️" : "⏸️" }}
          </button>
          
          <div class="timer-box" :class="{ 'low-time': gameState.timer < 10, 'fast-mode': gameState.timer < 30 && settings.gameMode === 'levels' && gameState.currentRoundNumber === 3 }">
            {{ gameState.timer }}
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
          <button @click="handleAnswer(true)" class="btn btn-success" :disabled="gameState.isPaused">
            ✅ عرفوها!
          </button>
          
          <button @click="handleAnswer(false)" class="btn btn-danger" 
            :disabled="gameState.isPaused || gameState.skipsUsedInTurn >= settings.maxSkips">
            ⏭️ تخطي
          </button>
        </div>

        <div v-if="gameState.isPaused" class="paused-overlay">
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
<style>
/* CSS Variables & Global Styles from previous answer remains, adding updates */

/* تحسينات الريسبونسف والهواتف */
.app-container {
    width: 100%;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px; /* مسافة من الحواف للهواتف */
    box-sizing: border-box;
}

.game-card {
  width: 100%;
  max-width: 450px; /* عرض مناسب للهاتف */
  background: rgba(30, 41, 59, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  text-align: center;
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: 90vh; /* منع تجاوز ارتفاع الشاشة */
  overflow-y: auto;
}

/* Tutorial Styles */
.tutorial-steps {
  text-align: right;
  background: rgba(0,0,0,0.2);
  padding: 15px;
  border-radius: 12px;
  margin: 15px 0;
}
.step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
.step span { font-size: 1.2rem; }
.step p { margin: 0; font-size: 0.95rem; color: #e2e8f0; line-height: 1.5; }
.btn-outline {
  background: transparent;
  border: 2px solid var(--primary);
  color: var(--primary);
  margin-top: 10px;
}

/* Mode Selector */
.mode-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}
.mode-option {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 2px solid transparent;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: 0.3s;
}
.mode-option.selected {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.2);
  color: white;
}

/* Names Grid */
.names-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 15px;
}
.names-grid .input-group { margin-bottom: 0; }

/* Settings Row */
.settings-row {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}
.setting-item {
  flex: 1;
  text-align: right;
}
.setting-item input { text-align: center; }

/* Level Badge */
.level-badge {
  background: linear-gradient(45deg, #f59e0b, #d97706);
  color: black;
  font-weight: bold;
  padding: 8px 15px;
  border-radius: 20px;
  display: inline-block;
  margin: 10px 0 20px;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* Hint Box */
.hint-box {
  background: rgba(255, 255, 200, 0.1);
  border: 1px dashed rgba(255, 255, 200, 0.3);
  color: #fef08a;
  padding: 10px;
  border-radius: 10px;
  margin-top: 15px;
  font-size: 1rem;
  animation: popIn 0.5s ease;
}

/* Skips Counter */
.skips-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.skip-val {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--danger);
}

/* Responsive adjustments */
@media (max-height: 700px) {
  .word-display { font-size: 2.5rem; margin: 15px 0; }
  .timer-box { width: 60px; height: 60px; font-size: 1.5rem; }
  h1 { font-size: 2rem; }
}

.btn-show-more {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-muted);
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  transition: 0.3s;
}

.btn-show-more:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-color: white;
}
</style>