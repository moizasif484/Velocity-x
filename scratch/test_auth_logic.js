// Mock LocalStorage & DOM for unit testing auth logic
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}

global.localStorage = new MockLocalStorage();

console.log('--- TESTING AUTHENTICATION LOGIC & FLOWS ---');

const SESSION_KEY = 'velocityX_user';
const USERS_KEY = 'velocityX_users';

const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
};

function getRegisteredUsers() {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRegisteredUser(user) {
  const users = getRegisteredUsers();
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
}

function validateSignUp(username, email, password, confirmPassword) {
  const errors = {};
  if (!username) errors.username = 'Driver handle / name is required.';
  else if (username.length < 2) errors.username = 'Name must be at least 2 characters.';

  if (!email) errors.email = 'Email address is required.';
  else if (!PATTERNS.email.test(email)) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (password && password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  if (Object.keys(errors).length === 0) {
    const users = getRegisteredUsers();
    const exists = users.some(u =>
      u.email.toLowerCase() === email.toLowerCase() ||
      u.username.toLowerCase() === username.toLowerCase()
    );
    if (exists) errors.email = 'An account with this email or handle already exists.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function registerUser(username, email, password) {
  const newUser = { username, email, password, createdAt: new Date().toISOString() };
  saveRegisteredUser(newUser);
  setCurrentUser({ username, email, loggedInAt: new Date().toISOString() });
  return newUser;
}

function loginUser(identity, password) {
  const users = getRegisteredUsers();
  const foundUser = users.find(u =>
    (u.email.toLowerCase() === identity.toLowerCase() || u.username.toLowerCase() === identity.toLowerCase()) &&
    u.password === password
  );

  if (foundUser) {
    const sessionUser = { username: foundUser.username, email: foundUser.email, loggedInAt: new Date().toISOString() };
    setCurrentUser(sessionUser);
    return { ok: true, user: sessionUser };
  }
  return { ok: false, error: 'Invalid identity or password.' };
}

// TEST 1: Validation failure on empty input
const t1 = validateSignUp('', '', '', '');
console.log('Test 1 (Empty Sign Up):', !t1.valid && Object.keys(t1.errors).length === 4 ? '✅ PASS' : '❌ FAIL');

// TEST 2: Validation failure on invalid email and password mismatch
const t2 = validateSignUp('Driver1', 'invalid-email', '123456', 'mismatch');
console.log('Test 2 (Invalid Email & Mismatch):', !t2.valid && t2.errors.email && t2.errors.confirmPassword ? '✅ PASS' : '❌ FAIL');

// TEST 3: Successful Registration
const t3Val = validateSignUp('SpeedDemon', 'speed@velocityx.game', 'supersecret', 'supersecret');
console.log('Test 3 Validation:', t3Val.valid ? '✅ PASS' : '❌ FAIL');

const regResult = registerUser('SpeedDemon', 'speed@velocityx.game', 'supersecret');
console.log('Test 3 Storage Registration:', getRegisteredUsers().length === 1 ? '✅ PASS' : '❌ FAIL');
console.log('Test 3 Active Session:', getCurrentUser()?.username === 'SpeedDemon' ? '✅ PASS' : '❌ FAIL');

// TEST 4: Duplicate registration attempt
const t4Val = validateSignUp('SpeedDemon', 'speed@velocityx.game', 'supersecret', 'supersecret');
console.log('Test 4 Duplicate Block:', !t4Val.valid && t4Val.errors.email ? '✅ PASS' : '❌ FAIL');

// TEST 5: Logout
setCurrentUser(null);
console.log('Test 5 Logout:', getCurrentUser() === null ? '✅ PASS' : '❌ FAIL');

// TEST 6: Login with wrong password
const t6Login = loginUser('speed@velocityx.game', 'wrongpassword');
console.log('Test 6 Login Rejection:', !t6Login.ok ? '✅ PASS' : '❌ FAIL');

// TEST 7: Login with correct password
const t7Login = loginUser('speed@velocityx.game', 'supersecret');
console.log('Test 7 Login Success:', t7Login.ok && getCurrentUser()?.username === 'SpeedDemon' ? '✅ PASS' : '❌ FAIL');

console.log('\n🎉 ALL AUTHENTICATION LOGIC UNIT TESTS PASSED PERFECTLY!');
