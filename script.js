// ===================== FIREBASE IMPORTS =====================
import {
getFirestore,
collection,
addDoc,
getDocs,
query,
orderBy,
serverTimestamp,
where,
doc,
updateDoc,
arrayUnion,
deleteDoc,
increment,
limit,
getDoc,
setDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

// ===================== CONFIGURATION & SETUP =====================
const API_KEY = "AIzaSyBrdsW85xYL14b9zJIYLjQD9TRFofmaQ4o";
const MODEL = "gemini-2.0-flash";

const firebaseConfig = {
apiKey: "AIzaSyBsnfLkzqo8J7vRbSmPKboHqk6YIevPkdE",
authDomain: "college-chatbot-40056.firebaseapp.com",
projectId: "college-chatbot-40056",
storageBucket: "college-chatbot-40056.firebasestorage.app",
messagingSenderId: "781754344837",
appId: "1:781754344837:web:7c4c89b27b795a958a90ec",
measurementId: "G-QNCX99CMZY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const chatRef = collection(db, "chats");

let cachedCollegeData = null;
let currentChatId = null;
let lastMentionedEvent = null;

// ===================== UI VARIABLES =====================
const chatBody = document.getElementById("chat-body");
const historyList = document.getElementById("history-list");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// ===================== AUTHENTICATION CHECK =====================
// Check user authentication state and initialize UI
onAuthStateChanged(auth, async (user) => {
const userType = sessionStorage.getItem('userType');
const historySection = document.querySelector('.history');

// If not logged in and not a guest, redirect to login page
if (!userType && !user) {
window.location.href = 'login.html';
return;
}

// If user is a guest but not authenticated, sign in anonymously
if (userType === 'guest' && !user) {
try {
const result = await signInAnonymously(auth);
console.log("Guest user signed in anonymously:", result.user.uid);
// Store the anonymous UID in sessionStorage
sessionStorage.setItem('userId', result.user.uid);
} catch (error) {
console.error("Error signing in guest anonymously:", error);
// Handle error or fallback
}
}

// If user is a guest, hide the history section
if (userType === 'guest' && historySection) {
historySection.style.display = 'none';
} else if (historySection) {
historySection.style.display = 'block';
}

// Update welcome message based on user type
const welcomeCard = document.querySelector('.welcome-card');
if (welcomeCard) {
const welcomeContent = welcomeCard.querySelector('.welcome-content');
if (userType === 'member') {
const userName = sessionStorage.getItem('userName');
const userRole = sessionStorage.getItem('userRole');
welcomeContent.innerHTML = `
<p class="welcome-intro">
Welcome back, <strong>${userName}</strong>! I'm your official AI assistant for
<strong>Sentral Digital College Kuala Lumpur (SDCKL)</strong>.
As a ${userRole}, you have access to all features including chat history.
</p>

<p class="welcome-description">
Ask me about courses, events, campus facilities, and more. All information is sourced
from our official website <a href="https://sdckl.edu.my" target="_blank">sdckl.edu.my</a>.
</p>

<p class="welcome-cta">Start by asking me a question, or explore our quick contact options in the sidebar!</p>
`;
} else if (userType === 'guest') {
const name = sessionStorage.getItem('guestName');
const purpose = sessionStorage.getItem('guestPurpose');
welcomeContent.innerHTML = `
<p class="welcome-intro">
Welcome, <strong>${name}</strong>! I'm your official AI assistant for
<strong>Sentral Digital College Kuala Lumpur (SDCKL)</strong>.
Thank you for visiting us as a ${purpose}.
</p>

<p class="welcome-description">
Ask me about courses, events, campus facilities, and more. All information is sourced
from our official website <a href="https://sdckl.edu.my" target="_blank">sdckl.edu.my</a>.
</p>

<p class="welcome-cta">Start by asking me a question, or explore our quick contact options in the sidebar!</p>
`;
}
}

// Set up logout button
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
logoutBtn.addEventListener('click', async () => {
try {
if (user) {
await signOut(auth);
}
sessionStorage.clear();
window.location.href = 'index.html';
} catch (error) {
console.error('Logout error:', error);
sessionStorage.clear();
window.location.href = 'index.html';
}
});
}

// Initialize chat features
await initializeChatFeatures();

// Update last login time for authenticated users
if (user) {
const userId = sessionStorage.getItem('userId');
if (userId) {
try {
await updateDoc(doc(db, "users", userId), {
lastLogin: serverTimestamp()
});
} catch (error) {
console.error("Error updating last login:", error);
}
}
}
});

// Initialize chat features after authentication check
async function initializeChatFeatures() {
// Load history and top searches
await renderHistoryList();
await renderTopQueries();

// Set up event listeners for message sending
if (sendBtn) {
sendBtn.addEventListener('click', handleUserMessage);
}

if (input) {
input.addEventListener("keypress", (e) => {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
handleUserMessage();
}
});
}
}

// ===================== GUEST LOGIN FUNCTION =====================
async function loginAsGuest(name, purpose) {
try {
// Sign in anonymously with Firebase
const result = await signInAnonymously(auth);
console.log("Guest user signed in anonymously:", result.user.uid);
  
// Store guest info in sessionStorage
sessionStorage.setItem('userType', 'guest');
sessionStorage.setItem('guestName', name);
sessionStorage.setItem('guestPurpose', purpose);
sessionStorage.setItem('userId', result.user.uid); // Store the anonymous UID
  
// Redirect to chat page
window.location.href = 'chat.html';
} catch (error) {
console.error("Error with guest login:", error);
// Handle error
}
}

