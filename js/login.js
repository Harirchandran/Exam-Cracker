document.addEventListener('DOMContentLoaded', () => {
    console.log("login.js: DOM fully loaded and parsed.");

    // --- AUTO-REDIRECT IF ALREADY LOGGED IN ---
    if (localStorage.getItem('roll')) {
        console.log("User already logged in. Redirecting to dashboard.");
        window.location.href = 'dashboard.html';
        return;
    }

    // --- SUPABASE CLIENT SETUP ---
    const supabase = window.supabaseGlobalClient;
    if (!supabase) {
        console.error("Supabase client is not available.");
        displayMessage("A critical error occurred. Please refresh.", 'error');
        return;
    }
    console.log("Supabase client obtained successfully.");

    // --- DOM ELEMENT REFERENCES ---
    const messageArea = document.getElementById('message-area');
    // FIXED: Banner ID mismatch corrected
    const networkBanner = document.getElementById('network-banner');

    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const loginSpinner = document.getElementById('loginSpinner');
    const rollInput = document.getElementById('roll');
    const passwordInput = document.getElementById('password');

    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changeSpinner = document.getElementById('changeSpinner');
    const rollChangeInput = document.getElementById('rollChange');
    const oldPasswordInput = document.getElementById('oldPassword');
    const newPasswordInput = document.getElementById('newPassword');
    // FIXED: Added reference to the new confirm password input
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const toggleChangePasswordButton = document.getElementById('toggleChangePassword');
    const passwordToggles = document.querySelectorAll('.password-toggle');

    // --- HELPER FUNCTIONS ---
    /**
     * FIXED: Replaces alert() with a message in the designated area.
     * @param {string} message - The message to display.
     * @param {'error' | 'success'} type - The type of message.
     */
    function displayMessage(message, type = 'error') {
        messageArea.textContent = message;
        messageArea.className = message ? type : '';
    }

    /**
     * Toggles the loading state of a button and spinner.
     * @param {boolean} isLoading - True to show spinner, false to show text.
     * @param {HTMLButtonElement} button - The button element.
     * @param {HTMLElement} spinner - The spinner element.
     */
    function toggleLoadingState(isLoading, button, spinner) {
        if (!button || !spinner) return;
        button.disabled = isLoading;
        const buttonText = button.querySelector('.button-text');
        buttonText.style.display = isLoading ? 'none' : 'inline-block';
        spinner.style.display = isLoading ? 'inline-block' : 'none';
    }

    /**
     * Manages the online/offline network banner and button states.
     */
    function updateNetworkStatus() {
        const isOffline = !navigator.onLine;
        if (networkBanner) {
            networkBanner.style.display = isOffline ? 'block' : 'none';
        }
        if (loginButton) loginButton.disabled = isOffline;
        if (changePasswordBtn) changePasswordBtn.disabled = isOffline;
    }

    // --- LOGIN FORM SUBMISSION ---
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        displayMessage('');
        toggleLoadingState(true, loginButton, loginSpinner);

        const roll = rollInput.value.trim();
        const password = passwordInput.value.trim();

        if (!roll || !password) {
            displayMessage('Please fill in both roll number and password.', 'error');
            toggleLoadingState(false, loginButton, loginSpinner);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('students')
                .select('roll, passkey')
                .eq('roll', roll)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (!data || data.passkey !== password) {
                displayMessage('Invalid roll number or password.', 'error');
            } else {
                localStorage.setItem('roll', roll);
                // Note: Storing password in localStorage is insecure.
                // localStorage.setItem('password', password); 
                displayMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
            }
        } catch (err) {
            console.error('Login error:', err);
            displayMessage('An error occurred during login. Please try again.', 'error');
        } finally {
            toggleLoadingState(false, loginButton, loginSpinner);
        }
    });

    // --- CHANGE PASSWORD FORM SUBMISSION ---
    changePasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        displayMessage('');
        toggleLoadingState(true, changePasswordBtn, changeSpinner);

        const roll = rollChangeInput.value.trim();
        const oldPassword = oldPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmNewPassword = confirmNewPasswordInput.value.trim();

        if (!roll || !oldPassword || !newPassword || !confirmNewPassword) {
            displayMessage('Please fill in all fields for password change.', 'error');
            toggleLoadingState(false, changePasswordBtn, changeSpinner);
            return;
        }
        if (newPassword.length < 6) {
            displayMessage('New password must be at least 6 characters long.', 'error');
            toggleLoadingState(false, changePasswordBtn, changeSpinner);
            return;
        }
        if (newPassword !== confirmNewPassword) {
            displayMessage('New passwords do not match.', 'error');
            toggleLoadingState(false, changePasswordBtn, changeSpinner);
            return;
        }

        try {
            const { data: student, error: fetchError } = await supabase
                .from('students')
                .select('roll, passkey')
                .eq('roll', roll)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (!student || student.passkey !== oldPassword) {
                displayMessage('Incorrect roll number or old password.', 'error');
            } else {
                const { error: updateError } = await supabase
                    .from('students')
                    .update({ passkey: newPassword })
                    .eq('roll', roll);

                if (updateError) throw updateError;

                displayMessage('Password changed successfully! You can now log in.', 'success');
                changePasswordForm.reset();
                setTimeout(() => {
                    changePasswordForm.style.display = 'none';
                    displayMessage('');
                }, 2000);
            }
        } catch (err) {
            console.error('Password change error:', err);
            displayMessage('An error occurred while changing the password.', 'error');
        } finally {
            toggleLoadingState(false, changePasswordBtn, changeSpinner);
        }
    });

    // --- UI EVENT LISTENERS ---
    toggleChangePasswordButton?.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = changePasswordForm.style.display === 'none';
        changePasswordForm.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            changePasswordForm.scrollIntoView({ behavior: 'smooth' });
        }
    });

    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const inputId = toggle.getAttribute('data-for');
            const passwordInput = document.getElementById(inputId);
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggle.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                toggle.textContent = '👁️';
            }
        });
    });

    // Initial network status check
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    console.log("login.js: Script execution finished.");
});
