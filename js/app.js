const STORAGE_KEY = "stories:v1";
const EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1920;
const STORY_DURATION_MS = 15000;
const SWIPE_THRESHOLD = 50;

let viewerStack = [];
let viewerIndex = 0;
let timerId = null;
let timerStartedAt = 0;
let touchStartX = 0;
let touchStartY = 0;
let didSwipe = false;

const loadStories = () => {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  return Array.isArray(data) ? data : [];
};

const saveStories = (stories) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
};

const createStory = (base64) => ({
  id: Date.now(),
  base64,
  createdAt: Date.now(),
  seen: false,
});

const addStory = (story) => {
  const stories = [story].concat(loadStories());
  saveStories(stories);
  return stories;
};

const markStorySeen = (id) => {
  const stories = loadStories().map((story) => {
    if (story.id === id) {
      return {
        id: story.id,
        base64: story.base64,
        createdAt: story.createdAt,
        seen: true,
      };
    }
    return story;
  });
  saveStories(stories);
  return stories;
};

const removeExpiredStories = () => {
  const now = Date.now();
  const active = loadStories().filter(
    (story) => now - story.createdAt < EXPIRY_MS
  );
  saveStories(active);
  return active;
};

const showUploadError = (message) => {
  const el = document.getElementById("upload-error");
  el.textContent = message;
  el.hidden = false;
};

const hideUploadError = () => {
  document.getElementById("upload-error").hidden = true;
};

const readFileAsDataURL = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

// Center-crop to 9:16, then scale down to fit inside 1080×1920.
const cropImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const targetRatio = 9 / 16;
      let sourceWidth = img.width;
      let sourceHeight = img.height;
      let sourceX = 0;
      let sourceY = 0;

      const imageRatio = sourceWidth / sourceHeight;

      if (imageRatio > targetRatio) {
        // Image is too wide — crop left/right, keep center
        sourceWidth = sourceHeight * targetRatio;
        sourceX = (img.width - sourceWidth) / 2;
      } else if (imageRatio < targetRatio) {
        // Image is too tall — crop top/bottom, keep center
        sourceHeight = sourceWidth / targetRatio;
        sourceY = (img.height - sourceHeight) / 2;
      }

      let outWidth = sourceWidth;
      let outHeight = sourceHeight;

      if (outWidth > MAX_WIDTH || outHeight > MAX_HEIGHT) {
        const scale = Math.min(MAX_WIDTH / outWidth, MAX_HEIGHT / outHeight);
        outWidth = Math.floor(outWidth * scale);
        outHeight = Math.floor(outHeight * scale);
      } else {
        outWidth = Math.floor(outWidth);
        outHeight = Math.floor(outHeight);
      }

      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outWidth,
        outHeight
      );

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

const createStoryCircle = (story) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "story-circle story-ring " + (story.seen ? "ring-seen" : "ring-unseen");
  button.dataset.storyId = String(story.id);
  button.setAttribute("aria-label", "View story");

  const inner = document.createElement("span");
  inner.className = "story-ring__inner";

  const img = document.createElement("img");
  img.className = "story-ring__thumb";
  img.src = story.base64;
  img.alt = "";
  img.width = 64;
  img.height = 64;

  inner.appendChild(img);
  button.appendChild(inner);
  return button;
};

const renderTray = (stories) => {
  const tray = document.getElementById("story-tray");
  Array.from(tray.querySelectorAll(".story-circle")).forEach((circle) =>
    circle.remove()
  );
  stories.forEach((story) => tray.appendChild(createStoryCircle(story)));
};

const processUpload = async (file) => {
  hideUploadError();
  if (!file || !file.type.startsWith("image/")) return;

  const base64 = await readFileAsDataURL(file);
  if (!base64) return;

  const cropped = await cropImage(base64);
  if (!cropped) {
    showUploadError("Could not process this image. Try another file.");
    return;
  }

  addStory(createStory(cropped));
  renderTray(loadStories());
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  processUpload(file);
  event.target.value = "";
};

const getStackFrom = (startId) => {
  const stories = loadStories();
  const startIndex = stories.findIndex(
    (story) => story.id === Number(startId)
  );
  if (startIndex === -1) return [];
  return stories.slice(startIndex);
};

const stopTimer = () => {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
};

const updateActiveProgress = () => {
  const active = document.querySelector(
    "#progress-segments .progress-segment.is-active .progress-segment__fill"
  );
  if (!active) return;

  const elapsed = Date.now() - timerStartedAt;
  let percent = (elapsed / STORY_DURATION_MS) * 100;
  if (percent > 100) percent = 100;
  active.style.width = percent + "%";
};

