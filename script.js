// Let It Be observes editing patterns, never the meaning of what someone writes.
const prompts = {
  recap: { question: 'How was your day today?', whispers: ['Is this important enough to write down?', 'Did it happen that way?', 'Could this version stay?'] },
  happy: { question: 'What made you happy today?', whispers: ['Is it okay to make this simple?', 'Did you explain why it mattered?', 'Can a small moment stay?'] },
  difficult: { question: 'Was there something difficult or upsetting today?', whispers: ['Is this too much to say?', 'Do you have the right words yet?', 'You can take your time.'] },
  someone: { question: 'Who is someone you’d like to describe?', whispers: ['Am I describing them fairly?', 'What am I leaving out?', 'Are these the right words?'] },
  reflection: { question: 'Is there something you’ve been thinking about lately?', whispers: ['Does this make sense?', 'Do I really know what I mean?', 'Is this clear enough?'] },
  free: { question: 'Write about anything you’d like.', whispers: ['Where is this going?', 'Should I start over?', 'There is no perfect beginning.'] }
};

const el = {
  body: document.body,
  welcome: document.querySelector('#welcomeScreen'),
  writing: document.querySelector('#writingScreen'),
  cards: [...document.querySelectorAll('.prompt-card')],
  start: document.querySelector('#startButton'),
  help: document.querySelector('#selectionHelp'),
  paperPrompt: document.querySelector('#paperPrompt'),
  field: document.querySelector('#writingField'),
  paper: document.querySelector('#paper'),
  glitch: document.querySelector('#glitchText'),
  typewriter: document.querySelector('#typewriter'),
  object: document.querySelector('#writingObject'),
  whispers: document.querySelector('#whispers'),
  letBe: document.querySelector('#letBeButton'),
  change: document.querySelector('#changePrompt'),
  reset: document.querySelector('#startOver'),
  dialog: document.querySelector('#confirmDialog'),
  clear: document.querySelector('#confirmClear'),
  message: document.querySelector('#kindMessage'),
  sound: document.querySelector('#soundToggle'),
  soundStatus: document.querySelector('.sound-status')
};

let selectedPrompt = null;
let messageTimer = null;
let shakeTimer = null;
let pauseTimer = null;
let pauseThoughtTimer = null;
let audioContext = null;

const writing = { content: '', deletionTimes: [], fluentCharacters: 0, revisionLevel: 0, lastWhisperLevel: 0, pauseThoughtCount: 0 };
const visual = { mood: 0, targetMood: 0, scale: 1, targetScale: 1, frame: null };
const virtualKeys = [...document.querySelectorAll('.type-key[data-key]')];
const WINDOW_MS = 10000;
const stateNames = ['calm', 'friction', 'overthinking', 'stuck'];
const scales = [1, .97, .90, .85];
const moods = [0, .23, .58, .92];
const distortionSymbols = ['#', '?', '×', '⌁', '░'];
const pauseThoughts = ['Why did you stop?', 'Can’t find the right words?'];

el.cards.forEach(card => card.addEventListener('click', () => selectPrompt(card.dataset.prompt)));
el.start.addEventListener('click', startWriting);
el.change.addEventListener('click', showWelcome);
el.reset.addEventListener('click', () => el.dialog.showModal());
el.clear.addEventListener('click', () => { writing.content = ''; el.field.value = ''; resetExperience(); el.field.focus(); });
el.letBe.addEventListener('click', letItBe);
el.sound.addEventListener('change', () => { el.soundStatus.textContent = el.sound.checked ? 'on' : 'off'; });

function selectPrompt(key) {
  selectedPrompt = key;
  el.cards.forEach(card => {
    const active = card.dataset.prompt === key;
    card.classList.toggle('is-selected', active);
    card.setAttribute('aria-pressed', active);
  });
  el.start.disabled = false;
  el.help.textContent = `Selected: ${document.querySelector(`[data-prompt="${key}"] strong`).textContent}.`;
}

function startWriting() {
  if (!selectedPrompt) return;
  el.paperPrompt.textContent = prompts[selectedPrompt].question;
  el.welcome.classList.add('is-hidden');
  el.writing.classList.remove('is-hidden');
  resetExperience();
  el.field.value = writing.content;
  window.setTimeout(() => el.field.focus(), 150);
}

function showWelcome() {
  endPause();
  writing.content = el.field.value;
  el.writing.classList.add('is-hidden');
  el.welcome.classList.remove('is-hidden');
}

