import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsnfLkzqo8J7vRbSmPKboHqk6YIevPkdE",
  authDomain: "college-chatbot-40056.firebaseapp.com",
  projectId: "college-chatbot-40056",
  storageBucket: "college-chatbot-40056.firebasestorage.app",
  messagingSenderId: "781754344837",
  appId: "1:781754344837:web:7c4c89b27b795a958a90ec",
  measurementId: "G-QNCX99CMZY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const memberCard = document.getElementById('member-card');
const guestCard = document.getElementById('guest-card');
const memberForm = document.getElementById('member-form');
const guestForm = document.getElementById('guest-form');
const registerForm = document.getElementById('register-form');
const memberLoginBtn = document.getElementById('member-login-btn');
const guestLoginBtn = document.getElementById('guest-login-btn');
const registerBtn = document.getElementById('register-btn');
const memberBackBtn = document.getElementById('member-back-btn');
const guestBackBtn = document.getElementById('guest-back-btn');
const registerBackBtn = document.getElementById('register-back-btn');
const forgotPasswordLink = document.getElementById('forgot-password');
const registerLink = document.getElementById('register-link');
const memberError = document.getElementById('member-error');
const guestError = document.getElementById('guest-error');
const registerError = document.getElementById('register-error');
const memberSuccess = document.getElementById('member-success');
const registerSuccess = document.getElementById('register-success');

// Email validation function
function isValidEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

// Function to hide all forms and show cards
function showCards() {
  // Hide all forms
  memberForm.classList.remove('active');
  guestForm.classList.remove('active');
  registerForm.classList.remove('active');
  
  // Show all cards
  memberCard.classList.remove('hidden');
  guestCard.classList.remove('hidden');
  
  // Clear messages
  memberError.textContent = '';
  guestError.textContent = '';
  registerError.textContent = '';
  memberSuccess.textContent = '';
  registerSuccess.textContent = '';
}

// Function to show form and hide corresponding card
function showForm(formId, cardId) {
  // Hide all cards first
  memberCard.classList.add('hidden');
  guestCard.classList.add('hidden');
  
  // Hide all forms first
  memberForm.classList.remove('active');
  guestForm.classList.remove('active');
  registerForm.classList.remove('active');
  
  // Show selected form
  setTimeout(() => {
    document.getElementById(formId).classList.add('active');
    // Auto-scroll to the form
    document.getElementById(formId).scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }, 150); // Small delay for smooth transition
}

// Show member login form
memberCard.addEventListener('click', () => {
  showForm('member-form', 'member-card');
});

// Show guest login form
guestCard.addEventListener('click', () => {
  showForm('guest-form', 'guest-card');
});

// Show registration form
registerLink.addEventListener('click', (e) => {
  e.preventDefault();
  showForm('register-form', 'member-card');
});

// Back to options buttons
memberBackBtn.addEventListener('click', () => {
  showCards();
});

guestBackBtn.addEventListener('click', () => {
  showCards();
});

registerBackBtn.addEventListener('click', () => {
  showCards();
});

// Member login
memberLoginBtn.addEventListener('click', async () => {
  const email = document.getElementById('member-email').value;
  const password = document.getElementById('member-password').value;
  
  // Clear previous messages
  memberError.textContent = '';
  memberSuccess.textContent = '';
  
  // Basic validation
  if (!email || !password) {
    memberError.textContent = 'Please fill in all fields';
    return;
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    memberError.textContent = 'Please enter a valid email address';
    return;
  }
  
  // Show loading state
  memberLoginBtn.disabled = true;
  memberLoginBtn.innerHTML = '<span class="loading"></span> Logging in...';
  
  try {
    // Sign in with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    
    // Store user info in sessionStorage
    sessionStorage.setItem('userType', 'member');
    sessionStorage.setItem('userEmail', email);
    sessionStorage.setItem('userName', userData?.name || email);
    sessionStorage.setItem('userRole', userData?.role || 'member');
    sessionStorage.setItem('userId', user.uid);
    
    // Show success message
    memberSuccess.textContent = 'Login successful! Redirecting...';
    
    // Redirect to chatbot after a short delay
    setTimeout(() => {
      window.location.href = 'chatbot.html';
    }, 1500);
    
  } catch (error) {
    console.error('Login error:', error);
    memberError.textContent = getErrorMessage(error.code);
  } finally {
    // Reset button state
    memberLoginBtn.disabled = false;
    memberLoginBtn.textContent = 'Login';
  }
});

