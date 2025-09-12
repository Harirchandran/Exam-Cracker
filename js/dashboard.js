// js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("dashboard.js: DOM fully loaded and parsed.");
    history.replaceState({ dashboard: true }, '', window.location.pathname);

        // --- NETWORK STATUS HANDLING ---
        function updateNetworkBanner() {
            const banner = document.getElementById('networkStatusBanner');
            const retryBtn = document.getElementById('retryNetworkBtn');
            const disableElements = document.querySelectorAll('button, input');
        
            if (!banner) return;
        
            const isOffline = !navigator.onLine;
            banner.style.display = isOffline ? 'block' : 'none';
        
            disableElements.forEach(el => {
                if (el.id !== 'retryNetworkBtn') {
                    el.disabled = isOffline;
                }
            });
        
            if (retryBtn) {
                retryBtn.disabled = false; // Always allow retry button to be clicked
        
                retryBtn.onclick = async () => {
                    if (!navigator.onLine) {
                        alert("Still offline. Please reconnect to the internet.");
                        return;
                    }
        
                    retryBtn.textContent = "Retrying...";
                    retryBtn.disabled = true;
        
                    try {
                        await fetchStudentNameAndUpdateWelcome();
                        await loadSubjects();
                        alert("Data refreshed successfully!");
                        updateNetworkBanner(); // Recheck network state
                    } catch (err) {
                        console.error("Retry failed:", err);
                        alert("Retry failed. Please try again later.");
                    } finally {
                        retryBtn.textContent = "Retry Now";
                        retryBtn.disabled = false;
                    }
                };
            }
        }
        
        window.addEventListener('online', updateNetworkBanner);
        window.addEventListener('offline', updateNetworkBanner);
        updateNetworkBanner(); // Initial call
        
    
    const supabase = window.supabaseGlobalClient;

    if (!supabase) {
        console.error("dashboard.js: Global Supabase client (window.supabaseGlobalClient) is not available. Halting script.");
        alert("A critical error occurred (Supabase client not found). Please refresh or contact support.");
        return;
    }
    console.log("dashboard.js: Supabase client obtained successfully.");
    // js/dashboard.js (near the top or within DOMContentLoaded)
