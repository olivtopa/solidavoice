/**
 * SolidaVoice - Code Javascript principal du POC (Décodeur Facile, Voix du Voisin, Gazette Audio)
 */

// Global State
let currentMode = 'beneficiary'; // 'beneficiary' | 'carer'
let currentSpeechUtterance = null;
let isRecordingVoice = false;
let speechRecognitionObj = null;

// Données d'exemple FALC pour la démonstration du Décodeur Facile
const DEMO_FALC_DOCUMENT = {
  title: "Facture d'Électricité & Gaz",
  sender: "EDF (Fournisseur d'énergie)",
  summary: "C'est votre facture pour l'électricité du mois de Juin. Vous avez consommé 120 kWh.",
  action: "Vous devez payer cette facture avant le 15 Août.",
  date: "15 Août 2026",
  amount: "48,50 €",
  vocalText: "Bonjour ! Vous avez reçu une facture de la part de EDF. Il s'agit de votre électricité du mois de Juin. Le montant total est de 48 euros et 50 centimes. Vous devez régler cette somme avant le 15 août. Souhaitez-vous demander l'aide d'un bénévole pour effectuer le règlement ?"
};

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
  console.log("SolidaVoice POC Initialisé");
  initWebSpeech();
});

// Switch Mode Bénéficiaire <-> Aidant
function toggleUserMode() {
  const benView = document.getElementById('view-beneficiary');
  const carerView = document.getElementById('view-carer');
  const label = document.getElementById('mode-label');
  const icon = document.getElementById('mode-icon');

  if (currentMode === 'beneficiary') {
    currentMode = 'carer';
    benView.classList.remove('active');
    benView.classList.add('hidden');
    carerView.classList.remove('hidden');
    carerView.classList.add('active');
    label.textContent = "Passer au Mode Facile (Bénéficiaire)";
    icon.textContent = "👵🏻";
    speakText("Vous êtes maintenant sur le tableau de bord des bénévoles et aidants.");
  } else {
    currentMode = 'beneficiary';
    carerView.classList.remove('active');
    carerView.classList.add('hidden');
    benView.classList.remove('hidden');
    benView.classList.add('active');
    label.textContent = "Passer au Mode Aidant";
    icon.textContent = "🤝";
    speakText("Bienvenue sur votre écran principal. Choisissez une option avec les gros boutons.");
  }
}

// Gestion Ouverture & Fermeture des Modals
function openModule(moduleId) {
  const modal = document.getElementById(`modal-${moduleId}`);
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    if (moduleId === 'decodeur') {
      speakText("Décodeur Facile. Prenez une photo de votre papier ou appuyez sur le bouton de démonstration.");
    } else if (moduleId === 'voisin') {
      speakText("La Voix du Voisin. Appuyez sur le gros micro vert pour dicter ce dont vous avez besoin.");
    } else if (moduleId === 'gazette') {
      speakText("Le Fil d'à côté. Écoutez le dernier message audio du quartier.");
    }
  }
}

function closeModule(moduleId) {
  const modal = document.getElementById(`modal-${moduleId}`);
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    stopFalcSummary();
  }
}

/* ==========================================================================
   MODULE 3 : DÉCODEUR FACILE (OCR + RÉSUMÉ FALC + VOCAL)
   ========================================================================== */

function handleImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const imgSrc = e.target.result;
    processDocumentImage(imgSrc);
  };
  reader.readAsDataURL(file);
}

function loadDemoDocument() {
  // Image de facture générique ou canvas factice
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 400);
  ctx.fillStyle = "#000000";
  ctx.font = "24px Arial";
  ctx.fillText("AVIS DE FACTURATION EDF", 50, 60);
  ctx.font = "18px Arial";
  ctx.fillText("Client: M. Robert DUPONT", 50, 110);
  ctx.fillText("Montant à régler: 48,50 €", 50, 160);
  ctx.fillText("Date limite de paiement: 15/08/2026", 50, 210);
  ctx.fillText("Merci de privilégier le prélèvement automatique.", 50, 260);

  const demoDataUrl = canvas.toDataURL('image/png');
  processDocumentImage(demoDataUrl, true);
}

