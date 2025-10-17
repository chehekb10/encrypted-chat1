// Firebase setup ...
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
let myUsername = "";
let openChats = [];
let receiptOn = true;
let typingTimeouts = {};
let hideForMe = {};
let currentTheme = "light";
const allReactions = ["👍", "❤️", "😂", "😮"];
const emojiList = "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");

function normalize(str) { return str.trim().toLowerCase(); }
window.toggleTheme = function() { /* ...unchanged from previous version... */ };
// Use the toggleTheme code as shown in previous code cell or your current JS

window.updateChatOption = function() { /* ...unchanged... */ };
// Use unchanged as above

window.toggleReadReceipts = function() { /* ...unchanged... */ };
// Use unchanged

function login() { /* ...unchanged ... */ }

function openChat() {
  /* ...unchanged until showMessage... */
  db.ref('chats/' + chatName).on('child_added', function(snapshot) {
    showMessage(chatName, snapshot.key, snapshot.val());
  });
  db.ref('chats/' + chatName).on('child_changed', function(snapshot) {
    updateEditedMessage(chatName, snapshot.key, snapshot.val());
  });
  db.ref('chats/' + chatName).on('child_removed', function(snapshot) {
    if (document.getElementById(`msg-${snapshot.key}`)) {
      document.getElementById(`msg-${snapshot.key}`).remove();
    }
  });

  // Typing
  db.ref('typing/' + chatName).on('value', function(snapshot) {
    const typing = snapshot.val();
    if (typing && typing.user !== myUsername && typing.typing) {
      document.getElementById(`typing-${chatName}`).innerText = typing.user + " is typing...";
      document.getElementById(`typing-${chatName}`).style.display = "block";
    } else {
      document.getElementById(`typing-${chatName}`).style.display = "none";
    }
  });

  switchChat(chatName);
}
function switchChat(chatName) { /* ...unchanged... */ }
function toggleEmojiPicker(chat) { /* ...unchanged... */ }
function insertEmoji(chat, emoji) { /* ...unchanged... */ }
window.addEventListener('click', function(e) { /* ...unchanged... */ });
// Encryption
function makeSessionKey(chat) { return btoa(chat + "_secret"); }
function encryptMessage(text, key) {
  return btoa(unescape(encodeURIComponent(text)).split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(''));
}
function decryptMessage(enc, key) {
  let text = atob(enc);
  return decodeURIComponent(escape(text.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('')));
}
function sendMessage(chat) { /* ...unchanged... */ }
window.sendTyping = function(chat) { /* ...unchanged... */ };

