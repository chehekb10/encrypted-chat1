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
const storage = firebase.storage();

let myUsername = "";
let openChats = []; // list of opened chat/group names

const emojiList =
  "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");

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

function openChat() {
  const chatName = normalize(document.getElementById('chatName').value);
  if (!chatName) return alert("Enter group name or friend's username!");
  if (openChats.includes(chatName)) return switchChat(chatName);

  openChats.push(chatName);
  // Create tab
  const tab = document.createElement('div');
  tab.className = "chat-tab";
  tab.innerText = chatName;
  tab.onclick = () => switchChat(chatName);
  tab.id = `tab-${chatName}`;
  document.getElementById('chatTabs').appendChild(tab);

  // Create chat window
  const chatWin = document.createElement('div');
  chatWin.className = "chat-window";
  chatWin.id = `chat-${chatName}`;
  chatWin.innerHTML = `
    <div class="chat-header">${chatName}</div>
    <div class="chat-box" id="chatBox-${chatName}"></div>
    <div class="input-row">
      <input type="text" placeholder="Type a message..." id="msgInput-${chatName}">
      <button type="button" class="emoji-btn" onclick="toggleEmojiPicker('${chatName}')">😀</button>
      <input type="file" accept="image/*" class="img-btn" id="imgInput-${chatName}">
      <button type="button" class="send-btn" onclick="sendMessage('${chatName}')">Send</button>
    </div>
    <div class="emoji-picker" id="emojiPicker-${chatName}" style="display:none;"></div>
  `;
  document.getElementById('chatWindows').appendChild(chatWin);

  // Emoji picker for each chat
  const pickerDiv = document.getElementById(`emojiPicker-${chatName}`);
  emojiList.forEach(e => {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.type = "button";
    btn.textContent = e;
    btn.onclick = () => insertEmoji(chatName, e);
    pickerDiv.appendChild(btn);
  });

  // Image upload
  document.getElementById(`imgInput-${chatName}`).addEventListener('change', (e) =>
    uploadImage(e, chatName)
  );

  // Listen to db messages
  let chatId = normalize(chatName); // group chat by name
  db.ref('chats/' + chatId).off();
  db.ref('chats/' + chatId).on('child_added', function(snapshot) {
    showMessage(chatName, snapshot.val());
  });

  switchChat(chatName);
}

// Highlight/open active chat window
function switchChat(chatName) {
  openChats.forEach(name => {
    document.getElementById(`chat-${name}`).classList.remove('active');
    document.getElementById(`tab-${name}`).classList.remove('active');
  });
  document.getElementById(`chat-${chatName}`).classList.add('active');
  document.getElementById(`tab-${chatName}`).classList.add('active');
}

// Emoji picker functions, one per chat
function toggleEmojiPicker(chat) {
  const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
  if (!pickerDiv) return;
  pickerDiv.style.display = pickerDiv.style.display === "none" ? "flex" : "none";
}
function insertEmoji(chat, emoji) {
  const inp = document.getElementById(`msgInput-${chat}`);
  inp.value += emoji;
  document.getElementById(`emojiPicker-${chat}`).style.display = "none";
  inp.focus();
}
window.addEventListener('click', function(e) {
  openChats.forEach(chat => {
    const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
    if (pickerDiv && !pickerDiv.contains(e.target) && (!e.target.className || !e.target.className.includes('emoji-btn'))) {
      pickerDiv.style.display = "none";
    }
  });
});

// Encryption helpers - demo only
function makeSessionKey(chat) {
  return btoa(chat + "_secret");
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

function sendMessage(chat) {
  const inp = document.getElementById(`msgInput-${chat}`);
  if (!inp.value) return;
  const key = makeSessionKey(normalize(chat));
  const encrypted = encryptMessage(inp.value, key);
  db.ref('chats/' + normalize(chat)).push({
    from: myUsername,
    message: encrypted,
    type: 'text'
  });
  inp.value = "";
}

function showMessage(chat, data) {
  const box = document.getElementById(`chatBox-${chat}`);
  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  let content = "";
  if (data.type === 'image') {
    content = `<div class="msg-image"><img src="${data.url}" alt="Image"></div>`;
  } else {
    const text = decryptMessage(data.message, makeSessionKey(normalize(chat)));
    content = `<span class="msg-bubble">${text}</span>`;
  }
  div.innerHTML = `<span class="msg-name">${data.from}</span>${content}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Image upload with Firebase Storage
function uploadImage(e, chat) {
  const file = e.target.files[0];
  if (!file) return;
  const chatId = normalize(chat);
  const ref = storage.ref(`images/${chatId}/${Date.now()}_${file.name}`);
  ref.put(file).then(snapshot => {
    ref.getDownloadURL().then(url => {
      db.ref('chats/' + chatId).push({
        from: myUsername,
        type: 'image',
        url: url
      });
    });
  });
  e.target.value = ""; // Reset so same file can be sent again if needed
}