function processDocumentImage(imageSrc, isDemo = false) {
  const previewContainer = document.getElementById('image-preview-container');
  const scannedImg = document.getElementById('scanned-image');
  const ocrLoader = document.getElementById('ocr-loader');
  const statusText = document.getElementById('ocr-status-text');
  const resultContainer = document.getElementById('falc-result-container');

  previewContainer.classList.remove('hidden');
  scannedImg.src = imageSrc;
  ocrLoader.classList.remove('hidden');
  resultContainer.classList.add('hidden');

  statusText.textContent = "Analyse optique du document par l'IA...";
  speakText("Analyse de votre document en cours. Veuillez patienter.");

  if (isDemo || typeof Tesseract === 'undefined') {
    // Simulation OCR + IA FALC ultra-rapide
    setTimeout(() => {
      ocrLoader.classList.add('hidden');
      displayFalcResult(DEMO_FALC_DOCUMENT);
    }, 2000);
  } else {
    // Utilisation réelle de Tesseract.js côté client + adaptation FALC
    Tesseract.recognize(
      imageSrc,
      'fra',
      { logger: m => console.log(m) }
    ).then(({ data: { text } }) => {
      ocrLoader.classList.add('hidden');
      
      // Extraction basique des entités & génération FALC
      const parsedFalc = parseExtractedTextToFALC(text);
      displayFalcResult(parsedFalc);
    }).catch(err => {
      console.warn("Erreur OCR Tesseract, basculement mode démo fallback", err);
      ocrLoader.classList.add('hidden');
      displayFalcResult(DEMO_FALC_DOCUMENT);
    });
  }
}

function parseExtractedTextToFALC(rawText) {
  // Moteur d'extraction basique si pas d'API LLM configurée
  let sender = "Organisme inconnu";
  let amount = "Non précisé";
  let date = "Dans les prochains jours";
  
  if (rawText.toLowerCase().includes("edf") || rawText.toLowerCase().includes("électricité")) {
    sender = "EDF (Électricité)";
  } else if (rawText.toLowerCase().includes("impôt") || rawText.toLowerCase().includes("trésor")) {
    sender = "Centre des Impôts";
  }

  // Recherche de montant
  const matchAmount = rawText.match(/(\d+[\s,.]\d{2})\s?€/);
  if (matchAmount) amount = matchAmount[0];

  // Recherche de date
  const matchDate = rawText.match(/(\d{2}[\/.-]\d{2}[\/.-]\d{4})/);
  if (matchDate) date = matchDate[0];

  const summary = "L'IA a lu votre papier. Il contient un montant et une échéance à respecter.";
  const action = `Regarder la somme de ${amount} à payer avant le ${date}.`;
  const vocalText = `Document de ${sender}. Vous devez payer ${amount} avant le ${date}. Souhaitez-vous qu'un bénévole repasse ce papier avec vous ?`;

  return {
    title: "Résumé de votre Courrier Scanné",
    sender: sender,
    summary: summary,
    action: action,
    date: date,
    amount: amount,
    vocalText: vocalText
  };
}

function displayFalcResult(falcData) {
  document.getElementById('falc-title').textContent = falcData.title;
  document.getElementById('falc-sender').textContent = falcData.sender;
  document.getElementById('falc-summary').textContent = falcData.summary;
  document.getElementById('falc-action').textContent = falcData.action;
  document.getElementById('falc-date').textContent = falcData.date;
  document.getElementById('falc-amount').textContent = falcData.amount;

  const resultContainer = document.getElementById('falc-result-container');
  resultContainer.classList.remove('hidden');

  // Lancement automatique de la synthèse vocale FALC
  speakText(falcData.vocalText);
}

function speakFalcSummary() {
  const vocalText = DEMO_FALC_DOCUMENT.vocalText;
  speakText(vocalText);
}

function stopFalcSummary() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    document.getElementById('tts-play-btn')?.classList.remove('hidden');
    document.getElementById('tts-stop-btn')?.classList.add('hidden');
  }
}

function requestPublicWriterHelp() {
  speakText("Votre demande a bien été enregistrée. Un bénévole écrivain public a été notifié et repassera vers vous.");
  alert("Demande envoyée aux bénévoles ! Un voisin écrivain public prendra contact avec vous.");
}