// ===================== THEME MANAGEMENT =====================
function getSystemTheme() {
return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
document.body.classList.remove('dark', 'light');
let actualTheme = theme;

if (theme === 'auto') {
actualTheme = getSystemTheme();
}

if (actualTheme === 'dark') {
document.body.classList.add('dark');
} else {
document.body.classList.add('light');
}

localStorage.setItem('theme', theme);

setTimeout(() => {
const themeSelect = document.getElementById("theme-select");
if (themeSelect) {
themeSelect.value = theme;
}
}, 0);
}

// Function to show "Go to Homepage for Live Chat" message
function showLiveChatOption() {
const messageContainer = document.createElement('div');
messageContainer.className = 'message-container';

const message = document.createElement('div');
message.className = 'message bot';
message.innerHTML = `
I'm sorry, I couldn't find an answer to your question.
For live support with a human agent, please return to the homepage and click "Live Chat with Agent".
`;

const homepageButton = document.createElement('button');
homepageButton.className = 'homepage-btn';
homepageButton.textContent = 'Go to Homepage';
homepageButton.onclick = () => {
window.location.href = 'index.html';
};

messageContainer.appendChild(message);
messageContainer.appendChild(homepageButton);
chatBody.appendChild(messageContainer);
chatBody.scrollTop = chatBody.scrollHeight;
}

// Add this CSS style to your style.css
const style = document.createElement('style');
style.textContent = `
.message-container {
display: flex;
flex-direction: column;
align-items: flex-start;
margin-bottom: 15px;
}

.homepage-btn {
background-color: var(--primary-color);
color: white;
border: none;
border-radius: 18px;
padding: 8px 16px;
font-size: 14px;
font-weight: 600;
cursor: pointer;
transition: all 0.3s ease;
margin-top: 8px;
}

.homepage-btn:hover {
background-color: var(--secondary-color);
transform: translateY(-1px);
}
`;
document.head.appendChild(style);

function initializeTheme() {
const savedTheme = localStorage.getItem('theme') || 'auto';
applyTheme(savedTheme);

const themeSelect = document.getElementById("theme-select");
if (themeSelect) {
themeSelect.value = savedTheme;
themeSelect.addEventListener("change", (e) => {
applyTheme(e.target.value);
});
}

if (window.matchMedia) {
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const handleSystemThemeChange = () => {
const currentTheme = localStorage.getItem('theme') || 'auto';
if (currentTheme === 'auto') {
applyTheme('auto');
}
};

if (mediaQuery.addEventListener) {
mediaQuery.addEventListener('change', handleSystemThemeChange);
} else if (mediaQuery.addListener) {
mediaQuery.addListener(handleSystemThemeChange);
}
}
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initializeTheme);
} else {
initializeTheme();
}

// Add this after your existing event listeners
document.addEventListener('DOMContentLoaded', () => {
const newChatBtn = document.getElementById('new-chat-btn');

if (newChatBtn) {
newChatBtn.addEventListener('click', () => {
// Clear current chat
const chatBody = document.getElementById('chat-body');
if (chatBody) {
// Keep only the welcome card
const welcomeCard = chatBody.querySelector('.welcome-card');
chatBody.innerHTML = '';
if (welcomeCard) {
chatBody.appendChild(welcomeCard);
}
}

// Reset current chat ID
currentChatId = null;

// Show notification
const notification = document.createElement('div');
notification.className = 'notification';
notification.textContent = 'New chat started';
notification.style.cssText = `
position: fixed;
top: 20px;
right: 20px;
background-color: var(--accent-gradient);
color: white;
padding: 12px 20px;
border-radius: 8px;
box-shadow: var(--shadow-md);
z-index: 1000;
animation: slideIn 0.3s ease-out;
`;

document.body.appendChild(notification);

// Remove notification after 3 seconds
setTimeout(() => {
notification.style.animation = 'slideOut 0.3s ease-out forwards';
setTimeout(() => {
document.body.removeChild(notification);
}, 300);
}, 3000);
});
}
});

// Add these animations to your CSS
const animationStyle = document.createElement('style');
animationStyle.textContent = `
@keyframes slideIn {
from {
transform: translateX(100%);
opacity: 0;
}
to {
transform: translateX(0);
opacity: 1;
}
}

@keyframes slideOut {
from {
transform: translateX(0);
opacity: 1;
}
to {
transform: translateX(100%);
opacity: 0;
}
}
`;
document.head.appendChild(animationStyle);

// ===================== HELPER FUNCTIONS =====================
function similarity(a, b) {
const longer = a.length > b.length ? a : b;
const shorter = a.length > b.length ? b : a;
const longerLength = longer.length;
if (longerLength === 0) return 1.0;

const costs = [];
for (let i = 0; i <= longer.length; i++) {
let lastValue = i;
for (let j = 0; j <= shorter.length; j++) {
if (i === 0) costs[j] = j;
else if (j > 0) {
let newValue = costs[j - 1];
if (longer.charAt(i - 1) !== shorter.charAt(j - 1))
newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
costs[j - 1] = lastValue;
lastValue = newValue;
}
}
if (i > 0) costs[shorter.length] = lastValue;
}
return (longerLength - costs[shorter.length]) / parseFloat(longerLength);
}

