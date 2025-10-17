// Firebase E2EE setup
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
let peerUsername = "";
let sessionKey = null;
let myKeyPair = null;
let myPubB64 = null;
let myPrivJwk = null;
let peerPubKey = null;
let receiptOn = true;

// Utility helpers for E2EE
function bufToB64(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}
function b64ToBuf(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256"},
    true,
    ["encrypt", "decrypt"]
  );
}
async function exportPubKey(key) {
  let spki = await window.crypto.subtle.exportKey("spki", key);
  return bufToB64(spki);
}
async function exportPrivJwk(key) {
  return await window.crypto.subtle.exportKey("jwk", key);
}
async function importPrivKey(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {name:"RSA-OAEP", hash:"SHA-256"},
    true,
    ["decrypt"]
  );
}
async function importPubKey(b64) {
  return await window.crypto.subtle.importKey(
    "spki",
    b64ToBuf(b64),
    {name:"RSA-OAEP", hash:"SHA-256"},
    true,
    ["encrypt"]
  );
}
async function generateSessionKey() {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
async function exportSessionKey(key) {
  let raw = await window.crypto.subtle.exportKey("raw", key);
  return bufToB64(raw);
}
async function importSessionKey(b64) {
  return await window.crypto.subtle.importKey(
    "raw", b64ToBuf(b64),
    {name:"AES-GCM"}, false, ["encrypt","decrypt"]
  );
}
async function encryptSessionKeyForPeer(sessionKey, peerPubKey) {
  let keyRaw = await window.crypto.subtle.exportKey("raw", sessionKey);
  return bufToB64(await window.crypto.subtle.encrypt({name:"RSA-OAEP"}, peerPubKey, keyRaw));
}
async function decryptSessionKeyForMe(encKey, myPrivKey) {
  let decrypted = await window.crypto.subtle.decrypt(
    {name:"RSA-OAEP"},
    myPrivKey,
    b64ToBuf(encKey)
  );
  return await window.crypto.subtle.importKey(
    "raw", decrypted,
    {name:"AES-GCM"}, false, ["encrypt","decrypt"]
  );
}
async function encryptMessage(text, sessionKey) {
  let iv = window.crypto.getRandomValues(new Uint8Array(12));
  let enc = await window.crypto.subtle.encrypt(
    {name: "AES-GCM", iv},
    sessionKey,
    new TextEncoder().encode(text)
  );
  return {
    iv: bufToB64(iv),
    ct: bufToB64(enc),
  };
}
async function decryptMessage(obj, sessionKey) {
  let buf = b64ToBuf(obj.ct);
  let ivBuf = b64ToBuf(obj.iv);
  let dec = await window.crypto.subtle.decrypt(
    {name: "AES-GCM", iv: ivBuf},
    sessionKey,
    buf
  );
  return new TextDecoder().decode(dec);
}

// THEME BUTTON - fixes dark/light mode
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

window.toggleReadReceipts = function() {
  receiptOn = document.getElementById('readReceipts').checked;
  document.querySelectorAll('.read-receipt').forEach(el => {
    el.style.display = receiptOn ? "" : "none";
  });
};

function normalize(str) { return str.trim().toLowerCase(); }

window.login = async function() {
  myUsername = normalize(document.getElementById('myUsername').value);
  if (!myUsername) { alert("Enter a username!"); return; }
  // Keypair logic: always import BOTH keys when loading from storage
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
  // Always get pubkey (for DB upload)
  myPubB64 = storedPub ? storedPub : await exportPubKey(myKeyPair.publicKey);
  // Publish own public key for others
  await db.ref('pubkeys/' + myUsername).set({pub: myPubB64});

  document.getElementById('loginSection').style.display = "none";
  document.getElementById('userSection').style.display = "block";
};

// ---- Session setup, chat features, etc ----

window.openChat = async function() {
  peerUsername = normalize(document.getElementById('chatName').value);
  if (!peerUsername) return alert("Enter friend's username!");
  let chatName = [myUsername, peerUsername].sort().join("_");
  // Key exchange: get peer's pubkey
  let peerSnap = await db.ref('pubkeys/' + peerUsername).once('value');
  if (!peerSnap.exists() || !peerSnap.val().pub) {
    alert("Cannot fetch peer public key. Make sure the other user is registered."); return;
  }
  peerPubKey = await importPubKey(peerSnap.val().pub);

  // SESSION KEY
  // 1. Check if session key exchange exists (from peer or self)
  let sessRef = db.ref('sessionkeys/' + chatName + '/' + myUsername);
  let sessSnap = await sessRef.once('value');
  if (sessSnap.exists() && sessSnap.val().encrypted && sessSnap.val().who == peerUsername) {
    // Peer provided it: decrypt with my private key
    sessionKey = await decryptSessionKeyForMe(sessSnap.val().encrypted, myKeyPair.privateKey);
  } else {
    // Generate, encrypt for peer, upload
    sessionKey = await generateSessionKey();
    let encKey = await encryptSessionKeyForPeer(sessionKey, peerPubKey);
    await sessRef.set({encrypted: encKey, who: myUsername});
  }

  // Setup chat window
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
    </div>
  `;
  document.getElementById('chatWindows').innerHTML = "";
  document.getElementById('chatWindows').appendChild(chatWin);

  db.ref('chats/' + chatName).off();
  db.ref('chats/' + chatName).on('child_added', async function(snapshot) {
    await showMessage(chatName, snapshot.key, snapshot.val());
    // Optionally auto-delete from server after display for pure E2EE.
    // await db.ref('chats/' + chatName + '/' + snapshot.key).remove();
  });
};

window.showSessionKey = async function() {
  if (!sessionKey) { alert("No session key yet! Open a chat first."); return; }
  let exported = await exportSessionKey(sessionKey);
  alert("Session key (base64): " + exported);
};

window.sendMessage = async function(chat) {
  const inp = document.getElementById(`msgInput-${chat}`);
  if (!inp.value) return;
  let plain = inp.value;
  let enc = await encryptMessage(plain, sessionKey);
  await db.ref('chats/' + chat).push(enc);
  inp.value = "";
};

// Show message
async function showMessage(chat, msgKey, data) {
  const box = document.getElementById(`chatBox-${chat}`);
  let text = sessionKey ? (await decryptMessage(data, sessionKey)) : "Encrypted";
  const div = document.createElement('div');
  div.className = "message me";
  div.innerHTML = `<span class="msg-bubble">${text}</span>
      <span class="time-stamp">${new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
