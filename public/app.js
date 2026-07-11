/**
   ==========================================================================
   LinkedIn Post Studio - Client Controller
   ==========================================================================
 */

// UI Elements
const postTypeSelect = document.getElementById('postType');
const imageUrlGroup = document.getElementById('imageUrlGroup');
const imageUrlInput = document.getElementById('imageUrl');
const postTopicInput = document.getElementById('postTopic');
const generateForm = document.getElementById('postGeneratorForm');
const generateBtn = document.getElementById('generateBtn');
const generateBtnText = document.getElementById('generateBtnText');

const previewAvatar = document.getElementById('previewAvatar');
const previewName = document.getElementById('previewName');
const previewHeadline = document.getElementById('previewHeadline');
const previewContent = document.getElementById('previewContent');
const previewMedia = document.getElementById('previewMedia');
const previewImage = document.getElementById('previewImage');
const previewActions = document.getElementById('previewActions');

const connectionStatus = document.getElementById('connectionStatus');
const statusLabel = document.getElementById('statusLabel');

// Settings modal elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsGeminiKey = document.getElementById('settingsGeminiKey');
const settingsLinkedinToken = document.getElementById('settingsLinkedinToken');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Actions inside preview
const regenerateBtn = document.getElementById('regenerateBtn');
const publishBtn = document.getElementById('publishBtn');
const publishBtnText = document.getElementById('publishBtnText');

const toastContainer = document.getElementById('toastContainer');

// Active Post State
let currentPostText = "";
let currentImagePath = null; // server local path for uploading
let currentImagePrompt = "";
let isPublishing = false;

// 1. Initialization and Connection Status
document.addEventListener('DOMContentLoaded', () => {
  // Load saved credentials from localStorage
  const savedGeminiKey = localStorage.getItem('gemini_api_key');
  const savedLinkedinToken = localStorage.getItem('linkedin_access_token');
  
  if (savedGeminiKey) settingsGeminiKey.value = savedGeminiKey;
  if (savedLinkedinToken) settingsLinkedinToken.value = savedLinkedinToken;

  updateConnectionStatus();
  toggleFields();
});

// Toggle conditionally visible form fields based on post type
postTypeSelect.addEventListener('change', toggleFields);

function toggleFields() {
  if (postTypeSelect.value === 'image') {
    imageUrlGroup.classList.add('show');
  } else {
    imageUrlGroup.classList.remove('show');
    imageUrlInput.value = '';
  }
}

// Request Headers Helper
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  
  const savedGeminiKey = localStorage.getItem('gemini_api_key');
  if (savedGeminiKey) headers['x-gemini-key'] = savedGeminiKey;

  const savedLinkedinToken = localStorage.getItem('linkedin_access_token');
  if (savedLinkedinToken) headers['x-linkedin-token'] = savedLinkedinToken;

  return headers;
}

// Check and Update Connection Status
async function updateConnectionStatus() {
  try {
    const response = await fetch('/api/status', {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) throw new Error("Status check failed");
    
    const data = await response.json();
    
    if (data.linkedinConfigured && !data.isMockMode) {
      connectionStatus.className = 'status-badge connected';
      statusLabel.textContent = `Connected: ${data.linkedinProfile?.name || 'LinkedIn User'}`;
    } else {
      connectionStatus.className = 'status-badge mock-mode';
      statusLabel.textContent = 'Development / Mock Mode';
    }

    // Update the LinkedIn preview profile header with real info if available
    if (data.linkedinProfile) {
      previewAvatar.src = data.linkedinProfile.avatar;
      previewName.textContent = data.linkedinProfile.name;
      // Use clean title
      previewHeadline.textContent = data.isMockMode 
        ? 'LinkedIn Creator & Software Engineer'
        : 'LinkedIn Active Professional';
    }
  } catch (error) {
    console.error("Status update error:", error);
    connectionStatus.className = 'status-badge mock-mode';
    statusLabel.textContent = 'Disconnected';
  }
}

// 2. Settings Modal Operations
openSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('show');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('show');
  }
});

saveSettingsBtn.addEventListener('click', () => {
  const geminiKey = settingsGeminiKey.value.trim();
  const linkedinToken = settingsLinkedinToken.value.trim();

  if (geminiKey) {
    localStorage.setItem('gemini_api_key', geminiKey);
  } else {
    localStorage.removeItem('gemini_api_key');
  }

  if (linkedinToken) {
    localStorage.setItem('linkedin_access_token', linkedinToken);
  } else {
    localStorage.removeItem('linkedin_access_token');
  }

  showToast('Settings saved successfully!', 'success');
  settingsModal.classList.remove('show');
  updateConnectionStatus();
});