async function loadCollegeData() {
  if (cachedCollegeData) return cachedCollegeData;
  try {
    const response = await fetch("collegeData.json");
    if (!response.ok) {
      throw new Error(`Failed to load college data: ${response.status}`);
    }
    cachedCollegeData = await response.json();
    return cachedCollegeData;
  } catch (err) {
    console.error("❌ Error loading college data:", err);
    return { 
      college_info: {},
      programmes: { available: [], partnerships: {} },
      events: [],
      rules: [],
      lecturer_queries: {},
      staff_non_teaching: {},
      parent_information: {},
      student_council: []
    };
  }
}

function correctQuery(message, data) {
const msg = message.toLowerCase();
const words = msg.split(/\s+/);
let correctedMessage = message;
let hasCorrection = false;

for (const ev of data.events) {
const eventName = ev.name.toLowerCase();
for (const word of words) {
const score = similarity(word, eventName);
if (score > 0.7 && word !== eventName) {
const regex = new RegExp(`\\b${word}\\b`, 'gi');
correctedMessage = correctedMessage.replace(regex, ev.name);
hasCorrection = true;
console.log(`✅ Corrected typo: "${word}" → "${ev.name}"`);
}
}
}

const commonTypos = {
"halowen": "Halloween",
"hallowen": "Halloween",
"hallowean": "Halloween",
"deepavali": "Deepavali",
"dipavali": "Deepavali",
"divali": "Deepavali",
"diwali": "Deepavali",
"olympic": "Olympic",
"olympics": "Olympic",
"sportsday": "Sports Day",
"sport day": "Sports Day"
};

for (const [typo, correct] of Object.entries(commonTypos)) {
const regex = new RegExp(`\\b${typo}\\b`, 'gi');
if (regex.test(correctedMessage)) {
correctedMessage = correctedMessage.replace(regex, correct);
hasCorrection = true;
console.log(`✅ Corrected common typo: "${typo}" → "${correct}"`);
}
}

return { correctedMessage, hasCorrection };
}

