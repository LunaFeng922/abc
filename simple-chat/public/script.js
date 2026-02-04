let socket = io();

let formeElm = document.querySelector("#chatForm");
console.log(formeElm);
let msgInput = document.querySelector("#newMessage");
console.log(msgInput)

// LISTEN FOR NEWLY TYPES MESSAGES, 
formeElm.addEventListener("submit", newMessageSubmitted);

function newMessageSubmitted(event){
    console.log('type a message!',event);
    event.preventDefault();

    //console.log(msgInput.value);

    let newMsg = msgInput.value;
    // appendMessage(newMsg);

    // SEND THEM TO THE SERVER
    socket.emit('messageFromClient', newMsg);

    //clear input box
    msgInput.value = "";

}

// LISTEN FOR NEW MESSAGES FROM SERVER
// APPEND THEM TO THE MESSAGE BOX
// AUTO SCROLL TO BOTTOM
socket.on('messageFromServer', function(msgData){
    console.log('get a message', msgData);
    appendMessage(msgData.message);
})

// APPEND MESSAGES TO BOX
function appendMessage(txt){
    console.log(txt)
    // select list (ul) first
    let chatThreadList = document.querySelector("#threadWrapper ul");
    console.log(chatThreadList)

    // create new list item (li)
    let newListItem = document.createElement("li");
    newListItem.innerText = txt;

    // append new li to the list 
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox:
    chatThreadList.scrollTop = chatThreadList.scrollHeight;
}



// OPTIONAL: LISTEN FOR NEW NAME
// SEND IT TO SERVER
