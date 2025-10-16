// Firebase config
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
let openChats = [];
const emojiList =
  "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");

function normalize(str) { return str.trim().toLowerCase(); }

window.updateChatOption = function() {
  const chatType = document.getElementById('chatType').value;
  const chatName = document.getElementById('chatName');
  const openChatBtn = document.getElementById('openChatBtn');
  if (chatType === "personal") {
    chatName.placeholder = "Enter friend's username...";
    openChatBtn.textContent = "Start Personal Chat";
  } else {
    chatName.placeholder = "Enter group name...";
    openChatBtn.textContent = "Join Group Chat";
  }
};
window.onload = function() { updateChatOption(); };

function login() {
  myUsername = normalize(document.getElementById('myUsername').value);
  if (!myUsername) { alert("Enter a username!"); return; }
  document.getElementById('loginSection').style.display = "none";
  document.getElementById('userSection').style.display = "block";
  document.getElementById('myUsername').disabled = true;
}

function openChat() {
  const chatType = document.getElementById('chatType').value;
  let chatName = normalize(document.getElementById('chatName').value);
  if (!chatName) return alert(chatType === "personal"
    ? "Enter friend's username!" : "Enter group name!");
  if (chatType === "personal") chatName = [myUsername, chatName].sort().join('_');
  if (openChats.includes(chatName)) return switchChat(chatName);

  openChats.push(chatName);
  const tab = document.createElement('div');
  tab.className = "chat-tab";
  tab.innerText = chatName;
  tab.onclick = function() { switchChat(chatName); };
  tab.id = `tab-${chatName}`;
  document.getElementById('chatTabs').appendChild(tab);

  const chatWin = document.createElement('div');
  chatWin.className = "chat-window";
  chatWin.id = `chat-${chatName}`;
  chatWin.innerHTML = `
    <div class="chat-header"><span style="font-size:1.14em;">${chatName}</span></div>
    <div class="chat-box" id="chatBox-${chatName}"></div>
    <div class="input-row">
      <input type="text" placeholder="Type a message..." id="msgInput-${chatName}">
      <button type="button" class="emoji-btn" onclick="toggleEmojiPicker('${chatName}')">😀</button>
      <label class="img-upload-label">
        <span class="img-btn" title="Send Image">🖼️</span>
        <input type="file" accept="image/*" id="imgInput-${chatName}">
      </label>
      <button type="button" class="send-btn" onclick="sendMessage('${chatName}')">Send</button>
    </div>
    <div class="emoji-picker" id="emojiPicker-${chatName}" style="display:none;"></div>
    <div class="progressbar" id="progressbar-${chatName}" style="display:none;">
      <div class="progressfill" id="progressfill-${chatName}"></div>
    </div>
  `;
  document.getElementById('chatWindows').appendChild(chatWin);

  const pickerDiv = document.getElementById(`emojiPicker-${chatName}`);
  emojiList.forEach(e => {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.type = "button";
    btn.textContent = e;
    btn.onclick = function () { insertEmoji(chatName, e); };
    pickerDiv.appendChild(btn);
  });

  document.getElementById(`imgInput-${chatName}`).addEventListener('change', function (e) {
    uploadImage(e, chatName);
  });

  db.ref('chats/' + chatName).off();
  db.ref('chats/' + chatName).on('child_added', function(snapshot) {
    showMessage(chatName, snapshot.val());
  });

  switchChat(chatName);
}

function switchChat(chatName) {
  openChats.forEach(function(name) {
    document.getElementById(`chat-${name}`).classList.remove('active');
    document.getElementById(`tab-${name}`).classList.remove('active');
  });
  document.getElementById(`chat-${chatName}`).classList.add('active');
  document.getElementById(`tab-${chatName}`).classList.add('active');
}

// Emoji features
function toggleEmojiPicker(chat) {
  const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
  if (pickerDiv) pickerDiv.style.display = pickerDiv.style.display === "none" ? "flex" : "none";
}
function insertEmoji(chat, emoji) {
  const inp = document.getElementById(`msgInput-${chat}`); inp.value += emoji;
  document.getElementById(`emojiPicker-${chat}`).style.display = "none"; inp.focus();
}
window.addEventListener('click', function(e) {
  openChats.forEach(function(chat){
    const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
    if (pickerDiv && !pickerDiv.contains(e.target) && (!e.target.className || !e.target.className.includes('emoji-btn'))) { pickerDiv.style.display = "none"; }
  });
});

// Encryption core
function makeSessionKey(chat) { return btoa(chat + "_secret"); }
function encryptMessage(text, key) {
  return btoa(unescape(encodeURIComponent(text)).split('').map(function(c, i) {
    return String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length));
  }).join(''));
}
function decryptMessage(enc, key) {
  let text = atob(enc);
  return decodeURIComponent(escape(text.split('').map(function(c, i) {
    return String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length));
  }).join('')));
}

function sendMessage(chat) {
  const inp = document.getElementById(`msgInput-${chat}`);
  if (!inp.value) return;
  const key = makeSessionKey(chat);
  const encrypted = encryptMessage(inp.value, key);
  db.ref('chats/' + chat).push({from: myUsername, message: encrypted, type: 'text'});
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
    const text = decryptMessage(data.message, makeSessionKey(chat));
    content = `<span class="msg-bubble">${text}</span>`;
  }
  div.innerHTML = `<span class="msg-name">${data.from}</span>${content}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

function uploadImage(e, chat) {
  const file = e.target.files[0];
  if (!file) return;
  const ref = storage.ref(`images/${chat}/${Date.now()}_${file.name}`);
  const progressbar = document.getElementById(`progressbar-${chat}`);
  const fill = document.getElementById(`progressfill-${chat}`);
  progressbar.style.display = "block";
  const task = ref.put(file);
  task.on('state_changed',
    function progress(snapshot) {
      const perc = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
      fill.style.width = perc + "%";
    },
    function error(err) {
      alert("Image upload error: " + err.message);
      progressbar.style.display = "none";
    },
    function complete() {
      ref.getDownloadURL().then(function(url) {
        db.ref('chats/' + chat).push({from: myUsername, type: 'image', url: url});
        progressbar.style.display = "none";
        fill.style.width = "0%";
      });
    }
  );
  e.target.value = "";
}
