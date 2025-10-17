// --- Keypair/Security Code: as in the previous E2EE code block ---

// ... (all the cryptographic utility functions here, unchanged; see previous message for these) ...

// --- App logic START ---

let myUsername = "";
let peerUsername = "";
let sessionKey = null;
let myKeyPair = null;
let myPubB64 = null;
let myPrivJwk = null;
let peerPubKey = null;
let receiptOn = true;
let openChats = [];
let hideForMe = {};
let typingTimeouts = {};
const allReactions = ["👍", "❤️", "😂", "😮"];
const emojiList = "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");

// --- Theme (Light/Dark) ---
window.toggleTheme = function() {
  const btn = document.getElementById("themeBtn");
  if (document.body.classList.contains('dark')) {
    document.body.classList.remove('dark');
    btn.classList.remove('light');
    btn.innerText = "🌙";
  } else {
    document.body.classList.add('dark');
    btn.classList.add('light');
    btn.innerText = "☀️";
  }
};

// --- Login/keypair logic as before ---
// (see previous login, openChat, and crypto code – not repeated to save space)

// --- Chat Window UI, message sending/receiving ---
window.openChat = async function() {
  // ... (same key/session handling as before) ...
  // SHOW the chat window w/ emoji/reactions
  let chatName = [myUsername, peerUsername].sort().join("_");
  document.getElementById("chatTabs").innerHTML = "";
  let chatWin = document.createElement('div');
  chatWin.className = "chat-window active";
  chatWin.id = `chat-${chatName}`;
  chatWin.innerHTML = `
    <div class="chat-header"><span>${chatName}</span></div>
    <div class="typing-indicator" id="typing-${chatName}" style="display:none;"></div>
    <div class="chat-box" id="chatBox-${chatName}"></div>
    <div class="input-row" style="margin-top:.6em;">
      <input type="text" style="width:73%;display:inline-block;vertical-align:middle;" placeholder="Type a message..." id="msgInput-${chatName}">
      <button class="main-btn" style="width:23%;font-size:1em;padding:.45em 1em;display:inline-block;vertical-align:middle;" onclick="sendMessage('${chatName}')">Send</button>
      <button class="emoji-btn" style="background:#f6f6f6;border:none;" onclick="toggleEmojiPicker('${chatName}')">😀</button>
      <div class="emoji-picker" id="emojiPicker-${chatName}" style="display:none;"></div>
    </div>
  `;
  document.getElementById('chatWindows').innerHTML = "";
  document.getElementById('chatWindows').appendChild(chatWin);
  // Emoji picker render
  const pickerDiv = document.getElementById(`emojiPicker-${chatName}`);
  emojiList.forEach(e => {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.textContent = e;
    btn.onclick = function () { insertEmoji(chatName, e); };
    pickerDiv.appendChild(btn);
  });

  // Fetch messages, show all features
  db.ref('chats/' + chatName).off();
  db.ref('chats/' + chatName).on('child_added', async function(snapshot) {
    await showMessage(chatName, snapshot.key, snapshot.val());
    // Optionally, for E2EE demo: db.ref('chats/' + chatName + '/' + snapshot.key).remove();
  });
};

// --- Emoji picker ---
window.toggleEmojiPicker = function(chat) {
  const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
  pickerDiv.style.display = pickerDiv.style.display === "none" ? "flex" : "none";
};
window.insertEmoji = function(chat, emoji) {
  const inp = document.getElementById(`msgInput-${chat}`);
  inp.value += emoji;
  document.getElementById(`emojiPicker-${chat}`).style.display = "none"; inp.focus();
};

// --- Message send (encrypt before sending) ---
window.sendMessage = async function(chat) {
  const inp = document.getElementById(`msgInput-${chat}`);
  if (!inp.value) return;
  let plain = inp.value;
  let enc = await encryptMessage(plain, sessionKey);
  await db.ref('chats/' + chat).push({
    ...enc,
    from: myUsername,
    reactions: {},
    starred: {},
    readby: {[myUsername]: true},
    timestamp: Date.now()
  });
  inp.value = "";
};

// --- Show message/decrypt + reactions/read receipts/edit/delete ---
async function showMessage(chat, msgKey, data) {
  const box = document.getElementById(`chatBox-${chat}`);
  if (!box) return;
  let text = sessionKey ? (await decryptMessage(data, sessionKey)) : "Encrypted";
  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  div.id = `msg-${msgKey}`;
  // Reactions + Actions etc
  let reactRow = `<span class="reaction-row" id="reactrow-${msgKey}">`;
  allReactions.forEach(re => {
    let selClass = data.reactions && data.reactions[re] && data.reactions[re][myUsername] ? "selected" : "";
    reactRow += `<button class="react-btn ${selClass}" onclick="reactToMessage('${chat}','${msgKey}','${re}')">${re}${renderReactionCount(data, re)}</button>`;
  });
  reactRow += '</span>';
  let actions = "";
  if (data.from === myUsername) {
    actions = `<span class="msg-actions">
        <button class="action-btn" onclick="editMessage('${chat}','${msgKey}')">Edit</button>
        <button class="action-btn" onclick="deleteForMe('${chat}','${msgKey}')">Delete for Me</button>
        <button class="action-btn" onclick="deleteMessage('${chat}','${msgKey}')">Delete for Everyone</button>
        <span class="star-btn" onclick="starMessage('${chat}','${msgKey}')" title="Starred">${data.starred&&data.starred[myUsername]?'★':'☆'}</span>
      </span>`;
  }
  // Read receipts logic (as before, just update 'readby' upon message open/scroll show)
  let receipt = "";
  if (data.from === myUsername && receiptOn && data.readby) {
    let peerSeen = Object.keys(data.readby).find(u => u !== myUsername);
    receipt = peerSeen ? `<span class="read-receipt" style="color:#3259ff;">✔✔</span>` : `<span class="read-receipt" style="color:#bbb;">✔</span>`;
  }
  let localTime = new Date(data.timestamp||0).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  let time = `<span class="time-stamp">${localTime}</span>`;
  div.innerHTML = `<span class="msg-name">${data.from}</span><span class="msg-bubble">${text}</span>${time}${actions}${reactRow}${receipt}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

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
window.editMessage = function(chat, msgKey) {
  // ... as before, edit UI, update encrypted text on db ...
};
window.deleteForMe = function(chat, msgKey) {
  hideForMe[chat][msgKey] = true;
  let box = document.getElementById(`msg-${msgKey}`);
  if (box) box.classList.add('delete-anim');
  setTimeout(() => box && box.remove(), 220);
};
window.deleteMessage = function(chat, msgKey) {
  db.ref(`chats/${chat}/${msgKey}`).remove();
};
window.starMessage = function(chat,msgKey){
  let ref = db.ref(`chats/${chat}/${msgKey}/starred/${myUsername}`);
  db.ref(`chats/${chat}/${msgKey}/starred/${myUsername}`).once('value', function(snap){
    if(snap.val()) ref.remove();
    else ref.set(firebase.database.ServerValue.TIMESTAMP);
  });
};

window.showSessionKey = async function() {
  if (!sessionKey) { alert("No session key yet! Open a chat first."); return; }
  let exported = await exportSessionKey(sessionKey);
  alert("Session key (base64): " + exported);
};

window.onload = function() {
  document.getElementById("chatTabs").innerHTML = "";
  document.getElementById("chatWindows").innerHTML = "";
};