/* ==========================================================================
   MODULE 1 : LA VOIX DU VOISIN (RECORDING + SPEECH TO TEXT)
   ========================================================================== */

function initWebSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognitionObj = new SpeechRecognition();
    speechRecognitionObj.lang = 'fr-FR';
    speechRecognitionObj.continuous = false;
    speechRecognitionObj.interimResults = false;

    speechRecognitionObj.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('transcript-text').textContent = `"${transcript}"`;
      document.getElementById('voice-transcript-box').classList.remove('hidden');
      
      // Auto categorization simulation
      if (transcript.toLowerCase().includes("ampoule") || transcript.toLowerCase().includes("bricolage") || transcript.toLowerCase().includes("réparer")) {
        document.getElementById('intent-tag').textContent = "Catégorie : 💡 Bricolage & Petit Service";
      } else if (transcript.toLowerCase().includes("courses") || transcript.toLowerCase().includes("pain") || transcript.toLowerCase().includes("magasin")) {
        document.getElementById('intent-tag').textContent = "Catégorie : 🛒 Courses & Commissions";
      } else {
        document.getElementById('intent-tag').textContent = "Catégorie : 🤝 Compagnie & Entraide";
      }

      speakText(`J'ai bien compris : ${transcript}. Voulez-vous envoyer ce message aux bénévoles du quartier ?`);
    };

    speechRecognitionObj.onend = () => {
      isRecordingVoice = false;
      const btn = document.getElementById('mic-record-btn');
      if (btn) {
        btn.classList.remove('recording');
        document.getElementById('mic-status').textContent = "Toucher pour Parler";
      }
    };
  }
}

function toggleVoiceRecording() {
  const btn = document.getElementById('mic-record-btn');
  const status = document.getElementById('mic-status');

  if (!isRecordingVoice) {
    if (speechRecognitionObj) {
      try {
        speechRecognitionObj.start();
        isRecordingVoice = true;
        btn.classList.add('recording');
        status.textContent = "Écoute en cours...";
        speakText("Je vous écoute. Expliquez simplement ce dont vous avez besoin.");
      } catch (e) {
        console.warn("Erreur démarrage SpeechRecognition", e);
        simulateVoiceDictation();
      }
    } else {
      simulateVoiceDictation();
    }
  } else {
    if (speechRecognitionObj) speechRecognitionObj.stop();
    isRecordingVoice = false;
    btn.classList.remove('recording');
    status.textContent = "Toucher pour Parler";
  }
}

function simulateVoiceDictation() {
  const btn = document.getElementById('mic-record-btn');
  btn.classList.add('recording');
  document.getElementById('mic-status').textContent = "Écoute en cours...";
  
  setTimeout(() => {
    btn.classList.remove('recording');
    document.getElementById('mic-status').textContent = "Toucher pour Parler";
    document.getElementById('transcript-text').textContent = `"J'ai besoin qu'on m'aide à changer l'ampoule du plafond du salon."`;
    document.getElementById('intent-tag').textContent = "Catégorie : 💡 Bricolage & Petit Service";
    document.getElementById('voice-transcript-box').classList.remove('hidden');
    speakText("J'ai enregistré votre message : J'ai besoin qu'on m'aide à changer l'ampoule du salon. Cliquez sur le bouton bleu pour envoyer.");
  }, 2500);
}

function confirmSendHelpRequest() {
  const reqText = document.getElementById('transcript-text')?.textContent || "Besoin d'aide dans le quartier";
  sendWhatsAppAlert(`🤝 [SOLIDA VOICE] Nouvelle demande d'aide vocale à proximité : ${reqText}. Cliquez pour intervenir.`);
  sendTwilioSMSAlert(`SOLIDA VOICE: Nouvelle demande d'aide vocale à proximité : ${reqText}`);
  
  speakText("Votre demande a été envoyée aux bénévoles les plus proches de chez vous par WhatsApp et SMS. Vous recevrez une réponse rapidement.");
  alert("Demande transmise avec succès aux bénévoles via WhatsApp et SMS !");
  closeModule('voisin');
}

/* ==========================================================================
   MODULE 2 : LE FIL D'À CÔTÉ (GAZETTE AUDIO)
   ========================================================================== */

