// --- Supabase接続設定 ---
const SUPABASE_URL = 'https://xlulrtessqyvgprrmplk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsdWxydGVzc3F5dmdwcnJtcGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNTkwNTQsImV4cCI6MjA5NTgzNTA1NH0.WZlbVop8sKWnXlINx_iwPLx1eiQneXUZjgNxSluMNSU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ユーザーIDの管理 ---
let userId = localStorage.getItem('supabase_user_id');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('supabase_user_id', userId);
}

let timer = null;
let timeLeft = 25 * 60; 
let isWorking = true;
let isTimerRunning = false;

// 勉強時間を正確に測るための「タイムスタンプ記録方式」に変更
let sessionStartTime = null; 

// スリープ防止用の変数
let noSleep = new NoSleep();
let wakeLock = null;

// カレンダーの表示月を管理するオブジェクト
let currentCalendarDate = new Date();

// --- アニメーション用の変数 ---
const charImg = document.getElementById('char-img'); 
let animTimer = null;   
let animIndex = 0;      

const breakImages = ["images/idle1.png", "images/idle2.png"]; 
const workImages = ["images/work1.png", "images/work2.png"];   
const walkImages = ["images/walk1.png", "images/walk2.png"];   

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

// 前月・翌月ボタンの処理
const btnPrevMonth = document.getElementById('btn-prev-month');
if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
}
const btnNextMonth = document.getElementById('btn-next-month');
if (btnNextMonth) {
    btnNextMonth.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
}

// --- 初期化 ---
window.addEventListener('load', () => {
    resetPositionToCenter();
    bubble.style.display = 'none';
    playAnimation(breakImages, 500);
    
    if (Notification.permission === "default") Notification.requestPermission();

    const btnStart = document.getElementById('btn-start');
        btnStart.addEventListener('click', () => {
        // 1. iPhoneのスピーカーの鍵を解除
        playBeepSound();
        
        // 2. スリープ防止をONにする (awaitを外して普通に呼び出す)
        requestWakeLock();

        // 3. タイマーをスタート
        startTimer();
        btnStart.style.display = 'none';
    });
});

// --- 音を鳴らす共通関数（iPhone & Windows 両対応） ---
function playBeepSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'sine'; 
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); 

        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.error("音の再生に失敗:", e);
    }
}

function sendNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, { body: body });
    }
    playBeepSound();
}

// --- 画面スリープを防止する関数 ---
async function requestWakeLock() {
    noSleep.enable();
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
    }
}
function releaseWakeLock() {
    noSleep.disable();
    if (wakeLock !== null) { wakeLock.release().then(() => { wakeLock = null; }); }
}

// --- 🌟タイマー機能 ---
function startTimer() {
    isTimerRunning = true;
    
    // 集中タイム開始の瞬間の現在時刻をガッチリ記録
    if (isWorking) {
        sessionStartTime = new Date(); 
    }
    
    if (isWorking) {
        playAnimation(workImages, 500); 
        saySomething(startWords, 3000); 
    } else {
        playAnimation(breakImages, 500); 
        saySomethingStatic(breakWords);   
    }

    if (timer !== null) clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        updateDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            
            // 25分タイマーが満了した時、集中タイムだったら記録する
            if (isWorking) {
                calculateAndSaveMinutes();
            }
            switchMode();
        }
    }, 1000);
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
}

// 🌟 モード切り替え（集中 ⇔ 休憩）
function switchMode() {
    isWorking = !isWorking;
    timeLeft = isWorking ? 25 * 60 : 5 * 60;
    
    if (isWorking) {
        sendNotification("集中タイムスタート！", "さあ、次の25分もがんばろう♪");
    } else {
        sendNotification("時間です！休憩タイム♪", "ゆっくり休んでね。");
    }

    // 切り替え時にキャラクターを画面中央に移動させる
    resetPositionToCenter();
    startTimer(); 
}

// 終了ボタンを押したとき
document.getElementById('btn-stop').addEventListener('click', () => {
    if (isTimerRunning) {
        clearInterval(timer);
        isTimerRunning = false;
        
        // 途中で止められた場合、そこまでに経過した分数を計算して保存
        if (isWorking) {
            calculateAndSaveMinutes();
        }
        
        releaseWakeLock();

        const btnStart = document.getElementById('btn-start');
        if (btnStart) btnStart.style.display = 'block';
        
        timeLeft = 25 * 60;
        updateDisplay();

        // 終了時にもキャラクターを画面中央に戻す
        resetPositionToCenter();

        playAnimation(breakImages, 500);
        saySomething(["お疲れさま"], 3000);
    }
});

// 🌟経過時間を計算してSupabaseへ送る関数
function calculateAndSaveMinutes() {
    if (!sessionStartTime) return;
    
    const now = new Date();
    // 開始時間と現在の時間の「差分（秒数）」を計算
    const passedSeconds = Math.floor((now - sessionStartTime) / 1000);
    // 秒数を分数に直し、四捨五入する
    const roundedMinutes = Math.round(passedSeconds / 60);
    
    if (roundedMinutes > 0) {
        saveStudyTime(roundedMinutes);
        console.log(`⏱️ ${roundedMinutes}分間の勉強時間を記録しました！`);
    } else {
        console.log("⏱️ 1分未満の短時間だったため、記録はスキップされました。");
    }
    
    sessionStartTime = null; // 使い終わったらリセット
}

