// Firebase config (same as before)
const firebaseConfig = {
  apiKey: "AIzaSyAXPwge9me10YI38WFSIOQ1Lr-IzKrbUHA",
  authDomain: "pted-chat1.firebaseapp.com",
  databaseURL: "https://pted-chat1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pted-chat1",
  storageBucket: "pted-chat1.appspot.com",
  messagingSenderId: "27789922441",
  appId: "1:27789922441:web:9a196f0040b64b2a2ff658",
  measurementId: "G-QXV6238N0P"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let myUsername = "", friendUsername = "", sessionKey = "";
let chatId = "";

// --- Emoji Picker Setup ---
const emojiList =
  "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");
const emojiPicker = document.getElementById("emojiPicker");
if (emojiPicker) {
  emojiList.forEach(e => {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.type = "button";
    btn.textContent = e;
    btn.onclick = () => insertEmoji(e);
    emojiPicker.appendChild(btn);
  });
}

function toggleEmojiPicker() {
  if (!emojiPicker) return;
  emojiPicker.style.display = (emojiPicker.style.display === "none") ? "flex" : "none";
}

function insertEmoji(emoji) {
  const inp = document.getElementById('messageInput');
  inp.value += emoji;
  emojiPicker.style.display = "none";
  inp.focus();
}

function normalize(str) {
  return str.trim().toLowerCase();
}

function login() {
  myUsername = normalize(document.getElementById('myUsername').value);
  if (!myUsername) { alert("Enter a username!"); return; }
  document.getElementById('loginSection').style.display = "none";
  document.getElementById('userSection').style.display = "block";
  document.getElementById('myUsername').disabled = true;
}

function startChat() {
  friendUsername = normalize(document.getElementById('friendUsername').value);
  if (!friendUsername) { alert("Enter your friend's username!"); return; }
  chatId = [myUsername, friendUsername].sort().join('_');
  document.getElementById('chatSection').style.display = "block";
  document.getElementById('chatFriend').innerText = friendUsername;
  sessionKey = makeSessionKey(myUsername, friendUsername);
  db.ref('chats/' + chatId).off();
  db.ref('chats/' + chatId).on('child_added', function(snapshot) {
    showMessage(snapshot.val());
  });
}

function makeSessionKey(a, b) {
  return btoa([a, b].sort().join('_') + "_secret");
}

function encryptMessage(text, key) {
  return btoa(unescape(encodeURIComponent(text)).split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join(''));
}

function decryptMessage(enc, key) {
  let text = atob(enc);
  return decodeURIComponent(escape(text.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('')));
}

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

function showMessage(data) {
  const chatBox = document.getElementById('chatBox');
  const isMe = data.from === myUsername;
  const text = decryptMessage(data.message, sessionKey);
  const div = document.createElement('div');
  div.className = isMe ? "message-right" : "message-left";
  div.innerHTML = `<strong>${isMe ? "Me" : data.from}:</strong> ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// UI: Dismiss emoji picker if anywhere else clicked
window.addEventListener('click', function(e) {
  if (emojiPicker && !emojiPicker.contains(e.target) && e.target.className !== 'emoji-btn') {
    emojiPicker.style.display = "none";
  }
});
