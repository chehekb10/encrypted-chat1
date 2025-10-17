const firebaseConfig = {
  apiKey: "AIzaSyAXPwge9me10YI38WFSIOQ1Lr-IzKrbUHA",
  authDomain: "pted-chat1.firebaseapp.com",
  databaseURL: "https://pted-chat1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pted-chat1",
  storageBucket: "pted-chat1.appspot.com",
  messagingSenderId: "27789922441",
  appId: "1:27789922441:web:9a196f0040b64b2a2ff658"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function bufToB64(buffer) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer))); }
function b64ToBuf(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256"},
    true, ["encrypt", "decrypt"]
  );
}
async function exportPubKey(key) {
  let spki = await window.crypto.subtle.exportKey("spki", key);
  return bufToB64(spki);
}
async function exportPrivJwk(key) { return await window.crypto.subtle.exportKey("jwk", key); }
async function importPrivKey(jwk) {
  return await window.crypto.subtle.importKey("jwk", jwk, {name:"RSA-OAEP", hash:"SHA-256"}, true, ["decrypt"]);
}
async function importPubKey(b64) {
  return await window.crypto.subtle.importKey("spki", b64ToBuf(b64), {name:"RSA-OAEP", hash:"SHA-256"}, true, ["encrypt"]);
}
async function generateSessionKey() { return await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]); }
async function exportSessionKey(key) { let raw = await window.crypto.subtle.exportKey("raw", key); return bufToB64(raw);}
async function importSessionKey(b64) { return await window.crypto.subtle.importKey("raw", b64ToBuf(b64), {name:"AES-GCM"}, false, ["encrypt","decrypt"]); }
async function encryptSessionKeyForPeer(sessionKey, peerPubKey) {
  let keyRaw = await window.crypto.subtle.exportKey("raw", sessionKey);
  return bufToB64(await window.crypto.subtle.encrypt({name:"RSA-OAEP"}, peerPubKey, keyRaw));
}
async function decryptSessionKeyForMe(encKey, myPrivKey) {
  let decrypted = await window.crypto.subtle.decrypt({name:"RSA-OAEP"}, myPrivKey, b64ToBuf(encKey));
  return await window.crypto.subtle.importKey("raw", decrypted, {name:"AES-GCM"}, false, ["encrypt","decrypt"]);
}
async function encryptMessage(text, sessionKey) {
  let iv = window.crypto.getRandomValues(new Uint8Array(12));
  let enc = await window.crypto.subtle.encrypt({name: "AES-GCM", iv}, sessionKey, new TextEncoder().encode(text));
  return { iv: bufToB64(iv), ct: bufToB64(enc) };
}
async function decryptMessage(obj, sessionKey) {
  let buf = b64ToBuf(obj.ct), ivBuf = b64ToBuf(obj.iv);
  let dec = await window.crypto.subtle.decrypt({name: "AES-GCM", iv: ivBuf}, sessionKey, buf);
  return new TextDecoder().decode(dec);
}

let myUsername = "", peerUsername = "", sessionKey = null;
let myKeyPair = null, myPubB64 = null, myPrivJwk = null, peerPubKey = null;
let hideForMe = {};
const emojiList = "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 🤪 😝 😛 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶".split(" ");

window.toggleTheme = function() {
  document.body.classList.toggle('dark');
  document.getElementById("themeBtn").innerText = document.body.classList.contains('dark') ? "☀️" : "🌙";
};

function normalize(str) { return str.trim().toLowerCase(); }

window.login = async function() {
  myUsername = normalize(document.getElementById('myUsername').value);
  if (!myUsername) { alert("Enter a username!"); return; }
  let storedPriv = window.localStorage.getItem("privkey_"+myUsername);
  let storedPub = window.localStorage.getItem("pubkey_"+myUsername);
  if (storedPriv && storedPub) {
    myPrivJwk = JSON.parse(storedPriv);
    myKeyPair = {
      publicKey: await importPubKey(storedPub),
      privateKey: await importPrivKey(myPrivJwk)
    };
  } else {
    myKeyPair = await generateKeyPair();
    myPrivJwk = await exportPrivJwk(myKeyPair.privateKey);
    myPubB64 = await exportPubKey(myKeyPair.publicKey);
    window.localStorage.setItem("privkey_" + myUsername, JSON.stringify(myPrivJwk));
    window.localStorage.setItem("pubkey_" + myUsername, myPubB64);
  }
  myPubB64 = storedPub ? storedPub : await exportPubKey(myKeyPair.publicKey);
  await db.ref('pubkeys/' + myUsername).set({pub: myPubB64});
  document.getElementById('loginSection').style.display = "none";
  document.getElementById('userSection').style.display = "block";
};