function handleCollegeQuery(message, data) {
  const msg = message.toLowerCase();
  const words = msg.split(/\s+/);
  
  // Check if the message contains pronouns or references to previous topics
  const hasPronoun = msg.includes("it") || msg.includes("that") || msg.includes("this");
  
  // If there's a pronoun and we have a previously mentioned event, use it
  if (hasPronoun && lastMentionedEvent) {
    if (msg.includes("when") || msg.includes("date"))
      return { type: "date", event: lastMentionedEvent };
    if (msg.includes("where") || msg.includes("location") || msg.includes("held"))
      return { type: "location", event: lastMentionedEvent };
    if (msg.includes("what") || msg.includes("info") || msg.includes("about"))
      return { type: "info", event: lastMentionedEvent };
      
    return { type: "general", event: lastMentionedEvent };
  }

  // Check for college information queries
  if (msg.includes("contact") || msg.includes("phone") || msg.includes("email") || msg.includes("address")) {
    return { type: "contact", content: data.college_info };
  }
  
  // Check for programme information
  if (msg.includes("programme") || msg.includes("course") || msg.includes("diploma")) {
    if (msg.includes("logistic") || msg.includes("supply chain")) {
      const programme = data.programmes.available.find(p => p.code === "DLS");
      return { type: "programme", content: programme };
    }
    if (msg.includes("business") || msg.includes("administration")) {
      const programme = data.programmes.available.find(p => p.code === "DBA");
      return { type: "programme", content: programme };
    }
    if (msg.includes("account")) {
      const programme = data.programmes.available.find(p => p.code === "DAC");
      return { type: "programme", content: programme };
    }
    if (msg.includes("information technology") || msg.includes("it")) {
      const programme = data.programmes.available.find(p => p.code === "DIT");
      return { type: "programme", content: programme };
    }
    if (msg.includes("software") || msg.includes("engineering")) {
      const programme = data.programmes.available.find(p => p.code === "DSE");
      return { type: "programme", content: programme };
    }
    
    // If no specific programme mentioned, return all programmes
    return { type: "programmes", content: data.programmes.available };
  }
  
  // Check for student council queries - ENHANCED VERSION
  if (msg.includes("student council") || msg.includes("src") || msg.includes("president") || 
      msg.includes("vice president") || msg.includes("secretary") || msg.includes("treasurer") ||
      msg.includes("head of sports") || msg.includes("welfare") || msg.includes("media") || 
      msg.includes("pr") || msg.includes("international")) {
    
    // Check for specific positions
    if (msg.includes("president")) {
      const president = data.student_council.find(m => m.position === "President");
      return { type: "council_member", content: president };
    }
    if (msg.includes("vice president") || msg.includes("vp")) {
      const vp = data.student_council.find(m => m.position === "Vice President");
      return { type: "council_member", content: vp };
    }
    if (msg.includes("secretary")) {
      const secretary = data.student_council.find(m => m.position === "Secretary");
      return { type: "council_member", content: secretary };
    }
    if (msg.includes("treasurer") || msg.includes("finance")) {
      const treasurer = data.student_council.find(m => m.position === "Treasurer");
      return { type: "council_member", content: treasurer };
    }
    if (msg.includes("sports")) {
      const headOfSports = data.student_council.find(m => m.position === "Head Of Sports");
      return { type: "council_member", content: headOfSports };
    }
    if (msg.includes("welfare") || msg.includes("student welfare")) {
      const headOfWelfare = data.student_council.find(m => m.position === "Head Of Students' Welfare");
      return { type: "council_member", content: headOfWelfare };
    }
    if (msg.includes("media") || msg.includes("pr") || msg.includes("public relations")) {
      const headOfMedia = data.student_council.find(m => m.position === "Head Of Media and Public Relations");
      return { type: "council_member", content: headOfMedia };
    }
    if (msg.includes("international")) {
      const headOfInternational = data.student_council.find(m => m.position === "Head of International Students' Affairs");
      return { type: "council_member", content: headOfInternational };
    }
    
    // If no specific position mentioned, return all council members
    return { type: "student_council", content: data.student_council };
  }
  
  // Check for student council member names
  for (const member of data.student_council) {
    // Check if any word in the message matches the member's name
    for (const word of words) {
      if (member.name.toLowerCase().includes(word) && word.length > 2) {
        return { type: "council_member", content: member };
      }
    }
    
    // Check if any word in the message matches the member's keywords
    for (const keyword of member.keywords) {
      for (const word of words) {
        if (word === keyword.toLowerCase()) {
          return { type: "council_member", content: member };
        }
      }
    }
  }
  
  // Check for lecturer queries
  if (msg.includes("lecturer") || msg.includes("attendance") || msg.includes("hop") || msg.includes("hoa")) {
    if (msg.includes("attendance")) {
      return { type: "lecturer_query", content: data.lecturer_queries.attendance_verification };
    }
    if (msg.includes("hop") || msg.includes("head of programme")) {
      return { type: "lecturer_query", content: data.lecturer_queries.programme_head };
    }
    if (msg.includes("classroom") || msg.includes("room booking")) {
      return { type: "lecturer_query", content: data.lecturer_queries.classroom_booking };
    }
    if (msg.includes("leave") || msg.includes("mc") || msg.includes("absence")) {
      return { type: "lecturer_query", content: data.lecturer_queries.leave_policy };
    }
  }
  
  // Check for parent information
  if (msg.includes("parent") || msg.includes("hostel") || msg.includes("application")) {
    if (msg.includes("hostel") || msg.includes("accommodation")) {
      return { type: "parent_info", content: data.parent_information.hostel_security };
    }
    if (msg.includes("application") || msg.includes("apply") || msg.includes("registration")) {
      return { type: "parent_info", content: data.parent_information.application_process };
    }
    if (msg.includes("meeting") || msg.includes("visit")) {
      return { type: "parent_info", content: data.parent_information.meeting_policy };
    }
  }
  
  // Check for staff queries
  if (msg.includes("staff") || msg.includes("registry") || msg.includes("maintenance") || msg.includes("hoa")) {
    if (msg.includes("registry") || msg.includes("form") || msg.includes("application")) {
      return { type: "staff", content: data.staff_non_teaching.contacts.registry };
    }
    if (msg.includes("maintenance") || msg.includes("repair")) {
      return { type: "staff", content: data.staff_non_teaching.contacts.maintenance };
    }
    if (msg.includes("hoa") || msg.includes("academic")) {
      return { type: "staff", content: data.staff_non_teaching.contacts.hoa };
    }
    if (msg.includes("visitor") || msg.includes("guest")) {
      return { type: "staff", content: data.staff_non_teaching.visitor_policy };
    }
  }

  // Event queries (existing code)
  let bestMatch = null;
  let bestScore = 0;

  for (const ev of data.events) {
    for (const kw of ev.keywords) {
      for (const word of words) {
        const score = similarity(word, kw.toLowerCase());
        if (score > bestScore) {
          bestScore = score;
          bestMatch = ev;
        }
      }
    }
  }

  if (bestScore > 0.7 && bestMatch) {
    // Store the matched event for future reference
    lastMentionedEvent = bestMatch;
    
    if (msg.includes("when") || msg.includes("date"))
      return { type: "date", event: bestMatch };
    if (msg.includes("where") || msg.includes("location") || msg.includes("held"))
      return { type: "location", event: bestMatch };
    if (msg.includes("what") || msg.includes("info") || msg.includes("about"))
      return { type: "info", event: bestMatch };

    return { type: "general", event: bestMatch };
  }

  if (msg.includes("rule") || msg.includes("policy"))
    return { type: "rules", content: "📘 College Rules:\n" + data.rules.join("\n") };

  if (msg.includes("event") || msg.includes("competition"))
    return { type: "events", content: "🎉 Upcoming events:\n" + data.events.map(ev => `- ${ev.name}`).join("\n") };

  return null;
}

