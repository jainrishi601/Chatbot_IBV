document.addEventListener('DOMContentLoaded', () => {
  const uniqueId = generateUniqueId();
  const voiceflowRuntime = 'general-runtime.voiceflow.com';
  const voiceflowVersionID = 'production';
  const voiceflowAPIKey = 'VF.DM.66bc2822adfea22165673090.oHobICHQxQM99URr';

  let audio = new Audio();
  const wave = document.getElementById('wave');
  const input = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const recordButton = document.getElementById('record-button');
  const responseContainer = document.getElementById('response-container');
  const inputPlaceholder = document.getElementById('input-placeholder');
  const messageContainer = document.getElementById('message-container');

  let recognizing = false;
  let isChatbotSpeaking = false;
  let finalTranscript = '';
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.interimResults = true; // Enable interim results to capture speech as it is spoken
  recognition.maxAlternatives = 1;

  var instance = new SiriWave({
    container: document.getElementById('wave'),
    width: 300,
    height: 120,
    autostart: false,
    curveDefinition: [
      { attenuation: -2, lineWidth: 0.25, opacity: 0.1 },
      { attenuation: -6, lineWidth: 0.15, opacity: 0.2 },
      { attenuation: 4, lineWidth: 0.05, opacity: 0.4 },
      { attenuation: 2, lineWidth: 0.15, opacity: 0.6 },
      { attenuation: 1, lineWidth: 0.2, opacity: 0.9 },
    ],
  });

  inputPlaceholder.addEventListener('click', () => {
    input.focus();
  });

  input.addEventListener('click', () => {
    if (!inputPlaceholder.classList.contains('hidden')) {
      inputPlaceholder.style.animation = 'fadeOut 0.5s forwards';
      setTimeout(() => {
        inputPlaceholder.classList.add('hidden');
      }, 500);
    }
  });

  input.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleUserInput(input.value.trim());
    }
  });

  sendButton.addEventListener('click', () => {
    handleUserInput(input.value.trim());
  });

  recordButton.addEventListener('click', () => {
    if (isChatbotSpeaking) {
      alert("Please wait until the chatbot finishes speaking before recording your voice.");
      return;
    }

    if (recognizing) {
      stopListening();
    } else {
      startListening();
    }
  });

  function startListening() {
    recognition.start();
    recognizing = true;
    finalTranscript = ''; // Clear the transcript when starting
    recordButton.textContent = 'Stop Recording'; // Change button text when recording
    wave.style.opacity = '1';
    instance.start();
  }

  function stopListening() {
    recognition.stop();
    recognizing = false;
    recordButton.textContent = 'Start Recording'; // Change button text when stopped
    wave.style.opacity = '0';
    instance.stop();
  }

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // Update the input with interim and final results
    input.value = finalTranscript + interimTranscript;
  };

  recognition.onend = () => {
    if (finalTranscript.trim()) {
      handleUserInput(finalTranscript.trim()); // Send the final transcript to the chatbot when speech recognition ends
    }
    recognizing = false;
    wave.style.opacity = '0';
    instance.stop();
    recordButton.textContent = 'Start Recording';
  };

  function handleUserInput(userInput) {
    if (userInput) {
      input.disabled = true;
      input.value = '';
      displayMessage(userInput, 'user-message');
      interactWithBot(userInput);
    }
  }

  async function interactWithBot(inputText) {
    let body = {
      config: { tts: true, stripSSML: true },
      action: { type: 'text', payload: inputText },
    };

    if (inputText === '#launch#') {
      body = {
        config: { tts: true, stripSSML: true },
        action: { type: 'launch' },
      };
    }

    try {
      const response = await fetch(`https://${voiceflowRuntime}/state/user/${uniqueId}/interact/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: voiceflowAPIKey,
          versionID: voiceflowVersionID,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      displayResponse(data);
    } catch (error) {
      console.error('Error interacting with bot:', error);
      displayMessage('Sorry, something went wrong. Please try again.', 'bot-message');
    }
  }

  function displayResponse(response) {
    if (!response || response.length === 0) {
      displayMessage('Sorry, no response from the bot.', 'bot-message');
      return;
    }

    let audioQueue = [];
    let textQueue = [];

    response.forEach((item) => {
      if (item.type === 'speak' && item.payload.type === 'message') {
        textQueue.push(item.payload.message);
        audioQueue.push(item.payload.src);
      } else if (item.type === 'text') {
        textQueue.push(item.payload.message);
      }
    });

    textQueue.forEach((message) => {
      displayMessage(message, 'bot-message');
    });

    isChatbotSpeaking = true; // Set flag to true when chatbot starts speaking
    playNextAudio(audioQueue);
  }

  function playNextAudio(audioQueue) {
    if (audioQueue.length === 0) {
      isChatbotSpeaking = false; // Reset flag when chatbot finishes speaking
      input.disabled = false;
      input.focus();
      return;
    }

    const audioSrc = audioQueue.shift();
    audio = new Audio(audioSrc);

    wave.style.opacity = '1';
    instance.start();

    audio.addEventListener('canplaythrough', () => {
      audio.play();
    });

    audio.addEventListener('ended', () => {
      instance.stop();
      wave.style.opacity = '0';
      playNextAudio(audioQueue);
    });

    audio.addEventListener('error', () => {
      console.error('Error playing audio:', audio.error);
      instance.stop();
      wave.style.opacity = '0';
      playNextAudio(audioQueue);
    });
  }

  function displayMessage(messageText, messageType) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', messageType);
    messageElement.textContent = messageText;

    responseContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  function generateUniqueId() {
    const randomStr = Math.random().toString(36).substring(2, 8);
    const dateTimeStr = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');
    return randomStr + dateTimeStr;
  }
});