window.openChat = async function() {
  peerUsername = normalize(document.getElementById('chatName').value);
  if (!peerUsername) return alert("Enter friend's username!");
  let chatName = [myUsername, peerUsername].sort().join("_");
  let peerSnap = await db.ref('pubkeys/' + peerUsername).once('value');
  if (!peerSnap.exists() || !peerSnap.val().pub) {
    alert("Cannot fetch peer public key. Make sure the other user is registered."); return;
  }
  peerPubKey = await importPubKey(peerSnap.val().pub);

  let sessRef = db.ref('sessionkeys/' + chatName);
  let sessSnap = await sessRef.once('value');
  let sessData = sessSnap.val();
  if (sessData && sessData.encrypted && sessData.who !== myUsername) {
    sessionKey = await decryptSessionKeyForMe(sessData.encrypted, myKeyPair.privateKey);
  } else {
    sessionKey = await generateSessionKey();
    let encKey = await encryptSessionKeyForPeer(sessionKey, peerPubKey);
    await sessRef.set({ encrypted: encKey, who: myUsername });
  }

  setupChatWindow(chatName);

  db.ref('chats/' + chatName).off();
  db.ref('chats/' + chatName).on('child_added', async function(snapshot) {
    await showMessage(chatName, snapshot.key, snapshot.val());
  });
  db.ref('chats/' + chatName).on('child_removed', function(snapshot) {
    const box = document.getElementById(`msg-${snapshot.key}`);
    if (box) box.remove();
  });
  db.ref('chats/' + chatName).on('child_changed', async function(snapshot) {
    const box = document.getElementById(`msg-${snapshot.key}`);
    if (!box) return;
    let data = snapshot.val();
    let text = "[decryption failed]";
    if (data.ct && data.iv && sessionKey) {
      try { text = await decryptMessage(data, sessionKey); }
      catch { text = "[decryption failed]"; }
    } else if (data.message) {
      text = data.message;
    }
    const bubble = box.querySelector('.msg-bubble');
    if (bubble) bubble.textContent = text;
  });
};

function setupChatWindow(chatName) {
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
      <button class="emoji-btn" style="font-size:2.1em;background:#f6f6f6;border:none;" onclick="toggleEmojiPicker('${chatName}')">😀</button>
      <div class="emoji-picker" id="emojiPicker-${chatName}" style="display:none;"></div>
    </div>
  `;
  document.getElementById('chatWindows').innerHTML = "";
  document.getElementById('chatWindows').appendChild(chatWin);
  const pickerDiv = document.getElementById(`emojiPicker-${chatName}`);
  emojiList.forEach(e => {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.textContent = e;
    btn.onclick = function () { insertEmoji(chatName, e); };
    pickerDiv.appendChild(btn);
  });
}

window.showSessionKey = async function() {
  if (!sessionKey) { alert("No session key yet! Open a chat first."); return; }
  let exported = await exportSessionKey(sessionKey);
  alert("Session key (base64): " + exported);
};

window.toggleEmojiPicker = function(chat) {
  const pickerDiv = document.getElementById(`emojiPicker-${chat}`);
  pickerDiv.style.display = pickerDiv.style.display === "none" ? "flex" : "none";
};
window.insertEmoji = function(chat, emoji) {
  const inp = document.getElementById(`msgInput-${chat}`);
  inp.value += emoji;
  document.getElementById(`emojiPicker-${chat}`).style.display = "none"; inp.focus();
};

window.sendMessage = async function(chat) {
   console.log("[sendMessage] myUsername:", myUsername, "peerUsername:", peerUsername);
  const inp = document.getElementById(`msgInput-${chat}`);
  if (!inp.value) return;

  // Generate rotating session key
  let newSessionKey = await generateSessionKey();
  let encKeyForMe = await encryptSessionKeyForPeer(newSessionKey, myKeyPair.publicKey);
  let encKeyForPeer = await encryptSessionKeyForPeer(newSessionKey, peerPubKey);

  // Assign A/B fields based on lexicographic order
  let sessionKeyFields = {};
  if (myUsername < peerUsername) {
    sessionKeyFields.sessionKeyForA = encKeyForMe;
    sessionKeyFields.sessionKeyForB = encKeyForPeer;
  } else {
    sessionKeyFields.sessionKeyForA = encKeyForPeer;
    sessionKeyFields.sessionKeyForB = encKeyForMe;
  }

  let plain = inp.value;
  let enc = await encryptMessage(plain, newSessionKey);

  await db.ref('chats/' + chat).push({
    ...enc,
    ...sessionKeyFields,
    from: myUsername,
    starred: {},
    timestamp: Date.now()
  });

  sessionKey = newSessionKey;
  inp.value = "";
};




async function showMessage(chat, msgKey, data) {
  let encKey = (myUsername < peerUsername) ? data.sessionKeyForA : data.sessionKeyForB;
console.log("Trying to decrypt", msgKey, "with encKey", encKey, "myUsername", myUsername, "peerUsername", peerUsername);
let text = "[decryption failed]";
  try {
    // Select encrypted session key based on username sort order
    let encKey = (myUsername < peerUsername) ? data.sessionKeyForA : data.sessionKeyForB;

    if (encKey && data.ct && data.iv) {
      let thisMsgSessionKey = await decryptSessionKeyForMe(encKey, myKeyPair.privateKey);
      text = await decryptMessage(data, thisMsgSessionKey);
    } else if (data.message) {
      text = data.message;
    }
  } catch (e) {
    text = "[decryption failed]";
  }

  const box = document.getElementById(`chatBox-${chat}`);
  if (!box) return;
  if (hideForMe[chat] && hideForMe[chat][msgKey]) return;

  const div = document.createElement('div');
  div.className = "message" + (data.from === myUsername ? " me" : "");
  div.id = `msg-${msgKey}`;

  let actions = "";
  if (data.from === myUsername) {
    actions = `<span class="msg-actions">
        <button class="action-btn" onclick="editMessage('${chat}','${msgKey}')">Edit</button>
        <button class="action-btn" onclick="deleteForMe('${chat}','${msgKey}')">Delete for Me</button>
        <button class="action-btn" onclick="deleteMessage('${chat}','${msgKey}')">Delete for Everyone</button>
        <span class="star-btn" onclick="starMessage('${chat}','${msgKey}')" title="Starred">${data.starred && data.starred[myUsername] ? '★' : '☆'}</span>
      </span>`;
  }
  let localTime = new Date(data.timestamp || 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let time = `<span class="time-stamp">${localTime}</span>`;
  div.innerHTML = `<span class="msg-name">${data.from}</span><span class="msg-bubble">${text}</span>${time}${actions}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;

  // Live star updates
  db.ref(`chats/${chat}/${msgKey}`).on('value', function(snap) {
    const d = snap.val();
    if (!d) return;
    const starBtn = document.querySelector(`#msg-${msgKey} .star-btn`);
    if (starBtn) {
      if (d.starred && d.starred[myUsername]) {
        starBtn.classList.add('star-icon');
        starBtn.textContent = "★";
      } else {
        starBtn.classList.remove('star-icon');
        starBtn.textContent = "☆";
      }
    }
  });
}


