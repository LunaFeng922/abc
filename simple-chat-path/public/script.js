let socket = io();

let formeElm = document.querySelector("#chatForm");
console.log(formeElm);
let msgInput = document.querySelector("#newMessage");
console.log(msgInput);
let nameInput = document.querySelector("#nameWrapper input");

const hateKeywords = ["hate you", "不爱你", "dislike you", "don't like you","don't love you","讨厌你", "恨你", "不喜欢你","不想你","don't miss you"];
const loveKeywords = ["love you","love u", "like you","like u","miss you","missing you","miss u","爱你", "喜欢你", "想你"];

const excludeKeywords = ["恨不恨你", "爱不爱你", "喜不喜欢你", "讨不讨厌你", "想不想你"];

let chatThreadList = document.querySelector("#threadWrapper ul");

let maxPadding = chatThreadList.offsetWidth / 3;

let paddingH = 0;

window.addEventListener('resize', pResized);

function pResized() {
    maxPadding = chatThreadList.offsetWidth / 3;
}

// DETECT AND UPDATE PADDING BASED ON MESSAGE
function detectAndUpdatePadding(message) {
    const lowerMessage = message.toLowerCase();

    // Check exclusions
    const exclude = excludeKeywords.some(pattern => 
        message.includes(pattern) || lowerMessage.includes(pattern.toLowerCase())
    );
    
    if (exclude) {
        return paddingH;
    }

    // Check for hate/love
    const isHate = hateKeywords.some(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
    );
    const isLove = loveKeywords.some(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
    );
    
    // Update paddings
    if (isLove) {
        paddingH = Math.min(paddingH + maxPadding/10, maxPadding);
    } else if (isHate) {
        paddingH = Math.max(paddingH - maxPadding/5, 0);
    }
    return paddingH;
}

// PADDING LI IN CSS
function paddingForEachThread(message, horizontal) {
    message.style.setProperty('--li-padding-horizontal', horizontal + 'px');
}

// LISTEN FOR NEWLY TYPES MESSAGES
formeElm.addEventListener("submit", newMessageSubmitted);

function newMessageSubmitted(event){
    console.log("typed a message!", event);
    event.preventDefault();

    let newMsg = msgInput.value;

    let messageData = {
        sender: nameInput.value,
        message: newMsg
    };
    
    // SEND THEM TO THE SERVER
    socket.emit("messageFromClient", messageData);

    // clear textbox:
    msgInput.value = "";
}

// LISTEN FOR NEW MESSAGES FROM SERVER
socket.on("messageFromServer", function(msgData){
    console.log("got a message i think? ", msgData);
    appendMessage(msgData);
});

// APPEND MESSAGES TO BOX
function appendMessage(data){  
    // Detect message type and update padding
    const newPaddingH = detectAndUpdatePadding(data.message);

    // Create new list item (li)
    let newListItem = document.createElement("li");
    
    // Set padding for specific li
    paddingForEachThread(newListItem, newPaddingH);

    // Separate messages from self and others
    if (data.sender === nameInput.value) {
        newListItem.classList.add("me");
    } else {
        newListItem.classList.add("other");
    }

    // Sender
    let who = document.createElement("span");
    who.className = "who";
    who.innerText = data.sender;
    newListItem.append(who);

    // Message
    let words = document.createElement("span");
    words.className = "words";
    words.innerText = data.message;
    newListItem.append(words);

    // Append new li to the list 
    chatThreadList.append(newListItem);

    // Scroll to bottom of textbox
    chatThreadList.scrollTop = chatThreadList.scrollHeight;
}