// 3. Post Generation
generateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const topic = postTopicInput.value.trim();
  const type = postTypeSelect.value;
  const externalImageUrl = imageUrlInput.value.trim();

  if (!topic) return;

  // Set UI Loading States
  setGeneratingState(true);
  
  // Prepare LinkedIn Card Skeletons
  previewContent.innerHTML = `
    <div class="skeleton-line mid pulse-loading"></div>
    <div class="skeleton-line pulse-loading"></div>
    <div class="skeleton-line short pulse-loading"></div>
  `;

  if (type === 'image') {
    previewMedia.style.display = 'flex';
    previewMedia.className = 'linkedin-media loading';
    previewImage.style.display = 'none';
    previewImage.src = '';
  } else {
    previewMedia.style.display = 'none';
  }

  previewActions.style.display = 'none';

  try {
    // Step 3.1: Generate Post text and image prompt
    const response = await fetch('/api/generate-post', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ topic, type })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "AI post generation failed.");
    }

    const postData = await response.json();
    currentPostText = postData.postText;
    currentImagePrompt = postData.imagePrompt;

    // Display post text in preview
    previewContent.textContent = currentPostText;

    // Step 3.2: If Image post type, trigger server download or generation
    if (type === 'image') {
      const imgRes = await fetch('/api/prepare-image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          imageUrl: externalImageUrl || null,
          imagePrompt: currentImagePrompt
        })
      });

      if (!imgRes.ok) {
        const errData = await imgRes.json();
        throw new Error(errData.error || "Image preparation failed.");
      }

      const imgData = await imgRes.json();
      currentImagePath = imgData.imagePath;

      // Update image display source
      previewImage.src = imgData.localUrl;
      previewImage.style.display = 'block';
      previewMedia.className = 'linkedin-media'; // remove loading class
    } else {
      currentImagePath = null;
    }

    // Enable Preview Action Controls
    previewActions.style.display = 'flex';
    showToast('LinkedIn post draft generated!', 'success');

  } catch (error) {
    console.error("Post creation error:", error);
    showToast(error.message, 'error');
    
    // Reset preview on failure
    previewContent.textContent = "An error occurred during generation. Check your API Keys and try again.";
    previewMedia.style.display = 'none';
  } finally {
    setGeneratingState(false);
  }
});

function setGeneratingState(isGenerating) {
  if (isGenerating) {
    generateBtn.disabled = true;
    generateBtnText.textContent = "Generating Draft...";
    postTypeSelect.disabled = true;
    postTopicInput.disabled = true;
    imageUrlInput.disabled = true;
  } else {
    generateBtn.disabled = false;
    generateBtnText.textContent = "Generate Post Draft";
    postTypeSelect.disabled = false;
    postTopicInput.disabled = false;
    imageUrlInput.disabled = false;
  }
}

// 4. Publishing
publishBtn.addEventListener('click', async () => {
  if (isPublishing || !currentPostText) return;

  isPublishing = true;
  publishBtn.disabled = true;
  publishBtnText.textContent = "Publishing...";

  try {
    const response = await fetch('/api/publish-post', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        postText: currentPostText,
        imagePath: currentImagePath
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Publishing request failed.");
    }

    const data = await response.json();
    
    if (data.isMock) {
      showToast('Successfully simulated publish (Mock Mode)! Payload written to server logs.', 'warning');
    } else {
      showToast('Successfully published post to LinkedIn!', 'success');
    }

    // Reset post draft variables
    currentPostText = "";
    currentImagePath = null;
    currentImagePrompt = "";
    previewActions.style.display = 'none';
    
    // Open the post URL in a new window/tab
    if (data.permalink) {
      setTimeout(() => {
        window.open(data.permalink, '_blank');
      }, 1000);
    }

  } catch (error) {
    console.error("Publishing error:", error);
    showToast(error.message, 'error');
  } finally {
    isPublishing = false;
    publishBtn.disabled = false;
    publishBtnText.textContent = "Publish Post";
  }
});

// Re-draft triggers form resubmission
regenerateBtn.addEventListener('click', () => {
  generateBtn.click();
});

// 5. Toast Notifications
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '✗';
  if (type === 'warning') icon = '⚠';

  toast.innerHTML = `
    <span style="font-weight:bold; font-size:1.15rem;">${icon}</span>
    <span class="toast-message">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 50);
  
  // Dismiss after 4.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
