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
let sessionStartTime = null; 

// スリープ防止用の変数
let noSleep = new NoSleep();
let wakeLock = null;
let currentCalendarDate = new Date();
let beepAudio = new Audio('beep.mp3');

// アニメーション用
const charImg = document.getElementById('char-img'); 
let animTimer = null;   
let animIndex = 0;

// 追加：カレンダー画面のキャラクター用変数
let calAnimTimer = null;
let calAnimIndex = 0;

const breakImages = ["images/idle1.png", "images/idle2.png"]; 
const workImages = ["images/work1.png", "images/work2.png"];   
const walkImages = ["images/walk1.png", "images/walk2.png"];   

const startWords = ["がんばろう♪", "集中タイム！", "はじめるよ～"];
const breakWords = ["休憩だよ～", "休憩！", "休憩タイム♪"];

const timerDisplay = document.getElementById('timer-display');
const charContainer = document.getElementById('character-container');
const character = document.getElementById('character');
const bubble = document.getElementById('speech-bubble');

// --- 画面遷移 ---
document.getElementById('btn-to-calendar').addEventListener('click', function() {
    const tPage = document.getElementById('timer-page');
    const cPage = document.getElementById('calendar-page');
    if (tPage && cPage) {
        tPage.style.display = 'none';
        cPage.style.display = 'flex';
        renderCalendar(); 
    }
});

document.getElementById('btn-to-timer').addEventListener('click', function() {
    // 🌟 追加：カレンダー側のキャラのタイマーを止める
    if (calAnimTimer !== null) { clearInterval(calAnimTimer); calAnimTimer = null; }

    const tPage = document.getElementById('timer-page');
    const cPage = document.getElementById('calendar-page');
    if (tPage && cPage) {
        tPage.style.display = 'block';
        cPage.style.display = 'none';
    }
});

// 前月・翌月ボタン
const btnPrevMonth = document.getElementById('btn-prev-month');
if (btnPrevMonth) {
    btnPrevMonth.addEventListener('click', function() {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
}
const btnNextMonth = document.getElementById('btn-next-month');
if (btnNextMonth) {
    btnNextMonth.addEventListener('click', function() {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
}

// --- 初期化 ---
window.addEventListener('load', function() {
    resetPositionToCenter();
    bubble.style.display = 'none';
    playAnimation(breakImages, 500);
    
    // 【Version 2】現在のユーザーIDをカレンダーの下に表示
    const currentIdText = document.getElementById('current-user-id-text');
    if (currentIdText) {
        currentIdText.textContent = userId;
    }
    
    // 【Version 2】IDを押すと入力欄が出現する処理
    const triggerIdDisplay = document.getElementById('trigger-id-display');
    const transferInputArea = document.getElementById('transfer-input-area');
    if (triggerIdDisplay && transferInputArea) {
        triggerIdDisplay.addEventListener('click', function() {
            // 表示・非表示を切り替える
            if (transferInputArea.style.display === 'none') {
                transferInputArea.style.display = 'block';
            } else {
                transferInputArea.style.display = 'none';
            }
        });
    }

    // 【Version 2】引継ぎボタンを押した時の処理
    const btnDoTransfer = document.getElementById('btn-do-transfer');
    if (btnDoTransfer) {
        btnDoTransfer.addEventListener('click', function() {
            const inputId = document.getElementById('input-new-user-id').value.trim();
            
            if (!inputId) {
                alert("引き継ぎたいユーザーIDを入力してください。");
                return;
            }
            if (inputId === userId) {
                alert("現在と同じユーザーIDです。");
                return;
            }

            if (confirm("入力されたユーザーIDにデータを切り替えますか？\n次回以降もこのIDで自動ログインされます。")) {
                // localStorage（スマホの記憶）を新しいIDに書き換える
                localStorage.setItem('supabase_user_id', inputId);
                
                alert("引き継ぎが完了しました！データを反映するためにアプリを再起動します。");
                // 画面をリロードして、次回（今この瞬間から）新しいIDで動かす
                location.reload(); 
            }
        });
    }

    // Safari対策：画面を開いた直後に通知許可を求めず、安全に処理する
    try {
        if ('Notification' in window && Notification.permission === "default") {
            setTimeout(function() {
                Notification.requestPermission().then(function(p) {
                    console.log("通知設定:", p);
                }).catch(function(err) {
                    console.log("通知エラー:", err);
                });
            }, 1000);
        }
    } catch (e) {
        console.log("通知非対応ブラウザ");
    }

    // スタートボタンの処理
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', function() {
            // iPhone対策：ボタンを押した瞬間に音ファイルを強制ロード
            if (beepAudio) {
                beepAudio.load(); 
            }
            
            playBeepSound();    // 音を鳴らす
            startTimer();       // タイマー始動
            btnStart.style.display = 'none';
            
            // iPhone対策：音の邪魔をしないよう、0.5秒遅らせてスリープ防止をON
            setTimeout(function() {
                requestWakeLock();  
            }, 500); 
        });
    }
});

// 音を鳴らす
function playBeepSound() {
    try {
        if (beepAudio) {
            beepAudio.currentTime = 0; // 再生位置を先頭に戻す
            
            // iPhone対策：再生処理のエラーを安全に回避
            const playPromise = beepAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(function(error) {
                    console.log("iPhoneでのmp3再生ブロック:", error);
                });
            }
        }
    } catch (e) {
        console.log("音再生エラー:", e);
    }
}