function saySomething(wordList, duration) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    bubble.textContent = wordList[randomIndex];
    bubble.style.display = 'block';
    if (window.bubbleHideTimer) clearTimeout(window.bubbleHideTimer);
    window.bubbleHideTimer = setTimeout(() => { bubble.style.display = 'none'; }, duration);
}

function saySomethingStatic(wordList) {
    if (window.bubbleHideTimer) clearTimeout(window.bubbleHideTimer); 
    const randomIndex = Math.floor(Math.random() * wordList.length);
    bubble.textContent = wordList[randomIndex];
    bubble.style.display = 'block';
}

// 画面中央に位置をリセットする共通関数
function resetPositionToCenter() {
    // スムーズ移動用のtransitionがついたままだと変な動きになるので、一瞬切る
    charContainer.style.transition = "none"; 
    
    const centerX = (window.innerWidth - 120) / 2;
    const centerY = (window.innerHeight - 120) / 2;
    charContainer.style.left = `${centerX}px`;
    charContainer.style.top = `${centerY}px`;
}

// --- ランダム移動アニメーション ---
function moveCharacterRandomly() {
    // 歩いて移動するときは、スムーズに動くようにCSSを設定
    charContainer.style.transition = "left 1.5s ease-in-out, top 1.5s ease-in-out";
    
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const randomX = Math.random() * (screenWidth - 120);
    const randomY = 120 + Math.random() * (screenHeight - 350);

    charContainer.style.left = `${randomX}px`;
    charContainer.style.top = `${randomY}px`;

    if (window.bubbleHideTimer) clearTimeout(window.bubbleHideTimer);
    bubble.style.display = 'none'; 
    playAnimation(walkImages, 250);

    setTimeout(() => {
        if (isTimerRunning && isWorking) {
            playAnimation(workImages, 500);  
        } else {
            playAnimation(breakImages, 500); 
            if (isTimerRunning && !isWorking) {
                bubble.style.display = 'block'; 
            }
        }
    }, 1500);
}

function playAnimation(imageArray, intervalTime) {
    if (animTimer !== null) clearInterval(animTimer);
    animIndex = 0;
    animTimer = setInterval(() => {
        animIndex = (animIndex + 1) % imageArray.length; 
        charImg.src = imageArray[animIndex]; 
    }, intervalTime);
}

// --- ドラッグロジック ---
let isDragging = false;
let startX, startY;
let initialLeft, initialTop;
let hasMoved = false; 

character.addEventListener('mousedown', dragStart);
character.addEventListener('touchstart', dragStart, { passive: false });
window.addEventListener('mousemove', dragMove);
window.addEventListener('touchmove', dragMove, { passive: false });
window.addEventListener('mouseup', dragEnd);
window.addEventListener('touchend', dragEnd);

function dragStart(e) {
    isDragging = true;
    hasMoved = false;
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
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
    let x = initialLeft + dx;
    let y = initialTop + dy;
    x = Math.max(0, Math.min(x, window.innerWidth - 120));
    y = Math.max(0, Math.min(y, window.innerHeight - 120));
    charContainer.style.left = `${x}px`;
    charContainer.style.top = `${y}px`;
}

function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (!hasMoved) moveCharacterRandomly();
}

function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;
}

async function saveStudyTime(minutes) {
    const dateStr = getTodayDateString();
    const { data, error } = await supabaseClient
        .from('study_logs')
        .insert([{ user_id: userId, study_date: dateStr, minutes: minutes }]);
    if (error) console.error('保存エラー:', error);
}

// --- 🌟カレンダー読み込み機能 ---
async function renderCalendar() {
    const { data: studyData, error } = await supabaseClient
        .from('study_logs')
        .select('study_date, minutes')
        .eq('user_id', userId);

    if (error) {
        console.error('❌ ② Supabaseデータの取得に失敗しました:', error);
        return;
    }

    const studyLogMap = {};
    if (studyData && studyData.length > 0) {
        studyData.forEach(row => {
            if (row.study_date) {
                studyLogMap[row.study_date] = (studyLogMap[row.study_date] || 0) + row.minutes;
            }
        });
    }

    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    weekDays.forEach(day => {
        const dayNameDiv = document.createElement('div');
        dayNameDiv.className = 'day-name';
        dayNameDiv.textContent = day;
        grid.appendChild(dayNameDiv);
    });

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const titleElement = document.getElementById('calendar-title');
    if (titleElement) {
        titleElement.textContent = `${year}年 ${month + 1}月`;
    }

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
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
        
        if (studyLogMap[dateKey]) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'study-time';
            timeDiv.textContent = `${studyLogMap[dateKey]}分`;
            cell.appendChild(timeDiv);
            totalMinutes += studyLogMap[studyLogMap[dateKey] ? dateKey : ''];
            cell.style.background = '#c2dcf1';
        }

        grid.appendChild(cell);
    }

    // 今回記録した分数をカレンダー上で正しく足し算して合計を表示する
    let calculatedTotal = 0;
    Object.keys(studyLogMap).forEach(key => {
        const logDate = new Date(key);
        if (logDate.getFullYear() === year && logDate.getMonth() === month) {
            calculatedTotal += studyLogMap[key];
        }
    });

    const totalElement = document.getElementById('total-study-time');
    if (totalElement) {
        totalElement.textContent = `この月の合計：${calculatedTotal}分`;
    }
}