const renderProgressSegments = () => {
  const container = document.getElementById("progress-segments");
  container.innerHTML = "";

  viewerStack.forEach((story, index) => {
    const segment = document.createElement("div");
    segment.className = "progress-segment";

    if (index < viewerIndex) {
      segment.className = "progress-segment is-complete";
    } else if (index === viewerIndex) {
      segment.className = "progress-segment is-active";
    }

    const fill = document.createElement("span");
    fill.className = "progress-segment__fill";
    if (index === viewerIndex) {
      fill.style.width = "0%";
    }
    segment.appendChild(fill);
    container.appendChild(segment);
  });
};

const startTimer = () => {
  stopTimer();
  timerStartedAt = Date.now();
  updateActiveProgress();

  timerId = setInterval(() => {
    updateActiveProgress();
    const elapsed = Date.now() - timerStartedAt;
    if (elapsed >= STORY_DURATION_MS) {
      goNext();
    }
  }, 50);
};

const showStoryAt = (index) => {
  viewerIndex = index;
  const story = viewerStack[viewerIndex];
  if (!story) {
    closeViewer();
    return;
  }

  document.getElementById("viewer-image").src = story.base64;
  markStorySeen(story.id);
  renderTray(loadStories());
  renderProgressSegments();
  startTimer();
};

const goNext = () => {
  if (viewerIndex >= viewerStack.length - 1) {
    closeViewer();
    return;
  }
  showStoryAt(viewerIndex + 1);
};

const goPrev = () => {
  if (viewerIndex <= 0) return;
  showStoryAt(viewerIndex - 1);
};

const openViewer = (startId) => {
  viewerStack = getStackFrom(startId);
  if (viewerStack.length === 0) return;

  viewerIndex = 0;
  document.getElementById("viewer").hidden = false;
  showStoryAt(0);
};

const closeViewer = () => {
  stopTimer();
  viewerStack = [];
  viewerIndex = 0;
  document.getElementById("viewer").hidden = true;
};

const handleTrayClick = (event) => {
  const circle = event.target.closest(".story-circle");
  if (!circle) return;
  openViewer(circle.dataset.storyId);
};

const handleFrameClick = (event) => {
  if (document.getElementById("viewer").hidden) return;
  if (event.target.closest("#viewer-close")) return;

  if (didSwipe) {
    didSwipe = false;
    return;
  }

  const frame = document.getElementById("viewer-frame");
  const rect = frame.getBoundingClientRect();
  const x = event.clientX - rect.left;

  if (x < rect.width / 2) {
    goPrev();
  } else {
    goNext();
  }
};

const handleTouchStart = (event) => {
  touchStartX = event.changedTouches[0].screenX;
  touchStartY = event.changedTouches[0].screenY;
};

const handleTouchEnd = (event) => {
  const dx = event.changedTouches[0].screenX - touchStartX;
  const dy = event.changedTouches[0].screenY - touchStartY;

  // Ignore short moves and mostly-vertical scrolls
  if (Math.abs(dx) < SWIPE_THRESHOLD) return;
  if (Math.abs(dx) <= Math.abs(dy)) return;

  didSwipe = true;
  if (dx < 0) {
    goNext();
  } else {
    goPrev();
  }

  // Clear flag so a later click is not blocked if no click follows the swipe
  setTimeout(() => {
    didSwipe = false;
  }, 100);
};

const handleCloseClick = (event) => {
  event.stopPropagation();
  closeViewer();
};

const handleBackdropClick = (event) => {
  // Only the backdrop itself — ignore clicks that bubbled from children
  if (event.target !== event.currentTarget) return;
  closeViewer();
};

const cleanupExpiredStories = () => {
  const beforeCount = loadStories().length;
  const active = removeExpiredStories();
  if (active.length !== beforeCount) {
    renderTray(active);
  }
};

const bindGestures = () => {
  const frame = document.getElementById("viewer-frame");
  frame.addEventListener("click", handleFrameClick);
  frame.addEventListener("touchstart", handleTouchStart, { passive: true });
  frame.addEventListener("touchend", handleTouchEnd, { passive: true });
};

const bindEvents = () => {
  document.getElementById("file-input").addEventListener("change", handleFileSelect);
  document.getElementById("story-tray").addEventListener("click", handleTrayClick);
  document.getElementById("viewer-close").addEventListener("click", handleCloseClick);
  document.getElementById("viewer-backdrop").addEventListener("click", handleBackdropClick);
  bindGestures();
};

const init = () => {
  document.getElementById("viewer").hidden = true;
  removeExpiredStories();
  renderTray(loadStories());
  bindEvents();
  setInterval(cleanupExpiredStories, 60000);
};

init();