async function askGeminiStream(prompt, onChunk) {
try {
const res = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${API_KEY}`,
{
method: "POST",
headers: {
"Content-Type": "application/json",
"X-goog-api-key": API_KEY
},
body: JSON.stringify({
contents: [{ role: "user", parts: [{ text: prompt }] }]
})
}
);

if (!res.ok) {
const errorText = await res.text();
console.error(`❌ Gemini API Error: ${res.status}`, errorText);
throw new Error(`API Request failed with status ${res.status}`);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let fullText = "";
let buffer = "";

while (true) {
const { done, value } = await reader.read();
if (done) break;

buffer += decoder.decode(value, { stream: true });
const lines = buffer.split("\n");
buffer = lines.pop() || "";

for (const line of lines) {
if (!line.trim()) continue;

try {
let jsonStr = line.trim();
if (line.startsWith("data: ")) {
jsonStr = line.slice(6).trim();
}
if (!jsonStr || jsonStr === "[DONE]") continue;

const data = JSON.parse(jsonStr);
let chunk = "";
if (data.candidates && data.candidates[0]) {
const candidate = data.candidates[0];
if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
chunk = candidate.content.parts[0].text || "";
}
}

if (chunk) {
fullText += chunk;
onChunk(chunk, fullText);
}
} catch (e) {
continue;
}
}
}

if (buffer.trim()) {
try {
let jsonStr = buffer.trim();
if (jsonStr.startsWith("data: ")) {
jsonStr = jsonStr.slice(6).trim();
}
if (jsonStr && jsonStr !== "[DONE]") {
const data = JSON.parse(jsonStr);
let chunk = "";
if (data.candidates && data.candidates[0]) {
const candidate = data.candidates[0];
if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
chunk = candidate.content.parts[0].text || "";
}
}
if (chunk) {
fullText += chunk;
onChunk(chunk, fullText);
}
}
} catch (e) {}
}

return fullText || "";
} catch (err) {
console.error("❌ Gemini API Streaming Error:", err);
throw err;
}
}

async function askGemini(prompt) {
try {
const res = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
{
method: "POST",
headers: {
"Content-Type": "application/json",
"X-goog-api-key": API_KEY
},
body: JSON.stringify({
contents: [{ role: "user", parts: [{ text: prompt }] }]
})
}
);

if (!res.ok) {
const errorText = await res.text();
console.error(`❌ Gemini API Error: ${res.status}`, errorText);
throw new Error(`API Request failed with status ${res.status}`);
}

const data = await res.json();
if (data.error) {
throw new Error(`Gemini API Error: ${data.error.message}`);
}

return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
} catch (err) {
console.error("❌ Gemini API Error:", err);
return null;
}
}

const SDCKL_OFFICIAL_INFO = `
SDCKL (Sentral Digital College Kuala Lumpur) Official Information - Reference: https://sdckl.edu.my

=== INSTITUTION OVERVIEW ===
Full Name: Sentral Digital College Kuala Lumpur
Abbreviation: SDCKL
Website: https://sdckl.edu.my

Location & Address:
- Address: No.6-1, Jalan Tun Sambanthan 3, Brickfields, 50470 Kuala Lumpur, Malaysia

=== CONTACT INFORMATION ===
- Phone: +6012-8194811
- Email: [email protected]
- Website: https://sdckl.edu.my

For detailed information about programs, fees, entry requirements, and more, please visit our Live chat at homepage
`;

// Function to format response according to the professional template
function formatProfessionalResponse(queryResult) {
  if (!queryResult) return null;

  const openingLine = "Here's the information you requested!\n\n";
  const closingLine = "\n\n💡 For more information, Try our Live chat or visit: https://sdckl.edu.my";

  let middleContent = "";

  if (queryResult.type === "date") {
    middleContent = `📅 ${queryResult.event.name} is on ${queryResult.event.date}`;
  } else if (queryResult.type === "location") {
    middleContent = `📍 ${queryResult.event.name} will be held at ${queryResult.event.location}`;
  } else if (queryResult.type === "info") {
    middleContent = `ℹ️ ${queryResult.event.name}: ${queryResult.event.details}`;
  } else if (queryResult.type === "general") {
    middleContent = `ℹ️ ${queryResult.event.name}\n📅 Date: ${queryResult.event.date}\n📍 Location: ${queryResult.event.location}\nℹ️ ${queryResult.event.details}`;
  } else if (queryResult.type === "rules" || queryResult.type === "events") {
    middleContent = queryResult.content;
  } else if (queryResult.type === "contact") {
    const info = queryResult.content;
    middleContent = `📞 Contact Information for ${info.name}:\n`;
    middleContent += `📱 Phone: ${info.contact.phone}\n`;
    middleContent += `📧 Email: ${info.contact.email.join(", ")}\n`;
    middleContent += `🌐 Website: ${info.contact.website}\n`;
    middleContent += `📍 Address: ${info.location.address}\n`;
    middleContent += `${info.location.description}`;
  } else if (queryResult.type === "programme") {
    const programme = queryResult.content;
    middleContent = `📚 ${programme.name} (${programme.code}):\n`;
    middleContent += `🎯 Focus: ${programme.focus}\n`;
    middleContent += `💼 Career Path: ${programme.career_path}`;
  } else if (queryResult.type === "programmes") {
    middleContent = `📚 Available Programmes at SDCKL:\n`;
    queryResult.content.forEach(programme => {
      middleContent += `\n• ${programme.name} (${programme.code})\n  Focus: ${programme.focus}\n  Career: ${programme.career_path}\n`;
    });
  } else if (queryResult.type === "council_member") {
    const member = queryResult.content;
    middleContent = `👤 ${member.position}:\n`;
    middleContent += `📝 Name: ${member.name}\n`;
    middleContent += `🆔 Student ID: ${member.student_id}`;
  } else if (queryResult.type === "student_council") {
    middleContent = `👥 Student Council Members:\n`;
    queryResult.content.forEach(member => {
      middleContent += `\n• ${member.name} - ${member.position} (${member.student_id})\n`;
    });
  } else if (queryResult.type === "lecturer_query") {
    const query = queryResult.content;
    middleContent = `ℹ️ ${query.contact ? query.contact : ""} ${query.role ? `(${query.role})` : ""}\n`;
    
    if (query.action) {
      middleContent += `🔹 Action: ${query.action}\n`;
    }
    
    if (query.step_1) {
      middleContent += `🔹 Step 1: Contact ${query.step_1.contact} (${query.step_1.role}) to ${query.step_1.action}\n`;
    }
    
    if (query.step_2) {
      middleContent += `🔹 Step 2: ${query.step_2.action}\n`;
      if (query.step_2.note) {
        middleContent += `   Note: ${query.step_2.note}\n`;
      }
    }
    
    if (query.valid_reasons) {
      middleContent += `🔹 Valid Reasons: ${query.valid_reasons.join(", ")}\n`;
    }
    
    if (query.sudden_leave) {
      middleContent += `🔹 For Sudden Leave: ${query.sudden_leave.process}\n`;
      middleContent += `   Required Documents: ${query.sudden_leave.required_documents.join(", ")}\n`;
    }
    
    if (query.planned_leave) {
      middleContent += `🔹 For Planned Leave: ${query.planned_leave.process}\n`;
      middleContent += `   Requirements: ${query.planned_leave.requirements}\n`;
    }
    
    if (query.additional_info) {
      middleContent += `🔹 Additional Information: ${query.additional_info.join(", ")}\n`;
    }
  } else if (queryResult.type === "parent_info") {
    const info = queryResult.content;
    if (info.features) {
      middleContent = `🏠 Hostel Security Features:\n`;
      middleContent += `${info.features.join("\n")}\n`;
      middleContent += `Note: ${info.note}`;
    } else if (info.required_documents) {
      middleContent = `📝 Application Process:\n`;
      middleContent += `Method: ${info.method}\n`;
      middleContent += `Required Documents:\n`;
      info.required_documents.forEach(doc => {
        middleContent += `• ${doc}\n`;
      });
      middleContent += `Form Collection: ${info.form_collection}`;
    } else {
      middleContent = `👥 Parent Meeting Policy:\n`;
      middleContent += `General: ${info.general}\n`;
      middleContent += `For Attendance Matters: Contact ${info.attendance_matters.contact} (${info.attendance_matters.role})\n`;
      middleContent += `For Academic Performance: ${info.academic_performance}\n`;
      middleContent += `Meeting Hours: ${info.meeting_hours}`;
    }
  } else if (queryResult.type === "staff") {
    const staff = queryResult.content;
    if (staff.name) {
      middleContent = `👤 Staff Information:\n`;
      middleContent += `📝 Name: ${staff.name}\n`;
      if (staff.role) middleContent += `🔹 Role: ${staff.role}\n`;
      if (staff.email) middleContent += `📧 Email: ${staff.email}\n`;
      if (staff.location) middleContent += `📍 Location: ${staff.location}\n`;
    } else {
      middleContent = `🏢 Visitor Policy:\n`;
      middleContent += `Passes: ${staff.passes}\n`;
      middleContent += `Process: ${staff.process}\n`;
      middleContent += `Handler: ${staff.handler}`;
    }
  }

  return openingLine + middleContent + closingLine;
}

async function getChatbotReplyStream(userMessage, onChunk) {
  const data = await loadCollegeData();
  const match = handleCollegeQuery(userMessage, data);

  // If we have a direct match from our college data, format it professionally
  if (match) {
    const formattedResponse = formatProfessionalResponse(match);
    if (formattedResponse) {
      onChunk(formattedResponse, formattedResponse);
      return formattedResponse;
    }
  }

  // Otherwise, use Gemini to generate a response
  const generalPrompt = `
You are the official AI assistant for SDCKL (Sentral Digital College Kuala Lumpur). Your role is to provide accurate, comprehensive, and detailed information about SDCKL based on official sources from https://sdckl.edu.my.

CRITICAL INSTRUCTIONS FOR ACCURACY:
1. You are SDCKL's official AI agent - provide professional, accurate, and comprehensive answers
2. ALWAYS reference and base your answers on official SDCKL information provided below and from sdckl.edu.my
3. Give detailed, complete answers - don't give vague responses. Include specific details, requirements, procedures, etc.
4. For questions about entry requirements: Provide detailed requirements, minimum grades needed, documents required, and direct users to sdckl.edu.my for program-specific requirements
5. For questions about fees/financials: Reference that fees vary by program, mention available scholarships/financial aid, and direct users to sdckl.edu.my or contact SDCKL for current fees
6. For questions about diploma programs: Provide comprehensive information about each program, career paths, duration, and refer to sdckl.edu.my for detailed curriculum
7. For questions about locations: Provide full address, area description, public transport access, nearby amenities
8. For questions about events: Reference the events section on sdckl.edu.my and provide general information about the types of events SDCKL organizes
9. For questions about contacts: Provide complete contact information (phone, email, website, address)
10. If you don't have specific information in the provided data, ALWAYS direct users to visit our Live chat at Homepage or go to sdckl.edu.my for the most current and detailed information
11. Provide 3-5 complete, well-elaborated sentences with comprehensive details
12. Use a friendly but professional tone
13. Include relevant website references (sdckl.edu.my) at the end of responses
14. Be thorough - give complete answers covering all aspects of the question
15. For any financial information, entry requirements, or specific program details, always mention that users should verify on sdckl.edu.my or contact SDCKL directly

OFFICIAL SDCKL INFORMATION (Reference: sdckl.edu.my):
 ${JSON.stringify(data, null, 2)}

 ${lastMentionedEvent ? `PREVIOUSLY MENTIONED EVENT: ${lastMentionedEvent.name} on ${lastMentionedEvent.date} at ${lastMentionedEvent.location}` : ''}

USER QUESTION: "${userMessage}"

Now provide a comprehensive, detailed, and accurate response as SDCKL's official AI assistant. Give complete information covering all aspects of the question. Reference specific details from the information provided above. Always end by directing users to sdckl.edu.my for the most current and detailed information, especially for fees, entry requirements, and specific program details.
`;

  try {
    const streamResult = await askGeminiStream(generalPrompt, onChunk);
    if (!streamResult || streamResult.trim() === "") {
      const general = await askGemini(generalPrompt);
      const fallbackResult = general || "I'm here to help with SDCKL information! Visit our Live chat at Homepage or Visit https://sdckl.edu.my ";
      return fallbackResult + `\n\n💡Please conduct our Live chat at Homepage or Visit: https://sdckl.edu.my for more information.`;
    }
    return streamResult;
  } catch (err) {
    console.error("Streaming error:", err);
    const general = await askGemini(generalPrompt);
    const fallbackResult = general || "I'm here to help with SDCKL information! Visit our Live chat at Homepage";
    return fallbackResult + `\n\n💡 Visit: our Live chat at Homepage .`;
  }
}