el.field.addEventListener('input', event => {
  endPause();
  writing.content = el.field.value;
  if (event.inputType?.startsWith('delete')) registerDeletion();
  else registerWriting();
  updateDistortedText();
  animateTypewriter();
  playTick();
  schedulePause();
});
el.field.addEventListener('keydown', event => {
  setVirtualKey(event.key, true);
  if (event.key.length === 1 || ['Backspace', 'Delete', 'Enter', ' '].includes(event.key)) animateTypewriter();
});
el.field.addEventListener('keyup', event => setVirtualKey(event.key, false));
el.field.addEventListener('blur', releaseVirtualKeys);
window.addEventListener('blur', releaseVirtualKeys);

function registerDeletion() {
  const now = Date.now();
  writing.deletionTimes.push(now);
  writing.deletionTimes = writing.deletionTimes.filter(time => now - time <= WINDOW_MS);
  writing.fluentCharacters = 0;
  updateRevisionState();
  // A single shake makes each repeated erase feel like a visible interruption.
  if (writing.deletionTimes.length >= 3) triggerShake();
}

function registerWriting() {
  const now = Date.now();
  writing.deletionTimes = writing.deletionTimes.filter(time => now - time <= WINDOW_MS);
  writing.fluentCharacters += 1;
  // Eighteen characters without another deletion lets one layer of tension go.
  if (writing.fluentCharacters >= 18 && writing.deletionTimes.length) {
    writing.deletionTimes.splice(0, 3);
    writing.fluentCharacters = 0;
    showMessage('You are moving forward.');
  }
  updateRevisionState();
}

function getRevisionLevel(deleteCount) {
  if (deleteCount >= 8) return 3;
  if (deleteCount >= 5) return 2;
  if (deleteCount >= 3) return 1;
  return 0;
}

function updateRevisionState() {
  const previousLevel = writing.revisionLevel;
  writing.revisionLevel = getRevisionLevel(writing.deletionTimes.length);
  const level = writing.revisionLevel;
  el.body.dataset.state = stateNames[level];
  el.body.classList.toggle('cool', level >= 1);
  el.body.classList.toggle('storm', level >= 3);
  el.paper.classList.toggle('is-glitching', level === 3);
  el.field.style.color = level === 3 ? 'transparent' : '';
  el.field.style.caretColor = level === 3 ? '#36564b' : '';
  el.glitch.style.display = level === 3 ? 'block' : '';
  setVisualTargets(moods[level], scales[level]);
  if (level > previousLevel) addWhisper(level);
  if (level === 0 && previousLevel > 0) clearWhispers();
}

function addWhisper(level) {
  if (!selectedPrompt || level <= writing.lastWhisperLevel) return;
  writing.lastWhisperLevel = level;
  const choices = prompts[selectedPrompt].whispers;
  const whisper = document.createElement('span');
  whisper.className = 'whisper';
  whisper.textContent = choices[Math.min(level - 1, choices.length - 1)];
  const locations = [[4, 10], [74, 16], [3, 58], [78, 62], [12, 84], [70, 84]];
  const [left, top] = locations[(level - 1) % locations.length];
  whisper.style.left = `${left}%`;
  whisper.style.top = `${top}%`;
  whisper.style.setProperty('--life', '8s');
  el.whispers.append(whisper);
  window.setTimeout(() => whisper.remove(), 8200);
}

function clearWhispers() {
  writing.lastWhisperLevel = 0;
  el.whispers.querySelectorAll('.whisper').forEach(whisper => {
    whisper.classList.add('is-fading');
    window.setTimeout(() => whisper.remove(), 900);
  });
}

function schedulePause() {
  window.clearTimeout(pauseTimer);
  // Silence alone is neutral. Questions appear only after the stronger, repeated-edit state.
  pauseTimer = window.setTimeout(beginPause, 5000);
}

function beginPause() {
  if (writing.revisionLevel < 2) return;
  el.typewriter.classList.remove('is-typing');
  el.typewriter.classList.add('is-paused');
  addPauseThought();
}

