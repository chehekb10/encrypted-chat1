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
// Only four simple reactions
const allReactions = ["👍", "❤️", "😂", "😮"];
const emojiList = "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");

function normalize(str) { return str.trim().toLowerCase(); }

window.toggleTheme = function() {
  const root = document.body;
  const btn = document.getElementById("themeBtn");
  if (currentTheme === "light") {
    root.style.background = "linear-gradient(110deg,#232638 40%,#123f36 100%)";
    root.style.color = "#eee";
    document.getElementById("chatApp").style.background = "#26293d";
    [...document.querySelectorAll(".chat-window, input, .selector, .chat-box, header")].forEach(el => {if(el) el.style.background = "#232638";});
    btn.classList.add("light");
    btn.innerText = "🌞";
    currentTheme = "dark";
  } else {
    root.style.background = "";
    root.style.color = "";
    document.getElementById("chatApp").style.background = "";
    [...document.querySelectorAll(".chat-window, input, .selector, .chat-box, header")].forEach(el => {if(el) el.style.background = "";});
    btn.classList.remove("light");
    btn.innerText = "🌚";
    currentTheme = "light";
  }
};

window.updateChatOption = function() {
  const chatType = document.getElementById('chatType').value;
  const chatName = document.getElementById('chatName');
  const openChatBtn = document.getElementById('openChatBtn');
  chatName.placeholder = chatType === "personal" ? "Enter friend's username..." : "Enter group name...";
  openChatBtn.textContent = chatType === "personal" ? "Start Personal Chat" : "Join Group Chat";
};
window.onload = function() { updateChatOption(); };

window.toggleReadReceipts = function() {
  receiptOn = document.getElementById('readReceipts').checked;
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
  if (!chatName) return alert(chatType === "personal" ? "Enter friend's username!" : "Enter group name!");
  if (chatType === "personal") chatName = [myUsername, chatName].sort().join('_');
  if (openChats.includes(chatName)) return switchChat(chatName);

  openChats.push(chatName);
  hideForMe[chatName] = hideForMe[chatName] || {};
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
    <div class="typing-indicator" id="typing-${chatName}" style="display:none;"></div>
    <div class="chat-box" id="chatBox-${chatName}"></div>
    <div class="input-row">
      <input type="text" placeholder="Type a message..." id="msgInput-${chatName}" oninput="sendTyping('${chatName}')">
      <button type="button" class="emoji-btn" onclick="toggleEmojiPicker('${chatName}')">😀</button>
      <button type="button" class="send-btn" onclick="sendMessage('${chatName}')">Send</button>
    </div>
    <div class="emoji-picker" id="emojiPicker-${chatName}" style="display:none;"></div>
  `;
  document.getElementById('chatWindows').appendChild(chatWin);

  // Emoji picker
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
  db.ref('chats/' + chatName).on('child_changed', function(snapshot) {
    updateEditedMessage(chatName, snapshot.key, snapshot.val());
  });
  db.ref('chats/' + chatName).on('child_removed', function(snapshot) {
    if (document.getElementById(`msg-${snapshot.key}`)) {
      document.getElementById(`msg-${snapshot.key}`).remove();
    }
  });

  // Typing indicator
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

function switchChat(chatName) {
  openChats.forEach(function(name) {
    document.getElementById(`chat-${name}`).classList.remove('active');
    document.getElementById(`tab-${name}`).classList.remove('active');
  });
  document.getElementById(`chat-${chatName}`).classList.add('active');
  document.getElementById(`tab-${chatName}`).classList.add('active');
}

function toggleEmojiPicker(chat) {
  const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
  if (pickerDiv) pickerDiv.style.display = pickerDiv.style.display === "none" ? "flex" : "none";
}
function insertEmoji(chat, emoji) {
  const inp = document.getElementById(`msgInput-${chat}`);
  inp.value += emoji;
  document.getElementById(`emojiPicker-${chat}`).style.display = "none"; inp.focus();
}
window.addEventListener('click', function(e) {
  openChats.forEach(function(chat){
    const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
    if (pickerDiv && !pickerDiv.contains(e.target) && (!e.target.className || !e.target.className.includes('emoji-btn'))) { pickerDiv.style.display = "none"; }
  });
});

// ENCRYPTION
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
    timestamp: Date.now(),
    reactions: {},
    starred: {},
    deletedFor: {}
  };
  db.ref('chats/' + chat).push(msgData);
  inp.value = "";
  db.ref('typing/' + chat).set({user: myUsername, typing:false});
}

// Typing Indicator logic
window.sendTyping = function(chat) {
  db.ref('typing/' + chat).set({user: myUsername, typing:true});
  if (typingTimeouts[chat]) clearTimeout(typingTimeouts[chat]);
  typingTimeouts[chat] = setTimeout(() => {
    db.ref('typing/' + chat).set({user: myUsername, typing:false});
  }, 1200);
};

// ------ MESSAGE, REACTION, STAR, ETC. ------
function showMessage(chat, msgKey, data) {
  if ((hideForMe[chat] && hideForMe[chat][msgKey])) return;
  const box = document.getElementById(`chatBox-${chat}`);
  if (document.getElementById(`msg-${msgKey}`)) return;
  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  div.id = `msg-${msgKey}`;
  let content = `<span class="msg-bubble">${decryptMessage(data.message, makeSessionKey(chat))}</span>`;

  let showActions = data.from === myUsername;
  let actions = "";
  if (showActions) {
    actions = `
      <span class="msg-actions">
        <button class="action-btn" onclick="editMessage('${chat}','${msgKey}')">Edit</button>
        <button class="action-btn" onclick="deleteForMe('${chat}','${msgKey}')">Delete for Me</button>
        <button class="action-btn" onclick="deleteMessage('${chat}','${msgKey}')">Delete for Everyone</button>
        <button class="star-btn" title="Starred" onclick="starMessage('${chat}','${msgKey}')">★</button>
      </span>`;
  }

  let reactRow = `<span class="reaction-row" id="reactrow-${msgKey}">`;
  allReactions.forEach(re =>
    reactRow += `<button class="react-btn" data-emoji='${re}' onclick="reactToMessage('${chat}','${msgKey}','${re}')">${re}${renderReactionCount(data,re)}</button>`
  );
  reactRow += '</span>';

  let localTime = new Date(data.timestamp||0).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  let time = `<span class="time-stamp">${localTime}</span>`;

  let receipt = "";
  if (showActions && receiptOn) {
    let keys = Object.keys(data.readby||{});
    let totalUsers = getChatUsers(chat, data, true);
    const isReadByAll = totalUsers.length && totalUsers.every(u => keys.includes(u));
    receipt = `<span class="read-receipt" style="color:${isReadByAll?"#0977e6":"#bbb"}" title="Read">${isReadByAll?"✔✔":"✔"}</span>`;
  }
  div.innerHTML = `<span class="msg-name">${data.from}${data.starred&&data.starred[myUsername]?' ★':''}</span>${content}${time}${actions}${showActions?reactRow:""}${receipt}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;

  // Live reaction & star updates
  db.ref(`chats/${chat}/${msgKey}`).on('value', function(snap) {
    const data = snap.val();
    if (!data) return;
    allReactions.forEach(re => {
      const btn = document.querySelector(`#reactrow-${msgKey} .react-btn[data-emoji='${re}']`);
      if (btn)
        btn.innerHTML = re + (data.reactions && data.reactions[re] ? ` (${data.reactions[re]})` : "");
    });
    const starBtn = document.querySelector(`#msg-${msgKey} .star-btn`);
    if (starBtn) {
      if (data.starred && data.starred[myUsername])
        starBtn.classList.add('selected');
      else
        starBtn.classList.remove('selected');
    }
  });

  // Mark as read
  if (data.from !== myUsername && (!data.readby || !data.readby[myUsername]))
    db.ref(`chats/${chat}/${msgKey}/readby/${myUsername}`).set(true);
}
function updateEditedMessage(chat, msgKey, data) {
  if ((hideForMe[chat] && hideForMe[chat][msgKey])) return;
  let el = document.getElementById(`msg-${msgKey}`);
  if (!el) return;
  el.querySelector('.msg-bubble').textContent = decryptMessage(data.message, makeSessionKey(chat));
}