// ===================== FIRESTORE FUNCTIONS =====================
async function createNewChatSession(initialMessage, correctedMessage) {
  const chatTitle = (correctedMessage || initialMessage).substring(0, 35).trim() +
  ((correctedMessage || initialMessage).length > 35 ? "..." : "");

  try {
    // Get the current user's ID
    const user = auth.currentUser;
    if (!user) {
      console.error("❌ No authenticated user found");
      return;
    }

    const docRef = await addDoc(chatRef, {
      title: chatTitle,
      messages: [],
      timestamp: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      userId: user.uid,  // This will now work for anonymous users too
      userType: sessionStorage.getItem('userType') || 'member' // Track user type
    });

    currentChatId = docRef.id;
    console.log("💬 New chat session created:", chatTitle);
  } catch (err) {
    console.error("❌ New Chat Session Error:", err);
  }
}

async function saveChatMessage(role, message, correctedMessage) {
try {
if (!currentChatId) {
throw new Error("Chat session not initialized.");
}

const chatDoc = doc(db, "chats", currentChatId);
const messageToSave = role === "user" && correctedMessage ? correctedMessage : message;

await updateDoc(chatDoc, {
messages: arrayUnion({ role, message: messageToSave, timestamp: new Date() }),
lastUpdated: serverTimestamp()
});

console.log("💾 Saved:", role, messageToSave);
} catch (err) {
console.error("❌ Firestore Save Error:", err);
throw err;
}
}