// Member registration
registerBtn.addEventListener('click', async () => {
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const role = document.getElementById('register-role').value;
  const studentId = document.getElementById('register-student-id').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  // Clear previous messages
  registerError.textContent = '';
  registerSuccess.textContent = '';
  
  // Basic validation
  if (!name || !email || !role || !studentId || !password || !confirmPassword) {
    registerError.textContent = 'Please fill in all fields';
    return;
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    registerError.textContent = 'Please enter a valid email address';
    return;
  }
  
  // Validate password
  if (password.length < 6) {
    registerError.textContent = 'Password must be at least 6 characters long';
    return;
  }
  
  if (password !== confirmPassword) {
    registerError.textContent = 'Passwords do not match';
    return;
  }
  
  // Show loading state
  registerBtn.disabled = true;
  registerBtn.innerHTML = '<span class="loading"></span> Registering...';
  
  try {
    // Create user with Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save additional user data to Firestore
    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: email,
      role: role,
      studentId: studentId,
      createdAt: new Date(),
      lastLogin: new Date()
    });
    
    // Store user info in sessionStorage
    sessionStorage.setItem('userType', 'member');
    sessionStorage.setItem('userEmail', email);
    sessionStorage.setItem('userName', name);
    sessionStorage.setItem('userRole', role);
    sessionStorage.setItem('userId', user.uid);
    
    // Show success message
    registerSuccess.textContent = 'Registration successful! Redirecting...';
    
    // Redirect to chatbot after a short delay
    setTimeout(() => {
      window.location.href = 'chatbot.html';
    }, 1500);
    
  } catch (error) {
    console.error('Registration error:', error);
    registerError.textContent = getErrorMessage(error.code);
  } finally {
    // Reset button state
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register';
  }
});

// Password visibility toggle functionality
document.addEventListener('DOMContentLoaded', function() {
  const passwordToggles = document.querySelectorAll('.password-toggle');
  
  passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const passwordInput = document.getElementById(targetId);
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        this.innerHTML = '<i class="fas fa-eye-slash"></i>';
      } else {
        passwordInput.type = 'password';
        this.innerHTML = '<i class="fas fa-eye"></i>';
      }
    });
  });
});

// Forgot password
forgotPasswordLink.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('member-email').value;
  
  if (!email) {
    memberError.textContent = 'Please enter your email address first';
    return;
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    memberError.textContent = 'Please enter a valid email address';
    return;
  }
  
  try {
    await sendPasswordResetEmail(auth, email);
    memberSuccess.textContent = 'Password reset email sent! Please check your inbox.';
  } catch (error) {
    console.error('Password reset error:', error);
    memberError.textContent = getErrorMessage(error.code);
  }
});

// Guest login
guestLoginBtn.addEventListener('click', () => {
  const name = document.getElementById('guest-name').value;
  const email = document.getElementById('guest-email').value;
  const purpose = document.getElementById('guest-purpose').value;
  
  // Basic validation
  if (!name || !email) {
    guestError.textContent = 'Please fill in all required fields';
    return;
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    guestError.textContent = 'Please enter a valid email address';
    return;
  }
  
  // Store guest info in sessionStorage
  sessionStorage.setItem('userType', 'guest');
  sessionStorage.setItem('guestName', name);
  sessionStorage.setItem('guestEmail', email);
  sessionStorage.setItem('guestPurpose', purpose);
  
  // Redirect to chatbot
  window.location.href = 'chatbot.html';
});

// Helper function to get user-friendly error messages
function getErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose a stronger password';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    default:
      return 'An error occurred. Please try again';
  }
}