window.editMessage = function(chat, msgKey) {
  const msgDiv = document.getElementById(`msg-${msgKey}`);
  if (!msgDiv) return;
  const bubble = msgDiv.querySelector('.msg-bubble');
  if (!bubble) return; // Prevents error if bubble is missing
  const oldMsg = bubble.textContent;
  let finished = false;
  const inp = document.createElement("input");
  inp.type = "text"; inp.style = "width:83%"; inp.value = oldMsg;
  bubble.replaceWith(inp);
  inp.focus();
  inp.onblur = function() {
    if (!finished) finishEdit(msgDiv, chat, msgKey, inp.value);
    finished = true;
  };
  inp.onkeydown = function(e) {
    if (e.key === "Enter") { finishEdit(msgDiv, chat, msgKey, inp.value); finished = true; }
  };
};

async function finishEdit(msgDiv, chat, msgKey, newText) {
  let newSessionKey = await generateSessionKey();
  let encKeyForMe = await encryptSessionKeyForPeer(newSessionKey, myKeyPair.publicKey);
  let encKeyForPeer = await encryptSessionKeyForPeer(newSessionKey, peerPubKey);

  let sessionKeyFields = {};
  if (myUsername < peerUsername) {
    sessionKeyFields.sessionKeyForA = encKeyForMe;
    sessionKeyFields.sessionKeyForB = encKeyForPeer;
  } else {
    sessionKeyFields.sessionKeyForA = encKeyForPeer;
    sessionKeyFields.sessionKeyForB = encKeyForMe;
  }

  let enc = await encryptMessage(newText, newSessionKey);

  await db.ref(`chats/${chat}/${msgKey}/ct`).set(enc.ct);
  await db.ref(`chats/${chat}/${msgKey}/iv`).set(enc.iv);
  await db.ref(`chats/${chat}/${msgKey}/sessionKeyForA`).set(sessionKeyFields.sessionKeyForA);
  await db.ref(`chats/${chat}/${msgKey}/sessionKeyForB`).set(sessionKeyFields.sessionKeyForB);
}



window.deleteForMe = function(chat, msgKey) {
  hideForMe[chat] = hideForMe[chat] || {};
  hideForMe[chat][msgKey] = true;
  let box = document.getElementById(`msg-${msgKey}`);
  if (box) { box.classList.add('delete-anim'); setTimeout(() => box.remove(), 220); }
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

window.onload = function() {
  document.getElementById("chatTabs").innerHTML = "";
  document.getElementById("chatWindows").innerHTML = "";
};