async function trackSearchQuery(queryText, correctedQuery) {
const normalizedQuery = (correctedQuery || queryText).toLowerCase().trim().replace(/\s+/g, ' ');
if (!normalizedQuery) return;

const topQueriesDocRef = doc(db, "metadata", "topSearches");

try {
const docSnap = await getDoc(topQueriesDocRef);

if (docSnap.exists()) {
const data = docSnap.data();
if (data[normalizedQuery]) {
await updateDoc(topQueriesDocRef, {
[normalizedQuery]: increment(1)
});
} else {
await updateDoc(topQueriesDocRef, {
[normalizedQuery]: 1
});
}
} else {
await setDoc(topQueriesDocRef, {
[normalizedQuery]: 1
});
}

console.log("✅ Tracked search query:", normalizedQuery);
} catch (err) {
console.error("❌ Search Query Tracking Error:", err);
}
}

async function loadTopQueries() {
const topQueriesDocRef = doc(db, "metadata", "topSearches");
try {
const docSnap = await getDoc(topQueriesDocRef);
if (docSnap.exists()) {
const data = docSnap.data();
const queryCounts = [];

for (const [query, count] of Object.entries(data)) {
queryCounts.push({ query, count });
}

queryCounts.sort((a, b) => b.count - a.count);
return queryCounts.slice(0, 3);
} else {
return [];
}
} catch (err) {
console.error("❌ Failed to load top searches:", err);
return [];
}
}

// ===================== UI FUNCTIONS =====================
function addMessage(text, sender) {
const msgDiv = document.createElement("div");
msgDiv.classList.add("message", sender);
msgDiv.innerHTML = text.replace(/\n/g, "<br>");
chatBody.appendChild(msgDiv);
chatBody.scrollTop = chatBody.scrollHeight;
return msgDiv;
}

function addStreamingMessage() {
const msgDiv = document.createElement("div");
msgDiv.classList.add("message", "bot", "streaming");
msgDiv.innerHTML = "";
chatBody.appendChild(msgDiv);
chatBody.scrollTop = chatBody.scrollHeight;
return msgDiv;
}

function updateStreamingMessage(msgDiv, text) {
msgDiv.innerHTML = text.replace(/\n/g, "<br>");
chatBody.scrollTop = chatBody.scrollHeight;
}

function showTypingIndicator() {
const typingDiv = document.createElement("div");
typingDiv.classList.add("message", "bot", "typing");
typingDiv.innerHTML = '<div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>';
chatBody.appendChild(typingDiv);
chatBody.scrollTop = chatBody.scrollHeight;
return typingDiv;
}