// ------ MAIN MESSAGE/REACTIONS/RECEIPT RENDERING ------
function showMessage(chat, msgKey, data) {
  if ((hideForMe[chat] && hideForMe[chat][msgKey])) return;
  const box = document.getElementById(`chatBox-${chat}`);
  if (document.getElementById(`msg-${msgKey}`)) return;
  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  div.id = `msg-${msgKey}`;
  let content = `<span class="msg-bubble">${decryptMessage(data.message, makeSessionKey(chat))}</span>`;

  // WhatsApp-style receipt logic for sent messages only
  let receipt = "";
  let isPersonalChat = chat.includes("_");
  let recipients = getChatUsers(chat, data, true);
  let reactRow = `<span class="reaction-row" id="reactrow-${msgKey}">`;
  allReactions.forEach(re => {
    let selClass = data.reactions && data.reactions[re] && data.reactions[re][myUsername] ? "selected" : "";
    reactRow += `<button class="react-btn ${selClass}" data-emoji='${re}' onclick="reactToMessage('${chat}','${msgKey}','${re}')">${re}${renderReactionCount(data, re)}</button>`;
  });
  reactRow += '</span>';

  if (data.from === myUsername && receiptOn) {
    let readKeys = Object.keys(data.readby||{}).filter(u => u !== myUsername);
    let bothDelivered = isPersonalChat && recipients.length >= 2 && readKeys.length >= 1;
    let bothSeen = isPersonalChat && recipients.length >= 2 &&
      readKeys.length >= 1 && data.readby[recipients.find(r=>r!==myUsername)];
    if (!bothDelivered) {
      receipt = `<span class="read-receipt" style="color:#bbb">✔</span>`;
    } else if (bothSeen) {
      receipt = `<span class="read-receipt" style="color:#0377ee">✔✔</span>`;
    } else {
      receipt = `<span class="read-receipt" style="color:#bbb">✔✔</span>`;
    }
  }

  let starredClass = data.starred && data.starred[myUsername] ? 'star-icon' : '';
  let showActions = data.from === myUsername;
  let actions = "";
  if (showActions) {
    actions = `
      <span class="msg-actions">
        <button class="action-btn" onclick="editMessage('${chat}','${msgKey}')">Edit</button>
        <button class="action-btn" onclick="deleteForMe('${chat}','${msgKey}')">Delete for Me</button>
        <button class="action-btn" onclick="deleteMessage('${chat}','${msgKey}')">Delete for Everyone</button>
        <span class="star-btn ${starredClass}" onclick="starMessage('${chat}','${msgKey}')" style="font-size:1.7em;margin-left:.12em;cursor:pointer;" title="Starred">${data.starred&&data.starred[myUsername]?'★':'☆'}</span>
      </span>`;
  }

  let localTime = new Date(data.timestamp||0).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  let time = `<span class="time-stamp">${localTime}</span>`;

  div.innerHTML = `<span class="msg-name">${data.from}${data.starred&&data.starred[myUsername]?'<span class="star-icon"> ★</span>':''}</span>${content}${time}${actions}${reactRow}${receipt}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;

  db.ref(`chats/${chat}/${msgKey}`).on('value', function(snap) {
    const data = snap.val();
    if (!data) return;
    allReactions.forEach(re => {
      const btn = document.querySelector(`#reactrow-${msgKey} .react-btn[data-emoji='${re}']`);
      if (btn) {
        let selClass = data.reactions && data.reactions[re] && data.reactions[re][myUsername] ? "selected" : "";
        btn.className = "react-btn" + (selClass ? " selected" : "");
        btn.innerHTML = re + (data.reactions && data.reactions[re] ? ` (${Object.keys(data.reactions[re]).length})` : "");
      }
    });
    const starBtn = document.querySelector(`#msg-${msgKey} .star-btn`);
    if (starBtn) {
      if (data.starred && data.starred[myUsername]) {
        starBtn.classList.add('star-icon');
        starBtn.textContent = "★";
      } else {
        starBtn.classList.remove('star-icon');
        starBtn.textContent = "☆";
      }
    }
  });

  if (data.from !== myUsername && (!data.readby || !data.readby[myUsername]))
    db.ref(`chats/${chat}/${msgKey}/readby/${myUsername}`).set(true);
}
function updateEditedMessage(chat, msgKey, data) { /* ...unchanged... */ }
// Edit, delete, reaction, star logic as in previous response
window.editMessage = function(chat, msgKey) { /* ...unchanged... */ };
function finishEdit(msgDiv, chat, msgKey, newText) { /* ...unchanged... */ }
window.deleteForMe = function(chat, msgKey) { /* ...unchanged... */ }
window.deleteMessage = function(chat, msgKey) { /* ...unchanged... */ }
window.reactToMessage = function(chat, msgKey, emoji) {
  const ref = db.ref(`chats/${chat}/${msgKey}/reactions/${emoji}/${myUsername}`);
  ref.once('value', function(snap){
    if(snap.val()) ref.remove();
    else ref.set(true);
  });
};
function renderReactionCount(data, emoji) {
  return data.reactions && data.reactions[emoji] ? ` (${Object.keys(data.reactions[emoji]).length})`:"";
}
window.starMessage = function(chat,msgKey){
  let ref = db.ref(`chats/${chat}/${msgKey}/starred/${myUsername}`);
  db.ref(`chats/${chat}/${msgKey}/starred/${myUsername}`).once('value', function(snap){
    if(snap.val()) ref.remove();
    else ref.set(firebase.database.ServerValue.TIMESTAMP);
  });
};
function getChatUsers(chat, data, includeReaders) { /* ...unchanged... */ }
