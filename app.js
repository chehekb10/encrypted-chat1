// Firebase setup for live messaging (get your keys from console.firebase.google.com)
// YOU MUST create a Firebase project (free), open Realtime Database and copy config below:
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "xxxx",
  appId: "xxxx"
};
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
  chatId = [myUsername, friendUsername].sort().join('_');  // same chatId for both
  document.getElementById('chatSection').style.display = "block";
  document.getElementById('chatFriend').innerText = friendUsername;
  sessionKey = makeSessionKey(myUsername, friendUsername);
  db.ref('chats/' + chatId).on('child_added', function(snapshot) {
    showMessage(snapshot.val());
  });
}

// Simple session key (for demo!)
// In hackathon, demo; in real use crypto libraries
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

// Sending messages
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

// Show chat
function showMessage(data) {
  const who = data.from === myUsername ? "Me" : data.from;
  const text = decryptMessage(data.message, sessionKey);
  const chatBox = document.getElementById('chatBox');
  chatBox.innerHTML += `<div><strong>${who}:</strong> ${text}</div>`;
}