let beepSound;
try {
    beepSound = new Audio('assets/beep.mp3');
    beepSound.load(); // Explicitly tell the browser to start loading the audio data
    console.log("dashboard.js: Beep sound loading initiated.");
} catch (e) {
    console.warn("Could not initialize/load beep sound. Ensure 'assets/beep.mp3' exists or an AudioContext is available.", e);
    beepSound = null;
}

    // --- GLOBAL VARIABLES & DOM ELEMENTS ---
    const studentRoll = localStorage.getItem('roll');
    let studentName = '';
    let activeRealtimeSubscription = null;
    let isTopicsOverlayOpenForHistory = false; 

    const welcomeMsgElement = document.getElementById('welcomeMsg');
    const subjectsContainer = document.getElementById('subjectsContainer');
    const subjectsSpinner = document.getElementById('subjectsSpinner');

    const topicsOverlay = document.getElementById('topicsOverlay');
    const topicsOverlayTitle = document.getElementById('topicsOverlayTitle');
    const topicsContentContainer = document.getElementById('topicsContentContainer');
    const backToSubjectsButton = document.getElementById('backToSubjectsButton');

    const quizOverlay = document.getElementById('quizOverlay');
    // const quizOverlayContent = document.getElementById('quizOverlayContent'); // Already have quizOverlay
    const quizTitleElement = document.getElementById('quizTitle');
    const quizQuestionArea = document.getElementById('quizQuestionArea');
    const quizResultsArea = document.getElementById('quizResultsArea');
    const quizSubmitBtn = document.getElementById('quizSubmitBtn');
    const quizNextBtn = document.getElementById('quizNextBtn');
    const closeQuizBtn = document.getElementById('closeQuizBtn');
    const MODULE_QUIZ_SCORE_INCREMENT = 10; // Add at the top of the file or near quiz logic
    let activeRealtimeDashboardSubscription = null;

    const countdownTimerElement = document.getElementById("countdownTimer");
    // js/dashboard.js


    let timerInterval; // Declare timerInterval here to be accessible by clearInterval

    // --- COUNTDOWN TIMER ---
    function updateTimer() {
      const examDate = new Date("December 30, 2025 00:00:00").getTime();
      const now = new Date().getTime();
      const timeRemaining = examDate - now;
      
      if (!countdownTimerElement) {
          console.warn("login.js: Countdown timer element not found.");
          if(timerInterval) clearInterval(timerInterval);
          return;
      }

      if (timeRemaining < 0) {
        countdownTimerElement.textContent = "The exam target date has passed!";
        if(timerInterval) clearInterval(timerInterval);
        return;
      }

      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      
      countdownTimerElement.textContent = 
        `${days}d ${hours}h ${minutes}m ${seconds}s until exam!`;
    }
    
    if (countdownTimerElement) {
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer(); // Initial call
    } else {
        console.warn("login.js: Countdown timer element 'countdownTimer' not found in the DOM.");
    }


    // --- AUTHENTICATION CHECK ---
    if (!studentRoll) {
        alert('No student logged in! Redirecting to login page.');
        window.location.href = 'index.html';
        return; 
    }

    // --- UTILITY FUNCTIONS ---
    function sanitize(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[^\w\-\.]+/g, '_');
    }
        // --- SAFE SUPABASE WRAPPER ---
        async function safeSupabaseCall(promiseFn, retries = 2) {
            let attempt = 0;
            while (attempt <= retries) {
                try {
                    const result = await promiseFn();
                    if (result.error) throw result.error;
                    return result;
                } catch (err) {
                    console.warn(`Network or Supabase error (attempt ${attempt + 1}):`, err);
                    attempt++;
                    if (attempt > retries) {
                        alert("⚠️ Network error: Please check your connection and try again.");
                        throw err;
                    }
                    await new Promise(res => setTimeout(res, 1500));
                }
            }
        }
    

    function showElementSpinner(element, show = true, isGlobal = false, small = false) {
        if (isGlobal) { 
            if (show) {
                const spinner = document.createElement('span');
                spinner.className = small ? 'spinner inline-small' : 'spinner';
                // if (small) { // Redundant with class but good for clarity
                //     spinner.style.width = '16px';
                //     spinner.style.height = '16px';
                // }
                element.parentNode.insertBefore(spinner, element.nextSibling);
                return spinner;
            } else if (element && element.nextSibling && element.nextSibling.classList && element.nextSibling.classList.contains('spinner')) {
                element.nextSibling.remove();
            }
        } else { 
            if (element) element.style.display = show ? 'inline-block' : 'none';
        }
    }
    
    // --- FUNCTION TO UPDATE COMPLETION PERCENTAGES IN THE UI ---
    function updateModuleCompletionUI(moduleElement, subjectId) {
        if (!moduleElement) return;

        let moduleCompletedPercentage = 0;
        const checkboxes = moduleElement.querySelectorAll('.topic-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb.checked) {
                moduleCompletedPercentage += parseFloat(cb.dataset.percentage || 0);
            }
        });

        const moduleHeaderH3 = moduleElement.querySelector('.module-header h3');
        if (moduleHeaderH3) {
            const currentText = moduleHeaderH3.textContent; 
            const moduleNumberMatch = currentText.match(/Module\s*([^-\s]+)/);
            if (moduleNumberMatch && moduleNumberMatch[1]) {
                moduleHeaderH3.textContent = `Module ${moduleNumberMatch[1]} - Completion: ${moduleCompletedPercentage.toFixed(2)}%`;
            } else { 
                 moduleHeaderH3.textContent = `Module Completion: ${moduleCompletedPercentage.toFixed(2)}%`;
            }
        }
        updateSubjectCardCompletion(subjectId);
    }



    // --- STUDENT DATA FETCHING ---
    async function fetchStudentNameAndUpdateWelcome() {
        if (!studentRoll) {
            if (welcomeMsgElement) welcomeMsgElement.textContent = 'Welcome, Guest!';
            return "Guest";
        }
        try {
            const { data, error } = await supabase
                .from('students')
                .select('name')
                .eq('roll', studentRoll)
                .single();
            if (error || !data) {
                console.error('dashboard.js: Error fetching student name:', error);
                studentName = studentRoll; 
            } else {
                studentName = data.name;
            }
        } catch (err) {
            console.error('dashboard.js: Exception fetching student name:', err);
            studentName = studentRoll; 
        }
        if (welcomeMsgElement) welcomeMsgElement.textContent = 'Welcome, ' + studentName + '!';
        return studentName;
    }

    // --- SUBJECTS LOADING AND RENDERING ---
    function getSubjectQuizOverlayHTML(subjectId, subjectName, lastScore) {
        const lastScoreDisplay = lastScore !== null && lastScore !== undefined ? `Your last score for ${subjectName}: ${lastScore}` : 'No previous score for this subject.';
        return `
            <div id="subjectQuizOverlay" class="overlay subject-quiz-overlay" style="display: flex; z-index: 1050;">
                <div class="overlay-content subject-quiz-overlay-content">
                    <h2 style="color: #2c3e50;">Test Your Knowledge: ${subjectName}</h2>
                    <div id="sqInstructions" class="sq-section">
                        <h3>Instructions:</h3>
                        <ul>
                            <li>This quiz tests your overall knowledge in ${subjectName}.</li>
                            <li>Each time, questions are randomly selected.</li>
                            <li>one correct answer=10 points.</li>
                            <li>You have <strong>20 seconds</strong> for each question.</li>
                            <li>Don't worry about initial scores; practice improves knowledge!</li>
                            <li>This quiz is designed to help you learn and identify areas for review.</li>
                            <li>There are many questions available. Compete on the leaderboard!</li>
                            <li><strong>Academic Integrity:</strong> Please do not use external resources (ChatGPT, Google, etc.) during the quiz.</li>
                        </ul>
                        <h3><p class="last-score-display">${lastScoreDisplay}</p></h3>
                    </div>
    
                    <div id="sqQuizArea" class="sq-section" style="display: none;">
                        <div class="sq-header">
                            <span id="sqTimer" class="sq-timer">Time: 10s</span>
                            <span id="sqCurrentScore" class="sq-current-score">Score: 0</span>
                        </div>
                        <div id="sqQuestionText" class="sq-question-text"></div>
                        <div id="sqOptionsContainer" class="sq-options-container"></div>
                    </div>
    
                    <div id="sqGameOverArea" class="sq-section" style="display: none; text-align: center;">
                        <h3 id="sqGameOverTitle">Game Over!</h3>
                        <p id="sqFinalScore"></p>
                        <button id="sqTryAgainButton" class="button-primary">Try Again</button>
                    </div>
    
                    <div class="sq-actions">
                        <button id="sqBackButton" class="button-secondary">Back to Dashboard Topics</button>
                        <button id="sqLeaderboardButton" class="button-secondary" data-subject-id="${subjectId}" data-subject-name="${subjectName}">View Leaderboard</button>
                        <button id="sqStartButton" class="button-primary" data-subject-id="${subjectId}" data-subject-name="${subjectName}">Start Quiz</button>
                    </div>
                </div>
            </div>
    
            <div id="subjectQuizLeaderboardOverlay" class="overlay leaderboard-overlay" style="display: none; z-index: 1150;">
                 <div class="overlay-content leaderboard-overlay-content">
                    <h2 id="sqLeaderboardTitle">Leaderboard</h2>
                    <div id="sqLeaderboardList">Loading...</div>
                    <button id="sqCloseLeaderboardButton" class="button-secondary" style="margin-top: 20px;">Close Leaderboard</button>
                 </div>
            </div>
        `;
    }
    // Beep sound (preload if possible, or create on demand)
 
    
    
    // --- SUBJECTS LOADING AND RENDERING (Modified to add new button) ---
    async function loadSubjects() {
        if (subjectsSpinner) showElementSpinner(subjectsSpinner, true);
        if (subjectsContainer) subjectsContainer.innerHTML = ''; 
    
        try {
            // ... (fetching subjects and topics logic remains the same as your last version) ...
            const { data: subjects, error: subError } = await supabase.from('subjects').select('subject_id, subject_name');
            // ... (rest of topics fetching and processing)
    
            for (let subject of subjects) {
                let subjectCompletedPercentage = 0;
                // ... (calculate subjectCompletedPercentage as before) ...
                subjectCompletedPercentage = Math.min(100, Math.max(0, subjectCompletedPercentage));
    
                let card = document.createElement('div');
                card.className = 'subject-card';
                card.innerHTML = `
                    <h2>${subject.subject_name}</h2>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" data-subject-id="${subject.subject_id}" style="width: ${subjectCompletedPercentage.toFixed(2)}%;">
                            <span class="progress-bar-text">${subjectCompletedPercentage.toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="subject-card-actions"> <!-- Wrapper for buttons -->
                        <button class="see-topics-btn" data-subject-id="${subject.subject_id}" data-subject-name="${subject.subject_name}">See syllabus-wise notes</button>
                        <button class="test-knowledge-btn" data-subject-id="${subject.subject_id}" data-subject-name="${subject.subject_name}">Test Your Knowledge</button>
                    </div>
                `;
                
                card.querySelector('.see-topics-btn').addEventListener('click', function() {
                    openTopicsOverlay(subject.subject_id, subject.subject_name);
                });
                card.querySelector('.test-knowledge-btn').addEventListener('click', function() {
                    openSubjectQuizManager(subject.subject_id, subject.subject_name);
                });
    
                if (subjectsContainer) subjectsContainer.appendChild(card);
                updateSubjectCardCompletion(subject.subject_id);
                updateProgressBarColor(subject.subject_id, subjectCompletedPercentage);
            }
        } catch(err) {
            console.error('dashboard.js: Error loading subjects:', err);
            if (subjectsContainer) subjectsContainer.innerHTML = '<p>Error loading subjects. Please reload page.</p>';
        } finally {
            if (subjectsSpinner) showElementSpinner(subjectsSpinner, false);
        }
    }
    
    // --- SUBJECT KNOWLEDGE QUIZ LOGIC ---
    let sqQuestions = [];
    let sqCurrentQuestionIndex = 0;
    let sqUserScore = 0;
    let sqTimeLeft = 20;
    let sqTimerInterval = null;
    let sqCurrentSubjectId = null;
    let sqCurrentSubjectName = null; // To pass to Try Again
    
    async function openSubjectQuizManager(subjectId, subjectName) {
        sqCurrentSubjectId = subjectId; // Store for quiz start
        sqCurrentSubjectName = subjectName;
    
        const existingOverlay = document.getElementById('subjectQuizOverlay');
        if (existingOverlay) existingOverlay.remove();
        const existingLeaderboard = document.getElementById('subjectQuizLeaderboardOverlay');
        if (existingLeaderboard) existingLeaderboard.remove();
    
        // Fetch last score for this subject
        let lastScore = null;
        if (studentRoll && subjectId) {
            try {
                const { data: studentData, error } = await supabase
                    .from('students')
                    .select('subject_quiz_scores')
                    .eq('roll', studentRoll)
                    .single();
                if (error) console.error("Error fetching student scores for subject quiz:", error);
                if (studentData && studentData.subject_quiz_scores && studentData.subject_quiz_scores[subjectId] !== undefined) {
                    lastScore = studentData.subject_quiz_scores[subjectId];
                }
            } catch (e) { console.error("Exception fetching student scores:", e); }
        }
    
        const overlayHTML = getSubjectQuizOverlayHTML(subjectId, subjectName, lastScore);
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    
        // Reset UI states
        document.getElementById('sqInstructions').style.display = 'block';
        document.getElementById('sqQuizArea').style.display = 'none';
        document.getElementById('sqGameOverArea').style.display = 'none';
        document.getElementById('sqStartButton').style.display = 'inline-block'; // Show start button initially
        document.getElementById('sqLeaderboardButton').style.display = 'inline-block';
    
    
        document.getElementById('sqBackButton').addEventListener('click', () => {
            closeSubjectQuizManager();
        });
        document.getElementById('sqLeaderboardButton').addEventListener('click', () => {
            showSubjectQuizLeaderboard(subjectId, subjectName);
        });
        document.getElementById('sqStartButton').addEventListener('click', () => {
            startSubjectKnowledgeQuiz(subjectId, subjectName);
        });
        document.getElementById('sqCloseLeaderboardButton').addEventListener('click', () => {
            document.getElementById('subjectQuizLeaderboardOverlay').style.display = 'none';
        });
    }
    
    function closeSubjectQuizManager() {
        if (sqTimerInterval) clearInterval(sqTimerInterval);
        const overlay = document.getElementById('subjectQuizOverlay');
        if (overlay) overlay.remove();
        const leaderboardOverlay = document.getElementById('subjectQuizLeaderboardOverlay');
        if (leaderboardOverlay) leaderboardOverlay.remove();
    }
    
    async function startSubjectKnowledgeQuiz(subjectId, subjectName) {
        document.getElementById('sqInstructions').style.display = 'none';
        document.getElementById('sqGameOverArea').style.display = 'none';
        document.getElementById('sqQuizArea').style.display = 'block';
        document.getElementById('sqStartButton').style.display = 'none';
        document.getElementById('sqLeaderboardButton').style.display = 'none'; // Hide leaderboard button during quiz
    
    
        sqUserScore = 0;
        document.getElementById('sqCurrentScore').textContent = `Score: ${sqUserScore}`;
    
        try {
            const { data, error } = await supabase
                .from('quizzes')
                .select('question_text, options, correct_answer_key, explanation') // Select necessary fields
                .eq('subject_id', subjectId);
            if (error) throw error;
            if (!data || data.length === 0) {
                document.getElementById('sqQuestionText').textContent = 'No questions available for this subject yet. Hari is working hard to add questions, and will be soon added!!';
                document.getElementById('sqOptionsContainer').innerHTML = '';
                return;
            }
            sqQuestions = data.sort(() => 0.5 - Math.random()); // Shuffle questions
            sqCurrentQuestionIndex = 0;
            displaySQNextQuestion();
        } catch (e) {
            console.error("Error fetching subject quiz questions:", e);
            document.getElementById('sqQuestionText').textContent = 'Error loading questions.';
        }
    }
    
    function displaySQNextQuestion() {
        if (sqCurrentQuestionIndex >= sqQuestions.length) {
            // Or maybe a "You've answered all questions!" message if they didn't get any wrong.
            // For a continuous random quiz, you might re-shuffle or fetch more.
            // For now, let's treat it as game over if they cycle through all available.
            sqGameOver("Congratulations! You've completed all available questions for now.");
            return;
        }
    
        const q = sqQuestions[sqCurrentQuestionIndex];
        document.getElementById('sqQuestionText').textContent = q.question_text;
        const optionsContainer = document.getElementById('sqOptionsContainer');
        optionsContainer.innerHTML = '';
        Object.keys(q.options).forEach(key => {
            const button = document.createElement('button');
            button.className = 'sq-option-btn';
            button.textContent = `${key.toUpperCase()}. ${q.options[key]}`;
            button.dataset.key = key;
            button.onclick = () => handleSQAnswer(key, q.correct_answer_key, button, q.explanation);
            optionsContainer.appendChild(button);
        });
    
        sqTimeLeft = 20;
        document.getElementById('sqTimer').textContent = `Time: ${sqTimeLeft}s`;
        if (sqTimerInterval) clearInterval(sqTimerInterval);
        sqTimerInterval = setInterval(() => {
            sqTimeLeft--;
            document.getElementById('sqTimer').textContent = `Time: ${sqTimeLeft}s`;
            if (beepSound && sqTimeLeft > 0 && sqTimeLeft <=5) { // Beep for last 5 seconds
                beepSound.currentTime = 0; 
                beepSound.play().catch(e => console.warn("Beep sound play failed:", e));
            }
            if (sqTimeLeft <= 0) {
                clearInterval(sqTimerInterval);
                sqGameOver("Time's up!");
            }
        }, 1000);
    }
    

    function handleSQAnswer(selectedKey, correctKey, buttonElement, explanation) {
        clearInterval(sqTimerInterval);
        document.querySelectorAll('.sq-option-btn').forEach(btn => btn.disabled = true);
    
        if (selectedKey === correctKey) {
            buttonElement.style.backgroundColor = 'lightgreen';
            sqUserScore += 10; 
            document.getElementById('sqCurrentScore').textContent = `Score: ${sqUserScore}`;
            
            // 1-SECOND DELAY before next question
            setTimeout(() => {
                buttonElement.style.backgroundColor = ''; 
                document.querySelectorAll('.sq-option-btn').forEach(btn => btn.disabled = false);
                sqCurrentQuestionIndex++;
                displaySQNextQuestion();
            }, 1000); // Delay of 1000ms (1 second)
    
        } else {
            buttonElement.style.backgroundColor = 'salmon';
            if (navigator.vibrate) navigator.vibrate(200); 
            
            // 1-SECOND DELAY before triggering game over details
            setTimeout(() => {
                let gameOverMessage = "Incorrect Answer.";
                if (explanation) {
                    gameOverMessage += ` Correct was: ${correctKey.toUpperCase()}. Explanation: ${explanation}`;
                } else {
                    gameOverMessage += ` Correct answer was: ${correctKey.toUpperCase()}.`;
                }
                sqGameOver(gameOverMessage); // This function already handles showing the game over screen
            }, 1000); // Delay of 1000ms (1 second)
        }
    }
    
    async function sqGameOver(reason) {
        console.log("Game Over. Reason:", reason);
        if (sqTimerInterval) clearInterval(sqTimerInterval);
        document.getElementById('sqQuizArea').style.display = 'none';
        document.getElementById('sqGameOverArea').style.display = 'block';
        document.getElementById('sqGameOverTitle').textContent = reason.includes("Time's up") || reason.includes("Incorrect") ? "Game Over!" : "Quiz Finished!";
        document.getElementById('sqFinalScore').textContent = `Your final score: ${sqUserScore}`;
        document.getElementById('sqStartButton').style.display = 'none'; // Keep start hidden
        document.getElementById('sqLeaderboardButton').style.display = 'inline-block'; // Show leaderboard again
    
        const tryAgainButton = document.getElementById('sqTryAgainButton');
        tryAgainButton.onclick = () => {
            // Re-initialize for a new quiz attempt for the SAME subject
            if (sqCurrentSubjectId && sqCurrentSubjectName) {
                startSubjectKnowledgeQuiz(sqCurrentSubjectId, sqCurrentSubjectName);
            } else {
                closeSubjectQuizManager(); // Fallback if context is lost
            }
        };
    
        // Update student's score in DB if this is a new high score for this subject
        if (studentRoll && sqCurrentSubjectId) {
            try {
                const { data: studentData, error: fetchError } = await supabase
                    .from('students')
                    .select('subject_quiz_scores')
                    .eq('roll', studentRoll)
                    .single();
    
                if (fetchError) throw fetchError;
    
                let scores = studentData.subject_quiz_scores || {};
                const currentSubjectBestScore = scores[sqCurrentSubjectId] || 0;
    
                if (sqUserScore > currentSubjectBestScore) {
                    scores[sqCurrentSubjectId] = sqUserScore;
                    const { error: updateError } = await supabase
                        .from('students')
                        .update({ subject_quiz_scores: scores })
                        .eq('roll', studentRoll);
                    if (updateError) throw updateError;
                    console.log(`New high score ${sqUserScore} saved for subject ${sqCurrentSubjectId}`);
                }
            } catch (e) {
                console.error("Error updating subject quiz high score:", e);
            }
        }
    }
    
    async function showSubjectQuizLeaderboard(subjectId, subjectName) {
        const leaderboardOverlay = document.getElementById('subjectQuizLeaderboardOverlay');
        const leaderboardListDiv = document.getElementById('sqLeaderboardList');
        const leaderboardTitle = leaderboardOverlay.querySelector('h2'); // Assuming h2 is for title
    
        leaderboardTitle.textContent = `Leaderboard: ${subjectName}`;
        leaderboardListDiv.innerHTML = 'Loading...';
        leaderboardOverlay.style.display = 'flex';
    
        try {
            const { data: students, error } = await supabase
                .from('students')
                .select('roll, name, subject_quiz_scores');
            
            if (error) throw error;
    
            const leaderboardData = students
                .map(s => ({
                    roll: s.roll,
                    name: s.name,
                    score: (s.subject_quiz_scores && s.subject_quiz_scores[subjectId] !== undefined) ? s.subject_quiz_scores[subjectId] : 0
                }))
                .filter(s => s.score > 0) // Optional: only show students who have a score > 0
                .sort((a, b) => b.score - a.score);
    
            if (leaderboardData.length === 0) {
                leaderboardListDiv.innerHTML = '<p>No scores yet for this subject. Be the first!</p>';
                return;
            }
    
            let listHTML = '<ol class="leaderboard-list-ol">';
            leaderboardData.forEach((entry, index) => {
                const isCurrentUser = entry.roll === studentRoll;
                listHTML += `<li class="${isCurrentUser ? 'current-user-highlight' : ''}">
                                <span>${index + 1}. ${entry.name} (${entry.roll})</span>
                                <span>Score: ${entry.score}</span>
                             </li>`;
            });
            listHTML += '</ol>';
            leaderboardListDiv.innerHTML = listHTML;
    
        } catch (e) {
            console.error("Error fetching leaderboard data:", e);
            leaderboardListDiv.innerHTML = '<p>Could not load leaderboard.</p>';
        }
    }
    
    
    // New function to update progress bar color
    function updateProgressBarColor(subjectId, percentage) {
        const progressBarFill = document.querySelector(`.progress-bar-fill[data-subject-id="${subjectId}"]`);
        if (!progressBarFill) return;
    
        let backgroundColor;
        if (percentage < 33) {
            backgroundColor = '#dc3545'; // Red (danger/low)
        } else if (percentage < 66) {
            backgroundColor = '#ffc107'; // Yellow (warning/medium)
        } else if (percentage < 90) {
            backgroundColor = '#28a745'; // Green (good)
        } else {
            backgroundColor = '#007bff'; // Blue (excellent/primary)
        }
        progressBarFill.style.backgroundColor = backgroundColor;
    
        // Text color adjustment for better contrast
        const progressBarText = progressBarFill.querySelector('.progress-bar-text');
        if (progressBarText) {
            if (percentage < 33 || (percentage >= 66 && percentage < 90) ) { // Red or Green
                progressBarText.style.color = 'white';
            } else if (percentage >=33 && percentage < 66) { // Yellow
                 progressBarText.style.color = '#212529'; // Dark text on yellow
            }
            else { // Blue
                progressBarText.style.color = 'white';
            }
        }
    }
    
    
    // Modify updateSubjectCardCompletion to also update the progress bar visuals
    async function updateSubjectCardCompletion(subjectId) {
        const subjectCardButton = document.querySelector(`.subject-card button[data-subject-id="${subjectId}"]`);
        if (!subjectCardButton) return;
        const subjectCardDiv = subjectCardButton.closest('.subject-card');
        if (!subjectCardDiv) return;
    
        const progressBarFill = subjectCardDiv.querySelector(`.progress-bar-fill[data-subject-id="${subjectId}"]`);
        const progressBarText = progressBarFill ? progressBarFill.querySelector('.progress-bar-text') : null;
    
        try {
            const { data: topicsForSubject, error } = await supabase
                .from('subject_topics')
                .select('percentage, roll_data')
                .eq('subject_id', subjectId);
    
            if (error) {
                console.error("dashboard.js: Error fetching topics for subject card update:", error);
                return;
            }
    
            let totalCompletedPercentage = 0;
            if (topicsForSubject) {
                topicsForSubject.forEach(topic => {
                    if (topic.roll_data && topic.roll_data[studentRoll] === true) {
                        totalCompletedPercentage += parseFloat(topic.percentage || 0);
                    }
                });
            }
            totalCompletedPercentage = Math.min(100, Math.max(0, totalCompletedPercentage)); // Clamp value
    
            // Update progress bar
            if (progressBarFill) {
                progressBarFill.style.width = `${totalCompletedPercentage.toFixed(2)}%`;
                if (progressBarText) {
                    progressBarText.textContent = `${totalCompletedPercentage.toFixed(2)}%`;
                }
                updateProgressBarColor(subjectId, totalCompletedPercentage); // Update color
            }
            // The old <p> tag for completion is removed, so no need to update it.
    
        } catch (err) {
            console.error("dashboard.js: Exception updating subject card completion:", err);
        }
    }
    
    // --- HTML TEMPLATE FOR MODULE NOTES MANAGER OVERLAY ---
    function getModuleNotesManagerHTML(subjectId, moduleNumber, subjectName, existingNoteUrl) {
        const hasNote = !!existingNoteUrl;
        let buttonsHTML = '';

        if (hasNote) {
            buttonsHTML = `
                <button class="button-mn-view" data-pdf-url="${existingNoteUrl}">View Note</button>
                <button class="button-mn-replace" data-subject-id="${subjectId}" data-module-number="${moduleNumber}" data-subject-name="${subjectName}">Replace Note</button>
            `;
        } else {
            buttonsHTML = `
                <button class="button-mn-add" data-subject-id="${subjectId}" data-module-number="${moduleNumber}" data-subject-name="${subjectName}">Add Note</button>
            `;
        }

        return `
            <div id="moduleNotesManagerOverlay" class="overlay" style="display: flex; z-index: 1100;">
                <div class="overlay-content small-overlay-content">
                    <h3 style="text-align:center; color:#BF5700;">Module ${moduleNumber} Notes</h3>
                    <p style="text-align:center; font-size:0.9em; color:#555;">Manage PDF notes for this module.</p>
                    <div class="module-notes-actions">
                        ${buttonsHTML}
                    </div>
                    <button id="closeModuleNotesManager" class="back-btn" style="background-color:#6c757d; margin-top:20px; display:block; width:auto; margin-left:auto; margin-right:auto;">Close</button>
                </div>
            </div>
        `;
    }

    // --- FUNCTION TO OPEN THE MODULE NOTES MANAGER ---
    function openModuleNotesManager(subjectId, moduleNumber, subjectName, existingNoteUrl) {
        const existingManager = document.getElementById('moduleNotesManagerOverlay');
        if (existingManager) {
            existingManager.remove();
        }

        const managerHTML = getModuleNotesManagerHTML(subjectId, moduleNumber, subjectName, existingNoteUrl);
        document.body.insertAdjacentHTML('beforeend', managerHTML);

        const newManagerOverlay = document.getElementById('moduleNotesManagerOverlay');
        
        document.getElementById('closeModuleNotesManager').addEventListener('click', () => {
            newManagerOverlay.remove();
        });

        const actionsContainer = newManagerOverlay.querySelector('.module-notes-actions');
        actionsContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('button-mn-view')) {
                window.open(target.dataset.pdfUrl, '_blank');
            } else if (target.classList.contains('button-mn-add') || target.classList.contains('button-mn-replace')) {
                handleModuleNoteUpload(target, subjectId, moduleNumber, subjectName, newManagerOverlay);
            }
        });
    }

    // --- UPLOAD LOGIC FOR MODULE NOTES (CALLED FROM MANAGER) ---
    async function handleModuleNoteUpload(triggerButton, subjectId, moduleNumber, subjectName, managerOverlayToClose) {
        const isReplacing = triggerButton.classList.contains('button-mn-replace');
        const confirmMsg = `Uploading Module Note Rules:\n• Only PDF files are allowed.\n• Maximum file size is 10MB.\n• This note applies to the entire module.\n\nDo you want to proceed ${isReplacing ? 'with replacing the existing note' : 'with adding a new note'}?`;
        
        if (!confirm(confirmMsg)) return;

        let fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/pdf';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            document.body.removeChild(fileInput);
            if (!file) return;

            if (file.size > 10 * 1024 * 1024) { alert("File size exceeds 10MB."); return; }
            if (file.type !== 'application/pdf') { alert("Only PDF files are allowed."); return; }

            const originalButtonText = triggerButton.textContent;
            triggerButton.textContent = 'Uploading...';
            triggerButton.disabled = true;
            
            try {
                const sanitizedSubjectForPath = sanitize(subjectName);
                const filePath = `module-notes/${sanitizedSubjectForPath}/module_${moduleNumber}_${Date.now()}.pdf`; 
                
                const { error: storageError } = await supabase.storage
                    .from('topic-notes') 
                    .upload(filePath, file, { upsert: true });
                if (storageError) throw storageError;

                const { data: publicURLData } = supabase.storage
                    .from('topic-notes') 
                    .getPublicUrl(filePath);
                const publicURL = publicURLData.publicUrl;

                const { error: dbError } = await supabase
                    .from('module_notes')
                    .upsert({ 
                        subject_id: subjectId, 
                        module_number: moduleNumber, 
                        pdf_url: publicURL, 
                        uploader_roll: studentRoll, 
                        uploaded_at: new Date().toISOString() 
                    }, { onConflict: 'subject_id, module_number' });
                if (dbError) throw dbError;

                alert(`Module Note ${isReplacing ? 'replaced' : 'added'} successfully!`);
                
                if (managerOverlayToClose) managerOverlayToClose.remove();

                if (topicsOverlay.dataset.currentSubjectId && topicsOverlay.dataset.currentSubjectName) {
                   openTopicsOverlay(topicsOverlay.dataset.currentSubjectId, topicsOverlay.dataset.currentSubjectName);
                }

            } catch (err) {
                console.error("dashboard.js: Error uploading module note:", err);
                alert("Error uploading module note. Please try again.");
                triggerButton.textContent = originalButtonText;
                triggerButton.disabled = false;
            }
        };
        fileInput.click();
    }
    window.addEventListener('popstate', (event) => {
        if (isTopicsOverlayOpenForHistory) {
          console.log("Back button pressed - closing topics overlay");
          closeTopicsOverlayFromHistory();
          isTopicsOverlayOpenForHistory = false;
          
          // Replace with current state to prevent further back navigation
          history.replaceState({ dashboard: true }, '', window.location.pathname);
          return;
        }
        
        // Remove the existing confirmation logic entirely
        // Just let normal back navigation occur for other cases
      });
 
    

    // --- TOPICS OVERLAY (Main Rendering Function) ---
    async function openTopicsOverlay(subjectId, subjectName) { 
        if (!topicsOverlay || !topicsContentContainer || !topicsOverlayTitle) return;

        topicsOverlayTitle.textContent = `${subjectName} - Syllabus`;
        topicsContentContainer.innerHTML = '<span class="spinner" style="display:block; margin: 20px auto;"></span>';
        topicsOverlay.style.display = 'flex';
        topicsOverlay.dataset.currentSubjectId = subjectId;
        topicsOverlay.dataset.currentSubjectName = subjectName;

        try {
            const { data: topics, error: topicsError } = await supabase
                .from('subject_topics')
                .select('*')
                .eq('subject_id', subjectId)
                .order('module_number', { ascending: true })
                .order('topic_id', { ascending: true });
            if (topicsError) throw topicsError;

            let modulesData = {};
            topics.forEach(topic => {
                const modNumStr = String(topic.module_number);
                if (!modulesData[modNumStr]) {
                    modulesData[modNumStr] = { topics: [], noteUrl: null, subjectName: subjectName, subjectId: subjectId };
                }
                modulesData[modNumStr].topics.push(topic);
            });

            const moduleNumbersForSubject = Object.keys(modulesData);
            if (moduleNumbersForSubject.length > 0) {
                const { data: moduleNotes, error: moduleNotesError } = await supabase
                    .from('module_notes')
                    .select('module_number, pdf_url')
                    .eq('subject_id', subjectId)
                    .in('module_number', moduleNumbersForSubject);

                if (moduleNotesError) console.error("dashboard.js: Error fetching module notes:", moduleNotesError);
                else if (moduleNotes) {
                    moduleNotes.forEach(note => {
                        const modNumStr = String(note.module_number);
                        if (modulesData[modNumStr]) {
                            modulesData[modNumStr].noteUrl = note.pdf_url;
                        }
                    });
                }
            }

            let contentHTML = '';
            for (let moduleNumberKey in modulesData) {
                const currentModule = modulesData[moduleNumberKey];
                let moduleCompleted = 0;
                currentModule.topics.forEach(topic => {
                    if (topic.roll_data && topic.roll_data[studentRoll] === true) {
                        moduleCompleted += Number(topic.percentage) || 0;
                    }
                });

                const moduleNoteManagerButtonHTML = `
                    <button class="manage-module-notes-btn" 
                            data-subject-id="${currentModule.subjectId}" 
                            data-module-number="${moduleNumberKey}" 
                            data-subject-name="${currentModule.subjectName}" 
                            data-existing-note-url="${currentModule.noteUrl || ''}">
                        ${currentModule.noteUrl ? 'Manage Module Notes' : 'Add Module Notes'}
                    </button>
                `;

                contentHTML += `
                    <div class="module" data-module-number-key="${moduleNumberKey}">
                        <div class="module-header">
                            <h3>Module ${moduleNumberKey} - Completion: ${moduleCompleted.toFixed(2)}%</h3>
                            <div class="module-actions">
                                ${moduleNoteManagerButtonHTML}
                                <button class="start-quiz-btn" data-subject-id="${currentModule.subjectId}" data-module-number="${moduleNumberKey}" data-subject-name="${currentModule.subjectName}">Module ${moduleNumberKey} MCQ Practice</button>
                            </div>
                        </div>`;

                currentModule.topics.forEach(topic => {
                    const isChecked = (topic.roll_data && topic.roll_data[studentRoll] === true) ? 'checked' : '';
                    contentHTML += `
                        <div class="topic-item" data-topic-id="${topic.topic_id}">
                            <div class="topic-item-main">
                                <input type="checkbox" id="topic-${topic.topic_id}" ${isChecked} data-percentage="${topic.percentage}">
                                <label for="topic-${topic.topic_id}">${topic.topic_name}</label>
                            </div>
                            <div class="topic-actions">
                                <button class="perplexity-note-btn" data-subject-name="${currentModule.subjectName}" data-topic-name="${topic.topic_name}">AI Notes</button>
                            </div>
                        </div>`;
                });
                contentHTML += `</div>`;
            }
            topicsContentContainer.innerHTML = contentHTML || '<p>No topics found for this subject.</p>';
        } catch(err) {
            console.error(`dashboard.js: Error loading topics for ${subjectName}:`, err);
            topicsContentContainer.innerHTML = `<p>Error loading content. Please try again.</p>`;
        }
        if (topicsOverlay.style.display === 'flex') {
            if (!isTopicsOverlayOpenForHistory) { // Push state only if not already pushed for this opening
                history.pushState({ overlay: 'topicsOverlayActive' }, '', window.location.pathname + '#topicsOpen');
                isTopicsOverlayOpenForHistory = true;
                console.log("Topics overlay opened, pushed history state.");
            }
        }
        
    }

    function closeTopicsOverlayFromHistory(closedByButton = false) {
        if (topicsOverlay) {
          topicsOverlay.style.display = 'none';
        }
        
        if (isTopicsOverlayOpenForHistory) {
          isTopicsOverlayOpenForHistory = false;
          
          // Clean up the URL if needed
          if (window.location.hash === "#topicsOpen") {
            history.replaceState({ dashboard: true }, '', window.location.pathname);
          }
      
          // Update subject card completion
          const subjectId = topicsOverlay.dataset.currentSubjectId;
          if (subjectId) {
            updateSubjectCardCompletion(subjectId);
          }
          topicsOverlay.removeAttribute('data-current-subject-id');
          topicsOverlay.removeAttribute('data-current-subject-name');
        }
      }
    // Modify the backToSubjectsButton listener
    if (backToSubjectsButton) {
        backToSubjectsButton.addEventListener('click', function() {
            closeTopicsOverlayFromHistory(true); // true indicates it was closed by a button
        });
    }


    // --- EVENT HANDLERS FOR TOPICS OVERLAY (Main Click/Change Delegator) ---
    if (topicsContentContainer) {
        topicsContentContainer.addEventListener('change', async function(event) {
            if (event.target.matches('input[type="checkbox"]')) {
                const checkbox = event.target;
                const topicItemDiv = checkbox.closest('.topic-item');
                if (!topicItemDiv) return;

                const topicId = topicItemDiv.dataset.topicId;
                const newStatus = checkbox.checked;
                const moduleElement = checkbox.closest('.module');
                const subjectId = topicsOverlay.dataset.currentSubjectId;

                const spinner = showElementSpinner(checkbox.parentNode, true, true, true); // small spinner
                checkbox.disabled = true;

                try {
                    const { data: topicData, error: fetchError } = await supabase
                        .from('subject_topics')
                        .select('roll_data')
                        .eq('topic_id', topicId)
                        .single();
                    if (fetchError) throw fetchError;

                    let rollData = topicData.roll_data || {};
                    rollData[studentRoll] = newStatus;

                    const { error: updateError } = await supabase
                        .from('subject_topics')
                        .update({ roll_data: rollData })
                        .eq('topic_id', topicId);
                    if (updateError) throw updateError;
                    
                    if (moduleElement && subjectId) {
                        updateModuleCompletionUI(moduleElement, subjectId);
                    } else {
                        console.warn("dashboard.js: Could not find moduleElement or subjectId for precise UI update post-checkbox change.");
                    }
                } catch (err) {
                    console.error('dashboard.js: Error updating topic status:', err);
                    alert('Error updating topic status. Please try again.');
                    checkbox.checked = !newStatus;
                } finally {
                    showElementSpinner(checkbox.parentNode, false, true);
                    checkbox.disabled = false;
                }
            }
        });

        topicsContentContainer.addEventListener('click', async function(event) {
            const target = event.target;
            
            if (target.classList.contains('manage-module-notes-btn')) {
                const subjectId = target.dataset.subjectId;
                const moduleNumber = target.dataset.moduleNumber;
                const subjectName = target.dataset.subjectName;
                const existingNoteUrl = target.dataset.existingNoteUrl;
                openModuleNotesManager(subjectId, moduleNumber, subjectName, existingNoteUrl === 'null' || existingNoteUrl === '' ? null : existingNoteUrl);
            }
            else if (target.classList.contains('perplexity-note-btn')) {
                const subjName = target.dataset.subjectName; 
                const topName = target.dataset.topicName;   
                const searchQuery = `Detailed notes with examples on subject ${subjName} topic: ${topName}`;
                const perplexityUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(searchQuery)}`;
                window.open(perplexityUrl, '_blank');
            }
            else if (target.classList.contains('start-quiz-btn')) {
                const quizSubjectId = target.dataset.subjectId;
                const quizModuleNumber = target.dataset.moduleNumber;
                const quizSubjectName = target.dataset.subjectName;
                loadAndStartQuiz(quizSubjectId, quizModuleNumber, quizSubjectName);
            }
        });
    }

    if (backToSubjectsButton) {
        backToSubjectsButton.addEventListener('click', function() {
            if (topicsOverlay) topicsOverlay.style.display = 'none';
            if (topicsOverlay) {
                const subjectId = topicsOverlay.dataset.currentSubjectId;
                if (subjectId) {
                    updateSubjectCardCompletion(subjectId); // Ensure dashboard card is fresh
                }
                topicsOverlay.removeAttribute('data-current-subject-id');
                topicsOverlay.removeAttribute('data-current-subject-name');
            }
        });
    }

    // --- QUIZ LOGIC ---
   // Module Quiz Button Event Listeners (Submit, Next, Close)
    // These are attached once as the buttons are part of the static quizOverlay HTML
    let moduleQuizState = { questions: [], currentIndex: 0, score: 0 }; // Encapsulate module quiz state
    if (quizSubmitBtn) quizSubmitBtn.addEventListener('click', () => handleModuleQuizSubmit(moduleQuizState));
    if (quizNextBtn) quizNextBtn.addEventListener('click', () => handleModuleQuizNext(moduleQuizState));
    if (closeQuizBtn) closeQuizBtn.addEventListener('click', () => { /* ... close and reset moduleQuizState ... */ 
        if(quizOverlay) quizOverlay.style.display = 'none';
        moduleQuizState = { questions: [], currentIndex: 0, score: 0 }; // Reset
        if(quizQuestionArea) quizQuestionArea.innerHTML = ''; if(quizResultsArea) quizResultsArea.innerHTML = '';
    });

    // --- MODULE QUIZ LOGIC (Refactored to use moduleQuizState) ---
    async function loadAndStartQuiz(subjectId, moduleNumber, subjectName) { /* ... uses moduleQuizState ... */ 
        if (!quizOverlay || !quizQuestionArea || !quizResultsArea || !quizSubmitBtn || !quizTitleElement || !quizNextBtn) return;
        quizTitleElement.textContent = `Quiz: ${subjectName} - Module ${moduleNumber}`;
        quizQuestionArea.innerHTML = '<span class="spinner" style="display:block; margin:auto;"></span>'; quizResultsArea.innerHTML = '';
        quizSubmitBtn.style.display = 'none'; quizNextBtn.style.display = 'none'; quizOverlay.style.display = 'flex';
        try {
            const {data:q,error:e}=await supabase.from('quizzes').select('*').eq('subject_id',subjectId).eq('module_number',String(moduleNumber));
            if(e)throw e; if(!q||q.length===0){quizQuestionArea.innerHTML="<p>No questions for this module.</p>";return;}
            moduleQuizState.questions = q.sort(()=>0.5-Math.random()); moduleQuizState.currentIndex = 0; moduleQuizState.score = 0;
            displayModuleQuizQuestion(moduleQuizState);
        } catch (err){console.error(err);quizQuestionArea.innerHTML="<p>Error loading quiz.</p>";}
    }
    function displayModuleQuizQuestion(state) { /* ... uses state.currentIndex, state.questions ... */ 
        if(!quizQuestionArea||!quizSubmitBtn||!quizResultsArea||!quizNextBtn)return;
        quizResultsArea.innerHTML=''; quizSubmitBtn.style.display='none'; quizNextBtn.style.display='none';
        if(state.currentIndex >= state.questions.length){showFinalModuleQuizScore(state);return;}
        const q=state.questions[state.currentIndex]; let optsHTML=`<p><b>${state.currentIndex+1}. ${q.question_text}</b></p><ul>`;
        for(const k in q.options)optsHTML+=`<li><label><input type="radio" name="modQuizOpt" value="${k}">${k.toUpperCase()}. ${q.options[k]}</label></li>`;
        optsHTML+='</ul>'; quizQuestionArea.innerHTML=optsHTML; quizSubmitBtn.style.display='block';
    }
    function handleModuleQuizSubmit(state) { /* ... uses state ... */ 
        if(!quizQuestionArea||!quizSubmitBtn||!quizResultsArea||!quizNextBtn)return;
        const selOpt=quizQuestionArea.querySelector('input[name="modQuizOpt"]:checked'); if(!selOpt){alert("Select an answer.");return;}
        quizQuestionArea.querySelectorAll('input[name="modQuizOpt"]').forEach(rb=>rb.disabled=true); quizSubmitBtn.style.display='none';
        const q=state.questions[state.currentIndex];
        if(selOpt.value===q.correct_answer_key){state.score+=MODULE_QUIZ_SCORE_INCREMENT;quizResultsArea.innerHTML="<p style='color:green;'>Correct!</p>";}
        else{quizResultsArea.innerHTML=`<p style='color:red;'>Incorrect. Correct: ${q.correct_answer_key.toUpperCase()}. ${q.options[q.correct_answer_key]}</p>`;}
        if(q.explanation)quizResultsArea.innerHTML+=`<p><i>Explanation: ${q.explanation}</i></p>`;
        quizNextBtn.style.display='block';
    }
    function handleModuleQuizNext(state) { /* ... uses state ... */ 
        state.currentIndex++;
        if(state.currentIndex < state.questions.length)displayModuleQuizQuestion(state);
        else showFinalModuleQuizScore(state);
    }
    function showFinalModuleQuizScore(state) { /* ... uses state ... */ 
        if(!quizQuestionArea||!quizSubmitBtn||!quizResultsArea||!quizNextBtn)return;
        quizQuestionArea.innerHTML=`<h2>Quiz Complete!</h2><p>Your score: ${state.score} / ${state.questions.length*MODULE_QUIZ_SCORE_INCREMENT}</p>`;
        quizResultsArea.innerHTML=''; quizSubmitBtn.style.display='none';quizNextBtn.style.display='none';
    }

    // --- REALTIME SUBSCRIPTION ---
    function subscribeToTopicChanges() {
        if (activeRealtimeDashboardSubscription) {
            try {
                supabase.removeChannel(activeRealtimeDashboardSubscription)
                    .then(status => console.log("dashboard.js: Previous realtime channel removed, status:", status))
                    .catch(error => console.error("dashboard.js: Error removing previous channel:", error));
            } catch (e) {
                console.warn("dashboard.js: Exception removing previous channel:", e);
            }
            activeRealtimeDashboardSubscription = null;
        }
    
        const channelName = `dashboard-student-${studentRoll || 'guest'}-topics-${Date.now().toString(36)}`;
        const channel = supabase.channel(channelName);
    
        activeRealtimeDashboardSubscription = channel
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'subject_topics'
                },
                (payload) => {
                    console.log('dashboard.js: Realtime - Topic updated in DB:', payload);
                    const updatedTopic = payload.new;
                    const oldTopic = payload.old;
    
                    if (!updatedTopic || !updatedTopic.roll_data || !updatedTopic.roll_data.hasOwnProperty(studentRoll)) {
                        return; // Not relevant for this student
                    }
    
                    const studentStatusChanged = (!oldTopic || !oldTopic.roll_data || oldTopic.roll_data[studentRoll] !== updatedTopic.roll_data[studentRoll]);
    
                    if (studentStatusChanged) {
                        console.log(`dashboard.js: Realtime - Topic ${updatedTopic.topic_id} status changed for student ${studentRoll}. Updating UI.`);
    
                        updateSubjectCardCompletion(updatedTopic.subject_id);
    
                        const displayedSubjectId = topicsOverlay.dataset.currentSubjectId;
                        if (topicsOverlay.style.display === 'flex' && displayedSubjectId == updatedTopic.subject_id) {
                            const topicCheckboxInOverlay = topicsContentContainer.querySelector(`#topic-${updatedTopic.topic_id}`);
                            if (topicCheckboxInOverlay) {
                                if (topicCheckboxInOverlay.checked !== updatedTopic.roll_data[studentRoll]) {
                                    topicCheckboxInOverlay.checked = updatedTopic.roll_data[studentRoll];
                                }
    
                                const moduleElement = topicCheckboxInOverlay.closest('.module');
                                if (moduleElement) {
                                    updateModuleCompletionUI(moduleElement, updatedTopic.subject_id);
                                }
                            } else {
                                console.warn(`dashboard.js: Realtime - Topic checkbox for ID ${updatedTopic.topic_id} not found in overlay.`);
                            }
                        }
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`dashboard.js: Successfully subscribed to realtime channel '${channelName}'!`);
                    window.myDashboardRealtimeChannel = activeRealtimeDashboardSubscription;
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`dashboard.js: Realtime channel error for '${channelName}'.`, err);
                } else if (status === 'TIMED_OUT') {
                    console.warn(`dashboard.js: Realtime subscription to '${channelName}' timed out.`);
                } else if (status === 'CLOSED') {
                    console.log(`dashboard.js: Realtime channel '${channelName}' was closed.`);
                } else {
                    console.log(`dashboard.js: Realtime subscription status for '${channelName}':`, status);
                }
    
                if (err) {
                    console.error(`dashboard.js: Realtime subscription error object for '${channelName}':`, err);
                }
            });
    }
    window.myDashboardRealtimeChannel = activeRealtimeDashboardSubscription;

    const logoutButton = document.getElementById('logoutButton');

    // --- LOGOUT FUNCTIONALITY ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            console.log("dashboard.js: Logout button clicked.");
            
            // Clear session
            localStorage.removeItem('roll');
            localStorage.removeItem('password');
    
            // Cleanup realtime subscription
            if (window.supabaseGlobalClient && activeRealtimeDashboardSubscription) {
                try {
                    window.supabaseGlobalClient.removeChannel(activeRealtimeDashboardSubscription)
                        .then(status => {
                            console.log("dashboard.js: Realtime channel removed on logout:", status);
                        })
                        .catch(err => {
                            console.warn("dashboard.js: Error removing realtime channel on logout:", err);
                        });
                } catch (e) {
                    console.warn("dashboard.js: Exception during channel removal on logout:", e);
                }
                activeRealtimeDashboardSubscription = null;
            }
    
            alert('You have been logged out.');
            window.location.href = 'index.html';
        });
    } else {
        console.warn("dashboard.js: Logout button 'logoutButton' not found.");
    }
    
    // --- INITIALIZATION ---
    await fetchStudentNameAndUpdateWelcome();
    await loadSubjects();
      
    if (studentRoll) { 
        subscribeToTopicChanges();
    }

    console.log("dashboard.js: Script execution finished.");
}); // End of DOMContentLoaded

// Modify the beforeunload listener slightly
window.addEventListener('beforeunload', () => {
    const supabase = window.supabaseGlobalClient;
    const channel = window.myDashboardRealtimeChannel;

    if (supabase && channel && channel.subscription) {
        try {
            supabase.removeChannel(channel);
            console.log("dashboard.js: Realtime channel cleaned up on page unload.");
        } catch (e) {
            console.warn("dashboard.js: Error removing realtime channel on unload:", e);
        }
    } else {
        console.log("dashboard.js: No realtime channel to clean up on unload.");
    }
});

