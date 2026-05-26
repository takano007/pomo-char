let timer = null;
let timeLeft = 25 * 60; 
let isWorking = true;
let isTimerRunning = false;

const startWords = ["がんばろう♪", "集中タイム！", "はじめるよ～"];
const breakWords = ["休憩だよ～", "休憩！", "休憩タイム♪"];

const timerDisplay = document.getElementById('timer-display');
const charContainer = document.getElementById('character-container');
const character = document.getElementById('character');
const bubble = document.getElementById('speech-bubble');
const timerPage = document.getElementById('timer-page');
const calendarPage = document.getElementById('calendar-page');

// --- 画面遷移 ---
document.getElementById('btn-to-calendar').addEventListener('click', () => {
    timerPage.style.transform = 'translateX(-100%)';
    calendarPage.style.transform = 'translateX(0)';
    renderCalendar(); 
});

document.getElementById('btn-to-timer').addEventListener('click', () => {
    timerPage.style.transform = 'translateX(0)';
    calendarPage.style.transform = 'translateX(100%)';
});

// --- 初期化 ---
window.addEventListener('load', () => {
    saySomething(startWords);
    startTimer();
    if (Notification.permission === "default") Notification.requestPermission();
});

// --- タイマー機能 ---
function startTimer() {
    isTimerRunning = true;
    if (timer !== null) clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (isWorking) saveStudyTime(25); // 25分記録
            switchMode();
        }
    }, 1000);
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
}

function switchMode() {
    isWorking = !isWorking;
    timeLeft = isWorking ? 25 * 60 : 5 * 60;
    saySomething(isWorking ? startWords : breakWords);
    moveCharacterRandomly();
    startTimer();
}

document.getElementById('btn-stop').addEventListener('click', () => {
    if (isTimerRunning) {
        clearInterval(timer);
        isTimerRunning = false;
        bubble.textContent = "お疲れさま";
        bubble.style.display = 'block';
        setTimeout(() => { bubble.style.display = 'none'; }, 4000);
    }
});

function saySomething(wordList) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    bubble.textContent = wordList[randomIndex];
    bubble.style.display = 'block';
    setTimeout(() => { bubble.style.display = 'none'; }, 3000);
}

// --- 歩く（移動）ロジック ---
function moveCharacterRandomly() {
    // 歩いて移動するときは、CSSのアニメーション（transition）を有効にする
    charContainer.style.transition = "left 1.5s ease-in-out, top 1.5s ease-in-out";
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const randomX = Math.random() * (screenWidth - 120);
    const randomY = 120 + Math.random() * (screenHeight - 350);

    charContainer.style.left = `${randomX}px`;
    charContainer.style.top = `${randomY}px`;
}

// --- 🛠️ ハイブリッド・ドラッグロジック（PC・スマホ両対応） ---
let isDragging = false;
let startX, startY;
let initialLeft, initialTop;
let hasMoved = false; // クリックかドラッグかを見分けるフラグ

// マウス＆タッチのイベント登録
character.addEventListener('mousedown', dragStart);
character.addEventListener('touchstart', dragStart, { passive: false });
window.addEventListener('mousemove', dragMove);
window.addEventListener('touchmove', dragMove, { passive: false });
window.addEventListener('mouseup', dragEnd);
window.addEventListener('touchend', dragEnd);

function dragStart(e) {
    isDragging = true;
    hasMoved = false;
    
    // ドラッグ中はCSSのアニメーション（transition）を消す（これがないとドラッグが遅れてカクつきます）
    charContainer.style.transition = "none";

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;
    initialLeft = charContainer.offsetLeft;
    initialTop = charContainer.offsetTop;
    
    if (e.type === 'touchstart') e.preventDefault();
}

function dragMove(e) {
    if (!isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // 数ピクセル以上動いたら「ドラッグした（クリックじゃない）」と判定
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
    }

    let x = initialLeft + dx;
    let y = initialTop + dy;

    // 画面外ガード
    x = Math.max(0, Math.min(x, window.innerWidth - 120));
    y = Math.max(0, Math.min(y, window.innerHeight - 120));

    charContainer.style.left = `${x}px`;
    charContainer.style.top = `${y}px`;
}

function dragEnd() {
    if (!isDragging) return;
    isDragging = false;

    // 仕様：ドラッグせずに「クリック」だけした場合は、自由に歩き回る
    if (!hasMoved) {
        moveCharacterRandomly();
    }
}

// --- カレンダーロジック ---
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;
}

function saveStudyTime(minutes) {
    const dateStr = getTodayDateString();
    let data = JSON.parse(localStorage.getItem('studyLog')) || {};
    data[dateStr] = (data[dateStr] || 0) + minutes;
    localStorage.setItem('studyLog', JSON.stringify(data));
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    weekDays.forEach(day => {
        const dayNameDiv = document.createElement('div');
        dayNameDiv.className = 'day-name';
        dayNameDiv.textContent = day;
        grid.appendChild(dayNameDiv);
    });

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    document.getElementById('calendar-title').textContent = `${year}年 ${month + 1}月`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    let studyData = JSON.parse(localStorage.getItem('studyLog')) || {};
    let totalMinutes = 0;

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.textContent = day;

        const dateKey = `${year}-${(month+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
        
        // 各日付のマスに合計時間を表示するロジック
        if (studyData[dateKey]) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'study-time';
            timeDiv.textContent = `${studyData[dateKey]}分`;
            cell.appendChild(timeDiv);
            totalMinutes += studyData[dateKey];
            cell.style.background = '#4e4e4e';
        }

        grid.appendChild(cell);
    }

    document.getElementById('total-study-time').textContent = `今月の合計：${totalMinutes}分`;
}