function sendNotification(title, body) {
    try {
        // iPhoneのSafariでもエラーにならないよう、慎重にチェックを重ねる
        if ('Notification' in window && Notification.permission === "granted") {
            new Notification(title, { body: body });
        } else {
            // 🌟 iPhone（Safari）の場合は、通知の代わりにキャラクターに喋らせる
            saySomething([title + " " + body], 5000);
        }
    } catch (e) {
        console.log("Safariの通知ブロックを回避しました:", e);
        // エラーが起きても無視して、キャラクターに喋らせる
        saySomething([title], 5000);
    }
    
    playBeepSound(); // 音を鳴らす
}

// Safari対策：中身の空っぽな関数（()=>{}）を完全に無くし、古い書き方に統一
function requestWakeLock() {
    try {
        noSleep.enable();
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').then(function(lock) {
                wakeLock = lock;
                console.log("WakeLock有効化");
            }).catch(function(err) {
                console.log("WakeLock拒否:", err);
            });
        }
    } catch (e) {
        console.log("スリープ防止エラー:", e);
    }
}

function releaseWakeLock() {
    try {
        noSleep.disable();
        if (wakeLock !== null) {
            wakeLock.release().then(function() {
                wakeLock = null;
                console.log("WakeLock解除");
            }).catch(function(err) {
                console.log("WakeLock解除エラー:", err);
            });
        }
    } catch (e) {
        console.log("解除エラー:", e);
    }
}

// タイマー制御
function startTimer() {
    isTimerRunning = true;
    if (isWorking) { sessionStartTime = new Date(); }
    
    if (isWorking) {
        playAnimation(workImages, 500); 
        saySomething(startWords, 3000); 
    } else {
        playAnimation(breakImages, 500); 
        saySomethingStatic(breakWords);   
    }

    if (timer !== null) clearInterval(timer);
    timer = setInterval(function() {
        timeLeft--;
        updateDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (isWorking) { calculateAndSaveMinutes(); }
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
    
    if (isWorking) {
        sendNotification("集中タイムスタート！", "さあ、次の25分もがんばろう♪");
    } else {
        sendNotification("時間です！休憩タイム♪", "ゆっくり休んでね。");
    }

    resetPositionToCenter();
    startTimer(); 
}

// 修了ボタン
document.getElementById('btn-stop').addEventListener('click', function() {
    if (isTimerRunning) {
        clearInterval(timer);
        isTimerRunning = false;
        if (isWorking) { calculateAndSaveMinutes(); }
        
        releaseWakeLock();

        const btnStart = document.getElementById('btn-start');
        if (btnStart) btnStart.style.display = 'block';
        
        timeLeft = 25 * 60;
        updateDisplay();

        resetPositionToCenter();
        playAnimation(breakImages, 500);
        saySomething(["お疲れさま"], 3000);
    }
});

function calculateAndSaveMinutes() {
    if (!sessionStartTime) return;
    const now = new Date();
    const passedSeconds = Math.floor((now - sessionStartTime) / 1000);
    const roundedMinutes = Math.floor(passedSeconds / 60);
    
    if (roundedMinutes > 0) {
        saveStudyTime(roundedMinutes);
    }
    sessionStartTime = null;
}

function saySomething(wordList, duration) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    bubble.textContent = wordList[randomIndex];
    bubble.style.display = 'block';
    if (window.bubbleHideTimer) clearTimeout(window.bubbleHideTimer);
    window.bubbleHideTimer = setTimeout(function() { bubble.style.display = 'none'; }, duration);
}

function saySomethingStatic(wordList) {
    if (window.bubbleHideTimer) clearTimeout(window.bubbleHideTimer); 
    const randomIndex = Math.floor(Math.random() * wordList.length);
    bubble.textContent = wordList[randomIndex];
    bubble.style.display = 'block';
}

function resetPositionToCenter() {
    charContainer.style.transition = "none"; 
    const centerX = (window.innerWidth - 120) / 2;
    const centerY = (window.innerHeight - 120) / 2 + 80;
    charContainer.style.left = `${centerX}px`;
    charContainer.style.top = `${centerY}px`;
    charContainer.style.display = 'block'; // 表示
}

function moveCharacterRandomly() {
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

    setTimeout(function() {
        if (isTimerRunning && isWorking) {
            playAnimation(workImages, 500);  
        } else {
            playAnimation(breakImages, 500); 
            if (isTimerRunning && !isWorking) { bubble.style.display = 'block'; }
        }
    }, 1500);
}

function playAnimation(imageArray, intervalTime) {
    if (animTimer !== null) clearInterval(animTimer);
    animIndex = 0;
    animTimer = setInterval(function() {
        animIndex = (animIndex + 1) % imageArray.length; 
        charImg.src = imageArray[animIndex]; 
    }, intervalTime);
}

// ドラッグ処理
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
    await supabaseClient.from('study_logs').insert([{ user_id: userId, study_date: dateStr, minutes: minutes }]);
}

