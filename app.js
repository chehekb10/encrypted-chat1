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

let myUsername = "";
let openChats = [];
let receiptOn = true;
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

window.toggleReadReceipts = function() {
  receiptOn = document.getElementById('readReceipts').checked;
  // Optionally update all receipts display
  document.querySelectorAll('.read-receipt').forEach(el => {
    el.style.display = receiptOn ? "" : "none";
  });
};

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
      <button type="button" class="send-btn" onclick="sendMessage('${chatName}')">Send</button>
    </div>
    <div class="emoji-picker" id="emojiPicker-${chatName}" style="display:none;"></div>
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

  db.ref('chats/' + chatName).off();
  db.ref('chats/' + chatName).on('child_added', function(snapshot) {
    showMessage(chatName, snapshot.key, snapshot.val());
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

// Encryption
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
  const msgData = {
    from: myUsername,
    message: encrypted,
    type: 'text',
    readby: {[myUsername]: true},
    timestamp: Date.now()
  };
  db.ref('chats/' + chat).push(msgData);
  inp.value = "";
}

function showMessage(chat, msgKey, data) {
  const box = document.getElementById(`chatBox-${chat}`);
  // Only show once
  if (document.getElementById(`msg-${msgKey}`)) return;

  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  div.id = `msg-${msgKey}`;
  let content = `<span class="msg-bubble">${decryptMessage(data.message, makeSessionKey(chat))}</span>`;
  let actions = "";
  if (data.from === myUsername) {
    actions = `
      <span class="msg-actions">
        <button class="action-btn" onclick="editMessage('${chat}','${msgKey}')">Edit</button>
        <button class="action-btn" onclick="deleteMessage('${chat}','${msgKey}')">Delete</button>
      </span>
    `;
  }
  let receipt = "";
  if (receiptOn && data.from === myUsername) {
    let read = data.readby && Object.keys(data.readby || {}).length > 1;
    receipt = `<span class="read-receipt" style="color:${read ? "#25d366":"#bbb"}" title="Read">${read ? "✔✔" : "✔"}</span>`;
  }
  // Show sender name for group, not personal chat. Always show for group.
  div.innerHTML = `<span class="msg-name">${data.from}</span>${content}${actions}${receipt}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
  // Mark as read
  if (data.from !== myUsername) {
    db.ref(`chats/${chat}/${msgKey}/readby/${myUsername}`).set(true);
  }
}

window.editMessage = function(chat, msgKey) {
  const box = document.getElementById(`msg-${msgKey}`);
  const oldMsg = box.querySelector('.msg-bubble').textContent;
  const inp = document.createElement("input");
  inp.type = "text"; inp.style = "width:80%"; inp.value = oldMsg;
  box.querySelector('.msg-bubble').replaceWith(inp);
  inp.focus();
  inp.onblur = function() {
    finishEdit(box, chat, msgKey, inp.value);
  };
  inp.onkeydown = function(e) {
    if (e.key === "Enter") finishEdit(box, chat, msgKey, inp.value);
  }
};
function finishEdit(box, chat, msgKey, newText) {
  const key = makeSessionKey(chat);
  const enc = encryptMessage(newText, key);
  db.ref(`chats/${chat}/${msgKey}/message`).set(enc);
  // Restore display for user-side instantly
  box.querySelector("input[type=text]").replaceWith(
    (function(){let el = document.createElement('span'); el.className="msg-bubble"; el.textContent = newText; return el;})()
  );
}

window.deleteMessage = function(chat, msgKey) {
  const box = document.getElementById(`msg-${msgKey}`);
  box.classList.add('delete-anim');
  setTimeout(function() {
    db.ref(`chats/${chat}/${msgKey}`).remove();
    box.remove();
  }, 250);
}
