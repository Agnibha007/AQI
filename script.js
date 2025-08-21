const inputField = document.getElementById("user-input");
const chatBox = document.getElementById("chat-messages");

let userLocation = null;

navigator.geolocation.getCurrentPosition(
  position => {
    console.log("Coords:", position.coords);
    userLocation = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
  },
  err => {
    console.error("Location error:", err.message);
  }
);

function sendMessage() {
  const msg = inputField.value.trim();
  if (!msg) return;

  appendMessage("user", msg);
  inputField.value = "";

  appendMessage("bot", "Typing...", "typing-indicator");
  handleChat(msg);
}

function appendMessage(sender, text, className = "") {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);
  if (className) messageDiv.classList.add(className);
  messageDiv.innerHTML = text;
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function handleChat(userMsg) {
  try {
    if (!userLocation) throw new Error("Location unavailable.");

    const aqiInfo = await fetchAQI(userLocation.lat, userLocation.lon);
    const prompt = `
You are an environmental assistant. Keep your response short (2–3 sentences) and friendly.
If the user asks for any other aqi related data, use https://api.openweathermap.org/data/2.5/air_pollution?lat=x(replace this)&lon=y(replace this)&appid="OPENWEATHER_API_KEY" to fetch the data where api key is 9af48c7cfc6d1aff9c9523f3a5f494c1
If you cannot answer a question, try to identify the aqi and environment by follow up question.
Also be able to answer follow up questions.
If image is there, identify the amount of pollution, it does not need to be extremely accurate.
If the user asks who you are trained by or made by, answer by Agnibha Mukherjee
AQI Info: ${aqiInfo}
User: ${userMsg}
    `.trim();

    const reply = await askGemini(prompt);

    const typingBubble = document.querySelector(".typing-indicator");
    if (typingBubble) typingBubble.remove();

    appendMessage("bot", markdownToHTML(reply));
  } catch (err) {
    const typingBubble = document.querySelector(".typing-indicator");
    if (typingBubble) typingBubble.remove();

    appendMessage("bot", err.message);
  }
}

async function fetchAQI(lat, lon) {
  const url = `https://air-quality.p.rapidapi.com/history/airquality?lon=${lon}&lat=${lat}`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': 'b9fb0591d7msh17f698b9f90efeep19da34jsndc5f07d878b3',
      'x-rapidapi-host': 'air-quality.p.rapidapi.com'
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const latest = data.data[0];
      return `AQI: ${latest.aqi}, PM2.5: ${latest.pm25}, PM10: ${latest.pm10}, O₃: ${latest.o3}`;
    } else {
      return "AQI data unavailable.";
    }
  } catch (error) {
    console.error("Error fetching AQI:", error);
    return "Could not fetch AQI data.";
  }
}

async function askGemini(promptText) {
  const GEMINI_API_KEY = "AIzaSyBWjbAVhT9_U0Y0Vxb8a51Xb7_ZYb_y9pM";
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ]
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Invalid Input"
  );
}

function markdownToHTML(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/&lt;br&gt;|<br>/g, "<br>")
    .replace(/\n/g, "<br>");
}

inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

let videoStream = null;
let videoDevices = [];
let currentDeviceIndex = 0;
let capturedImageBase64 = null;

async function getCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices = devices.filter(d => d.kind === "videoinput");
}

async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }

  videoStream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : true
  });

  const videoEl = document.getElementById("video");
  videoEl.srcObject = videoStream;
}

async function switchCamera() {
  if (videoDevices.length === 0) await getCameras();
  currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
  const deviceId = videoDevices[currentDeviceIndex].deviceId;
  await startCamera(deviceId);
}

function captureImage() {
  const videoEl = document.getElementById("video");
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const imageDataURL = canvas.toDataURL("image/jpeg");
  capturedImageBase64 = imageDataURL.replace(/^data:image\/jpeg;base64,/, "");

  appendMessage("user", `<img src="${imageDataURL}" style="max-width: 200px; border-radius: 8px;">`);
}

async function askGeminiWithImage(question, base64Image) {
  const GEMINI_API_KEY = "AIzaSyBWjbAVhT9_U0Y0Vxb8a51Xb7_ZYb_y9pM";
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        },
        { text: question }
      ]
    }]
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "AI did not return a valid response."
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const cameraSection = document.getElementById("camera-section");
  const toggleCameraBtn = document.getElementById("toggle-camera-btn");

  if (cameraSection && toggleCameraBtn) {
    cameraSection.style.display = "none";
    toggleCameraBtn.addEventListener("click", async () => {
      if (cameraSection.style.display === "none") {
        cameraSection.style.display = "block";
        await getCameras();
        if (videoDevices.length > 0) {
          await startCamera(videoDevices[0].deviceId);
        }
        toggleCameraBtn.textContent = "Close Camera";
      } else {
        cameraSection.style.display = "none";
        if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
        }
        toggleCameraBtn.textContent = "Open Camera";
      }
    });
  }
});