function addPauseThought() {
  if (writing.revisionLevel < 2 || writing.pauseThoughtCount >= pauseThoughts.length) return;
  const thought = document.createElement('span');
  thought.className = 'whisper pause-thought';
  thought.textContent = pauseThoughts[writing.pauseThoughtCount];
  const locations = [[4, 17], [76, 68]];
  const [left, top] = locations[writing.pauseThoughtCount];
  thought.style.left = `${left}%`;
  thought.style.top = `${top}%`;
  thought.style.setProperty('--life', '7s');
  el.whispers.append(thought);
  writing.pauseThoughtCount += 1;
  if (writing.pauseThoughtCount < pauseThoughts.length) pauseThoughtTimer = window.setTimeout(addPauseThought, 2600);
}

function endPause() {
  window.clearTimeout(pauseTimer);
  window.clearTimeout(pauseThoughtTimer);
  writing.pauseThoughtCount = 0;
  el.typewriter.classList.remove('is-paused');
  el.whispers.querySelectorAll('.pause-thought').forEach(thought => {
    thought.classList.add('is-fading');
    window.setTimeout(() => thought.remove(), 900);
  });
}

function triggerShake() {
  el.object.classList.remove('is-shaking');
  window.clearTimeout(shakeTimer);
  requestAnimationFrame(() => el.object.classList.add('is-shaking'));
  shakeTimer = window.setTimeout(() => el.object.classList.remove('is-shaking'), 180);
}

function resetExperience() {
  endPause();
  writing.deletionTimes = [];
  writing.fluentCharacters = 0;
  writing.revisionLevel = 0;
  writing.lastWhisperLevel = 0;
  el.body.dataset.state = 'calm';
  el.body.classList.remove('cool', 'storm');
  el.object.classList.remove('is-shaking');
  el.paper.classList.remove('is-glitching');
  el.field.style.color = '';
  el.field.style.caretColor = '';
  el.glitch.style.display = '';
  el.glitch.textContent = '';
  clearWhispers();
  setVisualTargets(0, 1);
}

function letItBe() {
  resetExperience();
  showMessage('Your words can stay as they are.');
  el.field.focus();
}

function showMessage(text) {
  el.message.textContent = text;
  el.message.classList.add('show');
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => el.message.classList.remove('show'), 4000);
}

function animateTypewriter() {
  el.typewriter.classList.remove('is-typing');
  requestAnimationFrame(() => {
    el.typewriter.classList.add('is-typing');
    window.setTimeout(() => el.typewriter.classList.remove('is-typing'), 105);
  });
}

function setVirtualKey(key, isPressed) {
  const keyName = key === ' ' ? 'SPACE' : key.toUpperCase();
  virtualKeys.filter(virtualKey => virtualKey.dataset.key === keyName).forEach(virtualKey => virtualKey.classList.toggle('is-pressed', isPressed));
}

function releaseVirtualKeys() { virtualKeys.forEach(virtualKey => virtualKey.classList.remove('is-pressed')); }

function setVisualTargets(mood, scale) {
  visual.targetMood = mood;
  visual.targetScale = scale;
  if (!visual.frame) smoothVisuals();
}

function updateDistortedText() {
  if (el.body.dataset.state !== 'stuck') {
    el.glitch.textContent = '';
    return;
  }
  // This is a visual copy only. The textarea's real text is never changed.
  el.glitch.textContent = [...el.field.value].map((character, index) => {
    if (!/[a-z0-9]/i.test(character) || index % 5 !== 1) return character;
    return distortionSymbols[index % distortionSymbols.length];
  }).join('');
}

function smoothVisuals() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Let tension accumulate slowly instead of jumping when a threshold is crossed.
  const ease = reduceMotion ? 1 : .018;
  visual.mood += (visual.targetMood - visual.mood) * ease;
  visual.scale += (visual.targetScale - visual.scale) * ease;
  const warm = [239, 230, 213];
  const cool = [77, 91, 96];
  const mix = index => Math.round(warm[index] + (cool[index] - warm[index]) * visual.mood);
  el.body.style.backgroundColor = `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
  document.documentElement.style.setProperty('--stage-scale', visual.scale.toFixed(3));
  if (Math.abs(visual.targetMood - visual.mood) > .002 || Math.abs(visual.targetScale - visual.scale) > .002) visual.frame = window.requestAnimationFrame(smoothVisuals);
  else { visual.mood = visual.targetMood; visual.scale = visual.targetScale; visual.frame = null; }
}

function playTick() {
  if (!el.sound.checked) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 760;
    gain.gain.setValueAtTime(.018, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .035);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + .04);
  } catch { /* Sound is optional; writing continues if audio is unavailable. */ }
}