async function renderHistoryList() {
  if (!historyList) return;

  historyList.innerHTML = "";
  
  // Don't try to load history for guests
  const userType = sessionStorage.getItem('userType');
  if (userType === 'guest') {
    return;
  }
  
  // Get the current user's ID
  const user = auth.currentUser;
  if (!user) {
    console.error("❌ No authenticated user found");
    return;
  }
  
  // Query only the chats that belong to the current user
  const q = query(
    chatRef, 
    where("userId", "==", user.uid),
    orderBy("lastUpdated", "desc")
  );
  
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    const li = document.createElement("li");
    li.textContent = "No chat history yet";
    historyList.appendChild(li);
    return;
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const li = document.createElement("li");

    const historyContainer = document.createElement("div");
    historyContainer.className = "history-container";

    const historyItem = document.createElement("span");
    historyItem.className = "history-item";
    historyItem.textContent = data.title;
    historyItem.setAttribute("data-tooltip", "Click to view this chat");

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "🗑 Delete";
    deleteBtn.setAttribute("data-tooltip", "Delete this chat");

    historyItem.onclick = () => {
      chatBody.innerHTML = "";
      (data.messages || []).forEach(msg => addMessage(msg.message, msg.role));
      currentChatId = docSnap.id;
    };

    deleteBtn.onclick = async () => {
      await deleteDoc(doc(db, "chats", docSnap.id));
      if (currentChatId === docSnap.id) {
        currentChatId = null;
        chatBody.innerHTML = "";
      }
      renderHistoryList();
      renderTopQueries();
    };

    historyContainer.appendChild(historyItem);
    historyContainer.appendChild(deleteBtn);
    li.appendChild(historyContainer);
    historyList.appendChild(li);
  });
}


async function renderTopQueries() {
const topQueries = await loadTopQueries();
const topSearchesDiv = document.getElementById("top-searches");

if (!topSearchesDiv) return;

topSearchesDiv.innerHTML = "";

if (topQueries.length === 0) {
topSearchesDiv.innerHTML = "<p style='font-size: 12px; margin-top: 5px; color: #aaa;'>Start searching to see popular questions!</p>";
return;
}

const ul = document.createElement("ul");
ul.style.listStyle = "none";
ul.style.padding = "0";
ul.style.display = "flex";
ul.style.flexWrap = "wrap";
ul.style.gap = "8px";

topQueries.forEach((item) => {
const li = document.createElement("li");
li.textContent = item.query;
li.setAttribute("data-tooltip", `Asked ${item.count} time${item.count > 1 ? 's' : ''}`);

li.onclick = () => {
input.value = item.query;
handleUserMessage();
};

ul.appendChild(li);
});

topSearchesDiv.appendChild(ul);
}

// ===================== MESSAGE HANDLER =====================
async function handleUserMessage() {
if (!input) return;

const text = input.value.trim();
if (!text) return;

const data = await loadCollegeData();
const { correctedMessage, hasCorrection } = correctQuery(text, data);

addMessage(correctedMessage, "user");
input.value = "";

await trackSearchQuery(text, correctedMessage);

if (!currentChatId) {
await createNewChatSession(text, correctedMessage);
if (!currentChatId) return;
}

try {
await saveChatMessage("user", text, correctedMessage);
} catch (saveError) {
console.error("❌ User Message Save Failure:", saveError);
addMessage("⚠️ Error: Failed to save your message. Check console.", "bot");
return;
}

const typingIndicator = showTypingIndicator();

try {
const streamingMsgDiv = addStreamingMessage();
typingIndicator.remove();

let fullReply = "";

const reply = await getChatbotReplyStream(correctedMessage, (chunk, fullText) => {
fullReply = fullText;
updateStreamingMessage(streamingMsgDiv, fullText);
});

if (!fullReply && reply) {
fullReply = reply;
updateStreamingMessage(streamingMsgDiv, reply);
}

streamingMsgDiv.classList.remove("streaming");

const finalReply = fullReply || reply;

if (!finalReply || finalReply.trim() === "") {
streamingMsgDiv.remove();
showLiveChatOption();
return;
}

// Check if the reply indicates no answer was found
if (finalReply.includes("I'm sorry") || finalReply.includes("I don't have information") || finalReply.includes("I can't answer") || finalReply.includes("I don't know")) {
showLiveChatOption();
return;
}

if (!fullReply && reply) {
updateStreamingMessage(streamingMsgDiv, reply);
}

await saveChatMessage("bot", finalReply);
} catch (err) {
typingIndicator.remove();
console.error("❌ Bot Reply Error:", err);
showLiveChatOption();
}

await renderHistoryList();
await renderTopQueries();
}

// ===================== INITIALIZATION =====================
// Update this part of your script.js
window.addEventListener('load', async () => {
currentChatId = null;

// Only render history if user is a member
const userType = sessionStorage.getItem('userType');
if (userType === 'member') {
await renderHistoryList();
}

await renderTopQueries();
});

async function testFirestoreConnection() {
  try {
    // Get the current user's ID
    const user = auth.currentUser;
    if (!user) {
      console.error("❌ No authenticated user found for connection test");
      return;
    }

    const testDocRef = await addDoc(collection(db, "connectionTest"), {
      message: "Firestore connection verified ✅",
      timestamp: new Date(),
      userId: user.uid  // Add user ID to comply with security rules
    });
    console.log("✅ Firestore connection working! Test doc ID:", testDocRef.id);
  } catch (err) {
    console.error("❌ Firestore connection failed:", err);
  }
}