// Your Firebase config from Firebase Console (paste your actual values here)
const firebaseConfig = {
  apiKey: "AIzaSyAXPwge9me10YI38WFSIOQ1Lr-IzKrbUHA",
  authDomain: "pted-chat1.firebaseapp.com",
  databaseURL: "https://pted-chat1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pted-chat1",
  storageBucket: "pted-chat1.firebasestorage.app",
  messagingSenderId: "27789922441",
  appId: "1:27789922441:web:9a196f0040b64b2a2ff658",
  measurementId: "G-QXV6238N0P"
};

// Initialize Firebase (CDN style)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let myUsername = "", friendUsername = "", sessionKey = "";
let chatId = "";

// Login process
function login() {
  myUsername = document.getElementById('myUsername').value.trim();
  if (!myUsername) { alert("Enter a username!"); return; }
  document.getElementById('userSection').style.display = "block";
  document.getElementById('myUsername').disabled = true;
}

// Start chat (creates shared chat channel)
function startChat() {
  friendUsername = document.getElementById('friendUsername').value.trim();
  if (!friendUsername) { alert("Enter your friend's username!"); return; }
  chatId = [myUsername, friendUsername].sort().join('_');  // same chatId for both users
  document.getElementById('chatSection').style.display = "block";
  document.getElementById('chatFriend').innerText = friendUsername;
  sessionKey = makeSessionKey(myUsername, friendUsername);
  db.ref('chats/' + chatId).on('child_added', function(snapshot) {
    showMessage(snapshot.val());
  });
}

// Simple session key (for demo; use real crypto for production)
function makeSessionKey(a, b) { return btoa(a + "_" + b + "_secret"); }

// Encrypt message
function encryptMessage(text, key) {
  return btoa(text.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join(''));
}

// Decrypt message
function decryptMessage(enc, key) {
  let text = atob(enc);
  return text.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
}

// Send message
function sendMessage() {
  const msg = document.getElementById('messageInput').value;
  if (!msg) return;
  const encrypted = encryptMessage(msg, sessionKey);
  db.ref('chats/' + chatId).push({
    from: myUsername,
    message: encrypted
  });
  document.getElementById('messageInput').value = "";
}

// Show chat messages
function showMessage(data) {
  const who = data.from === myUsername ? "Me" : data.from;
  const text = decryptMessage(data.message, sessionKey);
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML += `<div><strong>${who}:</strong> ${text}</div>`;
}