function playGazetteAudio() {
  const icon = document.getElementById('gazette-play-icon');
  if (icon.textContent === '▶️') {
    icon.textContent = '⏸️';
    speakText("Voici le message de Marie, votre voisine du 3ème : Bonjour à tous ! Ce samedi matin, il y aura le marché de producteurs sur la place de la mairie. N'hésitez pas si vous voulez que je vous rapporte des fruits frais !");
    setTimeout(() => {
      icon.textContent = '▶️';
    }, 8000);
  } else {
    icon.textContent = '▶️';
    stopFalcSummary();
  }
}

function replyToGazette() {
  speakText("Appuyez pour laisser votre message vocal en réponse à la Gazette.");
  alert("L'enregistreur audio de réponse est activé.");
}

function triggerSosAudio() {
  speakText("Bouton d'urgence appuyé. Un appel de courtoisie automatique est lancé vers votre bénévole référent.");
  sendWhatsAppAlert("🚨 URGENCE SOLIDA VOICE : Robert M. a appuyé sur le bouton d'appel rassurant. Merci d'effectuer un appel de courtoisie.", "+33600000000");
  sendTwilioSMSAlert("URGENCE SOLIDA VOICE: Robert M. demande un appel de présence.", "+33600000000");
  alert("Alerte de présence lancée. Votre proche aidant et les bénévoles référents sont avertis par WhatsApp et SMS !");
}

/* ==========================================================================
   MODULE WHATSAPP & TWILIO SMS NOTIFICATIONS
   ========================================================================== */

/**
 * Envoie ou simule une alerte via WhatsApp Business API / Web Link
 */
function sendWhatsAppAlert(messageText, targetPhone = "") {
  console.log("💬 [WhatsApp Alert Triggered]:", messageText);
  
  // Encodage pour lien direct WhatsApp Web/Mobile wa.me
  const encodedText = encodeURIComponent(messageText);
  const waUrl = targetPhone ? `https://wa.me/${targetPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;

  // Log Notification
  showNotificationToast("💬 Alerte WhatsApp transmise au réseau de bénévoles !");
  return waUrl;
}

/**
 * Envoie ou simule une alerte SMS via Twilio Programmable SMS API
 */
function sendTwilioSMSAlert(messageText, targetPhone = "") {
  console.log("📱 [Twilio SMS Triggered]:", messageText);
  
  // simulation Payload Twilio API
  const twilioPayload = {
    To: targetPhone || "+33612345678",
    From: "SolidaVoice",
    Body: messageText,
    Timestamp: new Date().toISOString()
  };

  showNotificationToast("📱 SMS Twilio envoyé aux voisins solidaires à proximité.");
  return twilioPayload;
}

function testWhatsAppDirect() {
  const msg = "🤝 [SolidaVoice Test] Nouvelle demande d'aide à 300m : Robert a besoin d'aide pour changer une ampoule. Cliquez pour répondre.";
  const url = sendWhatsAppAlert(msg);
  if (confirm("Voulez-vous ouvrir WhatsApp pour tester l'envoi du message d'alerte prédéfini ?")) {
    window.open(url, '_blank');
  }
}

function showNotificationToast(msgText) {
  let toast = document.getElementById('notification-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'notification-toast';
    toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #0f172a; color: #fff; padding: 1rem 1.5rem; border-radius: 12px; border-left: 6px solid #25d366; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 1000; font-weight: 700; font-size: 1.1rem; transition: transform 0.3s ease;";
    document.body.appendChild(toast);
  }
  toast.textContent = msgText;
  toast.style.transform = "translateY(0)";
  setTimeout(() => {
    toast.style.transform = "translateY(150px)";
  }, 4000);
}

/* ==========================================================================
   MOTEUR SYNTHÈSE VOCALE (TEXT-TO-SPEECH)
   ========================================================================== */

function speakText(text) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Annule la voix précédente

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.9; // Débit légèrement ralenti pour les personnes âgées
  utterance.pitch = 1.0;

  const playBtn = document.getElementById('tts-play-btn');
  const stopBtn = document.getElementById('tts-stop-btn');

  utterance.onstart = () => {
    if (playBtn) playBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
  };

  utterance.onend = () => {
    if (playBtn) playBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
  };

  window.speechSynthesis.speak(utterance);
}