// カレンダー描画
async function renderCalendar() {
    const { data: studyData, error } = await supabaseClient.from('study_logs').select('study_date, minutes').eq('user_id', userId);
    if (error) return;

    const studyLogMap = {};
    if (studyData && studyData.length > 0) {
        studyData.forEach(function(row) {
            if (row.study_date) {
                studyLogMap[row.study_date] = (studyLogMap[row.study_date] || 0) + row.minutes;
            }
        });
    }

    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    weekDays.forEach(function(day) {
        const dayNameDiv = document.createElement('div');
        dayNameDiv.className = 'day-name';
        dayNameDiv.textContent = day;
        grid.appendChild(dayNameDiv);
    });

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const titleElement = document.getElementById('calendar-title');
    if (titleElement) { titleElement.textContent = `${year}年 ${month + 1}月`; }

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

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
            cell.style.background = '#c2dcf1';
        }
        grid.appendChild(cell);
    }

    let calculatedTotal = 0;
    Object.keys(studyLogMap).forEach(function(key) {
        const logDate = new Date(key);
        if (logDate.getFullYear() === year && logDate.getMonth() === month) {
            calculatedTotal += studyLogMap[key];
        }
    });

    const totalElement = document.getElementById('total-study-time');
    if (totalElement) { totalElement.textContent = `この月の合計：${calculatedTotal}分`; }

    // 🌟 ここから追加：カレンダー画面の連続日数計算とキャラクター制御
    try {
        // 1. カレンダーキャラのアニメーションを開始（既存のbreakImagesで2連モーション）
        if (calAnimTimer !== null) clearInterval(calAnimTimer);
        calAnimIndex = 0;
        calAnimTimer = setInterval(function() {
            calAnimIndex = (calAnimIndex + 1) % walkImages.length;
            const calCharImg = document.getElementById('calendar-char-img');
            if (calCharImg) calCharImg.src = walkImages[calAnimIndex];
        }, 500);

        // 2. 25分以上頑張った日を重複なしでリスト化（昇順ソート）
        const loggedDates = [];
        Object.keys(studyLogMap).forEach(function(key) {
            if (studyLogMap[key] >= 25) {
                loggedDates.push(key); // "YYYY-MM-DD"
            }
        });
        loggedDates.sort();

        // 3. 連続日数の計算
        let maxStreak = 0;
        let currentStreak = 0;
        let todayStr = getTodayDateString();
        
        // 昨日（今日の一日前）の日付文字列を作る
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let yesterdayStr = yesterday.getFullYear() + "-" + (yesterday.getMonth()+1).toString().padStart(2,'0') + "-" + yesterday.getDate().toString().padStart(2,'0');

        // 今日、または昨日から遡って連続している日数を数える
        let checkDate = new Date();
        // もし今日25分未満で、昨日25分以上なら、昨日を起点にチェック開始
        if (!loggedDates.includes(todayStr) && loggedDates.includes(yesterdayStr)) {
            checkDate = yesterday;
        }

        while (true) {
            let dKey = checkDate.getFullYear() + "-" + (checkDate.getMonth()+1).toString().padStart(2,'0') + "-" + checkDate.getDate().toString().padStart(2,'0');
            if (loggedDates.includes(dKey)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1); // 1日前へ遡る
            } else {
                break; // 連続が途切れたら終了
            }
        }

        // 4. 条件に合わせて吹き出しを表示
        const calBubble = document.getElementById('calendar-speech-bubble');
        if (calBubble) {
            if (currentStreak === 2) {
                calBubble.textContent = "いい調子！";
                calBubble.style.display = 'block';
            } else if (currentStreak >= 3) {
                calBubble.textContent = currentStreak + "日連続！頑張ってるね";
                calBubble.style.display = 'block';
            } else {
                // 0日または1日のときは吹き出しを隠す
                calBubble.style.display = 'none';
            }
        }
    } catch (e) {
        console.log("カレンダーキャラ処理エラー:", e);
    }
}

