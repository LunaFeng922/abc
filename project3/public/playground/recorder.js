let myUserId = localStorage.getItem("user-id");
let myPetName = localStorage.getItem("curPetName") || "your pet";
let activeRecorder = null;
let isRequesting = false;
let pendingBlobs = {};

document
  .querySelectorAll(".my-pet-name")
  .forEach((el) => (el.innerText = myPetName));

document.querySelectorAll(".mic-btn").forEach((micBtn) => {
  micBtn.addEventListener("click", () => {
    if (isRequesting) return;
    isRequesting = true;

    let soundType = micBtn.dataset.type;
    let controls = micBtn.closest(".rec-controls");
    let countdownEl = controls.querySelector(".countdown-display");
    let waveform = controls.querySelector(".waveform");
    let stopBtn = controls.querySelector(".stop-rec-btn");

    if (!navigator.mediaDevices) {
      isRequesting = false;
      return;
    }
    if (activeRecorder && activeRecorder.state === "recording") {
      activeRecorder.stop();
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        isRequesting = false;

        // 倒计时
        let countdown = 3;
        micBtn.style.display = "none";
        countdownEl.style.display = "block";
        countdownEl.innerText = countdown;
        micBtn.classList.add("counting");

        let timer = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            countdownEl.innerText = countdown;
          } else {
            clearInterval(timer);
            countdownEl.style.display = "none";
            waveform.style.display = "flex";
            stopBtn.style.display = "block";
            startRecording();
          }
        }, 1000);

        function startRecording() {
          let chunks = [];
          let recorder = new MediaRecorder(stream);
          activeRecorder = recorder;

          recorder.ondataavailable = (e) => chunks.push(e.data);

          recorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            waveform.style.display = "none";
            stopBtn.style.display = "none";
            micBtn.style.display = "block";
            activeRecorder = null;

            let blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });

            // preview audio recorded
            let previewArea = document.getElementById("preview-" + soundType);
            previewArea.innerHTML = "";
            let player = document.createElement("audio");
            player.controls = true;
            player.src = URL.createObjectURL(blob);
            previewArea.appendChild(player);

            // send to server automatically
            let formData = new FormData();
            formData.append("sound", blob, "recording.mp3");
            formData.append("userId", myUserId);
            formData.append("soundType", soundType);

            fetch("/upload-sound", { method: "POST", body: formData }).then(
              () => {
                document.getElementById("upload-status").innerText =
                  "✅ Uploaded!";
                setTimeout(() => {
                  document.getElementById("upload-status").innerText = "";
                }, 2000);
              },
            );
          };

          recorder.start();

          // max 2 seconds
          setTimeout(() => {
            if (recorder.state === "recording") recorder.stop();
          }, 3000);
        }
      })
      .catch(() => {
        isRequesting = false;
      });
  });
});

document.querySelectorAll(".stop-rec-btn").forEach((stopBtn) => {
  stopBtn.addEventListener("click", () => {
    if (activeRecorder && activeRecorder.state === "recording") {
      activeRecorder.stop();
    }
  });
});

document.getElementById("audio-close").addEventListener("click", () => {
  document.getElementById("audio-panel").style.display = "none";
  document.getElementById("recorder-btn").classList.remove("active");
  currentTool = null;
});
