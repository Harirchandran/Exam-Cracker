// js/login.js

// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', () => {
    console.log("login.js: DOM fully loaded and parsed.");
    // --- AUTO-REDIRECT IF ALREADY LOGGED IN ---

    const storedRollForRedirect = localStorage.getItem('roll');
    if (storedRollForRedirect) {
        console.log("login.js: User already logged in (roll found in localStorage). Redirecting to dashboard.");
        window.location.href = 'dashboard.html';
        return; // Stop further execution of login page scripts if redirecting
    }
    // If not redirected, proceed with login page setup:

    // Access the global Supabase client instance
    const supabase = window.supabaseGlobalClient;

    if (!supabase) {
        console.error("login.js: Global Supabase client (window.supabaseGlobalClient) is not available. Halting script.");
        alert("A critical error occurred (Supabase client not found). Please refresh or contact support.");
        return; // Stop execution if Supabase client isn't there
    }
    console.log("login.js: Supabase client obtained successfully.");
    

    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton'); // Make sure your login button has id="loginButton"
    const loginSpinner = document.getElementById('loginSpinner');
    const rollInput = document.getElementById('roll');
    const passwordInput = document.getElementById('password');

    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changeSpinner = document.getElementById('changeSpinner');
    const rollChangeInput = document.getElementById('rollChange');
    const oldPasswordInput = document.getElementById('oldPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const toggleChangePasswordButton = document.getElementById('toggleChangePassword');
   
    const loginNetworkBanner = document.getElementById('loginNetworkBanner');

function updateLoginNetworkBanner() {
    const isOffline = !navigator.onLine;

    if (loginNetworkBanner) {
        loginNetworkBanner.style.display = isOffline ? 'block' : 'none';
    }

    // Only disable if inputs/buttons are visible (i.e., not in the middle of loading)
    if (loginButton) loginButton.disabled = isOffline;
    if (changePasswordBtn) changePasswordBtn.disabled = isOffline;
}

window.addEventListener('online', updateLoginNetworkBanner);
window.addEventListener('offline', updateLoginNetworkBanner);
updateLoginNetworkBanner(); // Initial check


    // --- AUTO-FILL LOGIN FORM ---
    // This part runs as soon as the script loads, not necessarily waiting for DOMContentLoaded
    // but since rollInput and passwordInput are fetched inside DOMContentLoaded, this is fine.
    const storedRoll = localStorage.getItem('roll');
    const storedPassword = localStorage.getItem('password'); // Be cautious with storing passwords
    if (rollInput && storedRoll) rollInput.value = storedRoll;
    if (passwordInput && storedPassword) passwordInput.value = storedPassword;


    // --- LOGIN FORM SUBMISSION ---
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (loginSpinner) loginSpinner.style.display = 'inline-block';
            if (loginButton) loginButton.disabled = true;
            
            const roll = rollInput.value.trim();
            const password = passwordInput.value.trim();

            if (!roll || !password) {
                alert('Please fill in both roll number and password.');
                if (loginSpinner) loginSpinner.style.display = 'none';
                if (loginButton) loginButton.disabled = false;
                return;
            }
            
            try {
                const { data, error } = await supabase
                .from('students')
                .select('roll, passkey') // Only select what's needed
                .eq('roll', roll)
                .single(); 

                if (error && error.code !== 'PGRST116') { 
                throw error; 
                }

                if (!data || data.passkey !== password) { // **SECURITY RISK: Plain text password comparison**
                alert('Invalid roll number or password.');
                } else {
                localStorage.setItem('roll', roll);
                localStorage.setItem('password', password); 
                alert('Login successful! Redirecting to dashboard...');
                window.location.href = 'dashboard.html';
                return; 
                }
            } catch(err) {
                console.error('login.js: Login error:', err);
                alert('An error occurred during login. Please check console for details.');
            }
            if (loginSpinner) loginSpinner.style.display = 'none';
            if (loginButton) loginButton.disabled = false;
        });
    } else {
        console.warn("login.js: Login form 'loginForm' not found in the DOM.");
    }

    // --- TOGGLE CHANGE PASSWORD FORM ---
    if (toggleChangePasswordButton && changePasswordForm) {
        toggleChangePasswordButton.addEventListener('click', function() {
        changePasswordForm.style.display = (changePasswordForm.style.display === 'none' || changePasswordForm.style.display === '') 
            ? 'block' 
            : 'none';
        });
    } else {
        console.warn("login.js: Toggle button or change password form not found.");
    }

    // --- CHANGE PASSWORD FORM SUBMISSION ---
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (changeSpinner) changeSpinner.style.display = 'inline-block';
            if (changePasswordBtn) changePasswordBtn.disabled = true;
            
            const roll = rollChangeInput.value.trim();
            const oldPassword = oldPasswordInput.value.trim();
            const newPassword = newPasswordInput.value.trim();
            const confirmNewPassword = confirmNewPasswordInput.value.trim();
            
            if (!roll || !oldPassword || !newPassword || !confirmNewPassword) {
                alert('Please fill in all fields for password change.');
                if (changeSpinner) changeSpinner.style.display = 'none';
                if (changePasswordBtn) changePasswordBtn.disabled = false;
                return;
            }

            if (newPassword.length < 6) {
                alert('New password must be at least 6 characters long.');
                if (changeSpinner) changeSpinner.style.display = 'none';
                if (changePasswordBtn) changePasswordBtn.disabled = false;
                return;
            }
            
            if (newPassword !== confirmNewPassword) {
                alert('New passwords do not match.');
                if (changeSpinner) changeSpinner.style.display = 'none';
                if (changePasswordBtn) changePasswordBtn.disabled = false;
                return;
            }
            
            try {
                const { data: student, error: fetchError } = await supabase
                .from('students')
                .select('roll, passkey')
                .eq('roll', roll)
                .single();

                if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

                if (!student || student.passkey !== oldPassword) { // **SECURITY RISK: Plain text password comparison**
                alert('Incorrect roll number or old password. Please try again.');
                } else {
                const { error: updateError } = await supabase
                    .from('students')
                    .update({ passkey: newPassword }) // **SECURITY RISK: Storing new plain text password**
                    .eq('roll', roll);

                if (updateError) throw updateError;

                alert('Password changed successfully!');
                localStorage.setItem('password', newPassword); 
                changePasswordForm.reset(); 
                changePasswordForm.style.display = 'none'; 
                }
            } catch(err) {
                console.error('login.js: Password change error:', err);
                alert('An error occurred while changing password. Please check console.');
            }
            if (changeSpinner) changeSpinner.style.display = 'none';
            if (changePasswordBtn) changePasswordBtn.disabled = false;
        });
    } else {
        console.warn("login.js: Change password form 'changePasswordForm' not found in the DOM.");
    }

    console.log("login.js: Script execution finished.");
}); // End of DOMContentLoaded