// Edit & delete
window.editMessage = function(chat, msgKey) {
  const msgDiv = document.getElementById(`msg-${msgKey}`);
  const bubble = msgDiv.querySelector('.msg-bubble');
  const oldMsg = bubble.textContent;
  let finished = false;
  const inp = document.createElement("input");
  inp.type = "text"; inp.style = "width:80%"; inp.value = oldMsg;
  bubble.replaceWith(inp);
  inp.focus();
  inp.onblur = function() {
    if (!finished) finishEdit(msgDiv, chat, msgKey, inp.value);
    finished = true;
  };
  inp.onkeydown = function(e) {
    if (e.key === "Enter") {
      finishEdit(msgDiv, chat, msgKey, inp.value); finished = true;
    }
  };
};
function finishEdit(msgDiv, chat, msgKey, newText) {
  const key = makeSessionKey(chat);
  db.ref(`chats/${chat}/${msgKey}/message`).set(encryptMessage(newText, key));
  if (msgDiv.querySelector("input[type=text]")) {
    let el = document.createElement('span');
    el.className = "msg-bubble"; el.textContent = newText;
    msgDiv.querySelector("input[type=text]").replaceWith(el);
  }
}
window.deleteForMe = function(chat, msgKey) {
  hideForMe[chat][msgKey] = true;
  let box = document.getElementById(`msg-${msgKey}`);
  if (box) {
    box.classList.add('delete-anim');
    setTimeout(() => box.remove(), 210);
  }
};
window.deleteMessage = function(chat, msgKey) {
  const box = document.getElementById(`msg-${msgKey}`);
  if (box) {
    box.classList.add('delete-anim');
    setTimeout(() => box.remove(), 220);
  }
  db.ref(`chats/${chat}/${msgKey}`).remove();
};
// Reactions & starring
window.reactToMessage = function(chat, msgKey, emoji) {
  let ref = db.ref(`chats/${chat}/${msgKey}/reactions/${emoji}`);
  ref.transaction(count => (count||0) + 1 );
};
function renderReactionCount(data, emoji) {
  return data.reactions&&data.reactions[emoji]?` (${data.reactions[emoji]})`:"";
}
window.starMessage = function(chat,msgKey){
  let ref = db.ref(`chats/${chat}/${msgKey}/starred/${myUsername}`);
  db.ref(`chats/${chat}/${msgKey}/starred/${myUsername}`).once('value', function(snap){
    if(snap.val()) ref.remove();
    else ref.set(firebase.database.ServerValue.TIMESTAMP);
  });
};
// Participants
function getChatUsers(chat, data, includeReaders) {
  let box = document.getElementById(`chatBox-${chat}`);
  if (!box) return [];
  let users = new Set();
  Array.from(box.children).forEach(div => {
    let nameEl = div.querySelector('.msg-name');
    if (nameEl) users.add(nameEl.textContent.replace(" ★",""));
  });
  if (includeReaders && data.readby) Object.keys(data.readby).forEach(u => users.add(u));
  return Array.from(users);
}
