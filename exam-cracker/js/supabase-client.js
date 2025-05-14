// js/supabase-client.js
console.log("supabase-client.js: Initializing global Supabase client...");

const SUPABASE_URL_GLOBAL = 'https://jxsurwtcxvznuqlgnxis.supabase.co';
const SUPABASE_KEY_GLOBAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c3Vyd3RjeHZ6bnVxbGdueGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDA3MjIsImV4cCI6MjA1NTIxNjcyMn0.vSYd0BZK3OgbPvxT1n0uwc_o0xyTuVp1IqdiBtdTdQA';

// Ensure the global 'supabase' object (from the Supabase CDN script) is available
if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
    // Create the client instance and assign it to a global variable
    window.supabaseGlobalClient = supabase.createClient(SUPABASE_URL_GLOBAL, SUPABASE_KEY_GLOBAL);
    console.log("supabase-client.js: Global Supabase client created as 'window.supabaseGlobalClient'.");
} else {
    console.error("supabase-client.js: Supabase CDN script not loaded before this script, or 'supabase' object is not defined. Cannot create global client.");
    // You might want to throw an error here or have a fallback if this is critical
    alert("Critical error: Supabase library not loaded. App cannot function.");
}