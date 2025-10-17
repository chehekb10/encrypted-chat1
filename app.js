// ... Firebase setup, variables as above ...

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

window.updateChatOption = function() {
  const chatType = document.getElementById('chatType').value;
  const chatName = document.getElementById('chatName');
  const openChatBtn = document.getElementById('openChatBtn');
  chatName.placeholder = chatType === "personal" ? "Type friend's username..." : "Type group name...";
  openChatBtn.textContent = chatType === "personal" ? "Start Personal Chat" : "Join Group Chat";
};

window.toggleReadReceipts = function() {
  receiptOn = document.getElementById('readReceipts').checked;
  document.querySelectorAll('.read-receipt').forEach(el => {
    el.style.display = receiptOn ? "" : "none";
  });
};

window.login = function() {
  myUsername = normalize(document.getElementById('myUsername').value);
  if (!myUsername) { alert("Enter a username!"); return; }
  document.getElementById('loginSection').style.display = "none";
  document.getElementById('userSection').style.display = "block";
};

window.openChat = function() { /* same as previous, compatible with above layout */ };

// --- rest of handlers as previously given ---

window.showMessage = function(chat, msgKey, data) {
  if ((hideForMe[chat] && hideForMe[chat][msgKey])) return;
  const box = document.getElementById(`chatBox-${chat}`);
  if (document.getElementById(`msg-${msgKey}`)) return;
  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  div.id = `msg-${msgKey}`;
  let content = `<span class="msg-bubble">${decryptMessage(data.message, makeSessionKey(chat))}</span>`;

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
      receipt = `<span class="read-receipt" style="color:#3259ff">✔✔</span>`;
    } else {
      receipt = `<span class="read-receipt" style="color:#bbb">✔✔</span>`;
    }
  }

  let starredClass = data.starred && data.starred[myUsername] ? 'star-icon' : '';
  let showActions = data.from === myUsername;
  let actions = "";
  if (showActions) {
    actions = `<span class="msg-actions">
        <button class="action-btn" onclick="editMessage('${chat}','${msgKey}')">Edit</button>
        <button class="action-btn" onclick="deleteForMe('${chat}','${msgKey}')">Delete for Me</button>
        <button class="action-btn" onclick="deleteMessage('${chat}','${msgKey}')">Delete for Everyone</button>
        <span class="star-btn ${starredClass}" onclick="starMessage('${chat}','${msgKey}')" title="Starred">${data.starred&&data.starred[myUsername]?'★':'☆'}</span>
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
    // INSTANT receipt refresh
    if (data.from === myUsername && receiptOn) {
      let receipt = "";
      let readKeys = Object.keys(data.readby||{}).filter(u => u !== myUsername);
      let bothDelivered = isPersonalChat && recipients.length >= 2 && readKeys.length >= 1;
      let bothSeen = isPersonalChat && recipients.length >= 2 &&
        readKeys.length >= 1 && data.readby[recipients.find(r=>r!==myUsername)];
      if (!bothDelivered) {
        receipt = `<span class="read-receipt" style="color:#bbb">✔</span>`;
      } else if (bothSeen) {
        receipt = `<span class="read-receipt" style="color:#3259ff">✔✔</span>`;
      } else {
        receipt = `<span class="read-receipt" style="color:#bbb">✔✔</span>`;
      }
      const receiptEl = div.querySelector('.read-receipt');
      if (receiptEl) receiptEl.outerHTML = receipt;
    }
  });

  if (data.from !== myUsername && (!data.readby || !data.readby[myUsername]))
    db.ref(`chats/${chat}/${msgKey}/readby/${myUsername}`).set(true);
};

// (other window handlers as previously provided)

window.onload = function() { updateChatOption(); };
window.addEventListener('click', function(e) {
  openChats.forEach(function(chat){
    const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
    if (pickerDiv && !pickerDiv.contains(e.target) && (!e.target.className || !e.target.className.includes('emoji-btn'))) { pickerDiv.style.display = "none"; }
  });
});
