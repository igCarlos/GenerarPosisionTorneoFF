const STORAGE_KEY = "ff_tournament_manager_v1";
const VALID_SIZES = [2, 4, 8, 16, 32];

const state = {
  participants: [],
  rounds: [],
  generated: false,
};

const el = {
  participantForm: document.getElementById("participantForm"),
  editingId: document.getElementById("editingId"),
  nameInput: document.getElementById("nameInput"),
  teamInput: document.getElementById("teamInput"),
  uidInput: document.getElementById("uidInput"),
  regionInput: document.getElementById("regionInput"),
  saveParticipantBtn: document.getElementById("saveParticipantBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  participantCounter: document.getElementById("participantCounter"),
  participantsList: document.getElementById("participantsList"),
  participantTemplate: document.getElementById("participantTemplate"),
  searchInput: document.getElementById("searchInput"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  generateBracketBtn: document.getElementById("generateBracketBtn"),
  bracket: document.getElementById("bracket"),
  bracketViewport: document.getElementById("bracketViewport"),
  emptyState: document.getElementById("emptyState"),
  statPlayers: document.getElementById("statPlayers"),
  statMatches: document.getElementById("statMatches"),
  statChampion: document.getElementById("statChampion"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
  toast: document.getElementById("toast"),
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.participants)) return;
    state.participants = saved.participants;
    state.rounds = Array.isArray(saved.rounds) ? saved.rounds : [];
    state.generated = Boolean(saved.generated && state.rounds.length);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove("show"), 2400);
}

function initials(name = "?") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function sanitizeParticipant(raw) {
  return {
    id: String(raw.id || uid()),
    name: String(raw.name || "Jugador").slice(0, 28),
    team: String(raw.team || "Sin clan").slice(0, 24),
    uid: String(raw.uid || "").slice(0, 20),
    region: String(raw.region || "Latinoamérica").slice(0, 30),
  };
}

function renderParticipants() {
  const query = el.searchInput.value.trim().toLowerCase();
  const list = state.participants.filter((p) =>
    `${p.name} ${p.team} ${p.uid}`.toLowerCase().includes(query)
  );

  el.participantsList.innerHTML = "";

  if (!list.length) {
    el.participantsList.innerHTML = `<div style="padding:28px 12px;text-align:center;color:#8e98ba">No hay participantes para mostrar.</div>`;
  }

  list.forEach((participant) => {
    const node = el.participantTemplate.content.cloneNode(true);
    const card = node.querySelector(".participant-card");
    const avatar = node.querySelector(".avatar");
    const strong = node.querySelector("strong");
    const span = node.querySelector("span");

    card.dataset.id = participant.id;
    avatar.textContent = initials(participant.name);
    strong.textContent = participant.name;
    span.textContent = `${participant.team || "Sin clan"} · ${participant.region}`;

    node.querySelector(".edit-btn").addEventListener("click", () => startEdit(participant.id));
    node.querySelector(".delete-btn").addEventListener("click", () => removeParticipant(participant.id));
    el.participantsList.appendChild(node);
  });

  el.participantCounter.textContent = `${state.participants.length}/32`;
  el.statPlayers.textContent = state.participants.length;
}

function resetForm() {
  el.participantForm.reset();
  el.editingId.value = "";
  el.saveParticipantBtn.textContent = "Agregar jugador";
  el.cancelEditBtn.classList.add("hidden");
  el.nameInput.focus();
}

function startEdit(id) {
  const participant = state.participants.find((p) => p.id === id);
  if (!participant) return;

  el.editingId.value = participant.id;
  el.nameInput.value = participant.name;
  el.teamInput.value = participant.team;
  el.uidInput.value = participant.uid;
  el.regionInput.value = participant.region;
  el.saveParticipantBtn.textContent = "Guardar cambios";
  el.cancelEditBtn.classList.remove("hidden");
  el.nameInput.focus();
}

function removeParticipant(id) {
  const participant = state.participants.find((p) => p.id === id);
  if (!participant) return;
  if (!confirm(`¿Eliminar a ${participant.name}?`)) return;

  state.participants = state.participants.filter((p) => p.id !== id);
  invalidateBracket();
  saveState();
  renderAll();
  toast("Participante eliminado");
}

function invalidateBracket() {
  state.rounds = [];
  state.generated = false;
}

function nextValidSize(count) {
  return VALID_SIZES.find((size) => size >= count) || 32;
}

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeSlot(participant = null, seed = null) {
  return participant
    ? { participantId: participant.id, name: participant.name, team: participant.team, seed }
    : { participantId: null, name: "BYE", team: "Pase automático", seed };
}

function generateBracket() {
  const count = state.participants.length;
  if (count < 2) return toast("Agrega al menos 2 participantes");
  if (count > 32) return toast("El máximo es de 32 participantes");

  const size = nextValidSize(count);
  const seeded = shuffled(state.participants);
  const slots = Array.from({ length: size }, (_, index) => makeSlot(seeded[index] || null, index + 1));
  const rounds = [];

  const firstRound = [];
  for (let i = 0; i < slots.length; i += 2) {
    const match = {
      id: uid(),
      players: [slots[i], slots[i + 1]],
      winnerId: null,
    };

    const realPlayers = match.players.filter((p) => p.participantId);
    if (realPlayers.length === 1) match.winnerId = realPlayers[0].participantId;
    firstRound.push(match);
  }
  rounds.push(firstRound);

  let matchesInNextRound = size / 4;
  while (matchesInNextRound >= 1) {
    rounds.push(
      Array.from({ length: matchesInNextRound }, () => ({
        id: uid(),
        players: [null, null],
        winnerId: null,
      }))
    );
    matchesInNextRound /= 2;
  }

  state.rounds = rounds;
  state.generated = true;
  propagateAll();
  saveState();
  renderAll();
  toast(`Torneo generado para ${size} posiciones`);
}

function getWinnerSlot(match) {
  if (!match?.winnerId) return null;
  return match.players.find((p) => p?.participantId === match.winnerId) || null;
}

function propagateAll() {
  for (let roundIndex = 0; roundIndex < state.rounds.length - 1; roundIndex++) {
    const current = state.rounds[roundIndex];
    const next = state.rounds[roundIndex + 1];

    current.forEach((match, matchIndex) => {
      const nextMatch = next[Math.floor(matchIndex / 2)];
      const targetSlot = matchIndex % 2;
      const winnerSlot = getWinnerSlot(match);
      const previousId = nextMatch.players[targetSlot]?.participantId || null;
      const incomingId = winnerSlot?.participantId || null;

      if (previousId !== incomingId) {
        nextMatch.players[targetSlot] = winnerSlot ? { ...winnerSlot } : null;
        if (nextMatch.winnerId && !nextMatch.players.some((p) => p?.participantId === nextMatch.winnerId)) {
          nextMatch.winnerId = null;
        }
      }

      const available = nextMatch.players.filter((p) => p?.participantId);
      if (available.length === 1 && nextMatch.players.some((p) => p === null || !p?.participantId)) {
        // No se declara ganador automático aquí hasta que ambos cruces previos estén definidos.
        const sourceMatches = current.slice(Math.floor(matchIndex / 2) * 2, Math.floor(matchIndex / 2) * 2 + 2);
        const sourcesResolved = sourceMatches.every((m) => m.winnerId);
        if (sourcesResolved) nextMatch.winnerId = available[0].participantId;
      }
    });
  }
}

function selectWinner(roundIndex, matchIndex, participantId) {
  const match = state.rounds[roundIndex]?.[matchIndex];
  if (!match) return;
  const valid = match.players.some((p) => p?.participantId === participantId);
  if (!valid) return;

  match.winnerId = participantId;

  // Al cambiar un ganador, limpia dependencias posteriores del camino afectado.
  let sourceIndex = matchIndex;
  for (let r = roundIndex + 1; r < state.rounds.length; r++) {
    const targetIndex = Math.floor(sourceIndex / 2);
    const targetMatch = state.rounds[r][targetIndex];
    targetMatch.winnerId = null;
    sourceIndex = targetIndex;
  }

  propagateAll();
  saveState();
  renderBracket();
  renderStats();
}

function roundTitle(index, total) {
  const remaining = total - index;
  if (remaining === 1) return "GRAN FINAL";
  if (remaining === 2) return "SEMIFINAL";
  if (remaining === 3) return "CUARTOS DE FINAL";
  if (remaining === 4) return "OCTAVOS DE FINAL";
  return `RONDA ${index + 1}`;
}

function renderBracket() {
  el.bracket.innerHTML = "";

  if (!state.generated || !state.rounds.length) {
    el.emptyState.classList.remove("hidden");
    el.bracketViewport.classList.add("hidden");
    return;
  }

  el.emptyState.classList.add("hidden");
  el.bracketViewport.classList.remove("hidden");

  state.rounds.forEach((round, roundIndex) => {
    const roundElement = document.createElement("section");
    roundElement.className = "round";
    roundElement.innerHTML = `<h3 class="round-title">${roundTitle(roundIndex, state.rounds.length)}</h3>`;

    const matchesElement = document.createElement("div");
    matchesElement.className = "matches";

    round.forEach((match, matchIndex) => {
      const matchElement = document.createElement("article");
      matchElement.className = "match";

      match.players.forEach((player, playerIndex) => {
        const button = document.createElement("button");
        button.className = "player-slot";
        button.type = "button";

        if (!player) {
          button.disabled = true;
          button.innerHTML = `<span class="slot-avatar">?</span><span><span class="slot-name">Pendiente</span><span class="slot-team">Esperando ganador</span></span><span class="seed">—</span>`;
        } else if (!player.participantId) {
          button.disabled = true;
          button.innerHTML = `<span class="slot-avatar">—</span><span><span class="slot-name">BYE</span><span class="slot-team">Pase automático</span></span><span class="seed">${player.seed ?? ""}</span>`;
        } else {
          const isWinner = match.winnerId === player.participantId;
          const hasWinner = Boolean(match.winnerId);
          button.classList.add("selectable");
          if (isWinner) button.classList.add("winner");
          else if (hasWinner) button.classList.add("loser");

          button.innerHTML = `
            <span class="slot-avatar">${initials(player.name)}</span>
            <span>
              <span class="slot-name">${escapeHtml(player.name)}</span>
              <span class="slot-team">${escapeHtml(player.team || "Sin clan")}</span>
            </span>
            <span class="seed">${isWinner ? '<span class="trophy">★</span>' : `#${player.seed ?? playerIndex + 1}`}</span>
          `;
          button.addEventListener("click", () => selectWinner(roundIndex, matchIndex, player.participantId));
        }

        matchElement.appendChild(button);
      });

      matchesElement.appendChild(matchElement);
    });

    roundElement.appendChild(matchesElement);
    el.bracket.appendChild(roundElement);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStats() {
  const matches = state.rounds.flat();
  el.statMatches.textContent = matches.length || 0;
  const finalMatch = state.rounds.at(-1)?.[0];
  const champion = getWinnerSlot(finalMatch);
  el.statChampion.textContent = champion?.name || "—";
  el.statChampion.title = champion?.name || "";
}

function renderAll() {
  renderParticipants();
  renderBracket();
  renderStats();
}

el.participantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = el.nameInput.value.trim();
  if (!name) return;

  const editingId = el.editingId.value;
  const data = sanitizeParticipant({
    id: editingId || uid(),
    name,
    team: el.teamInput.value.trim() || "Sin clan",
    uid: el.uidInput.value.trim(),
    region: el.regionInput.value,
  });

  if (editingId) {
    const index = state.participants.findIndex((p) => p.id === editingId);
    if (index >= 0) state.participants[index] = data;
    toast("Participante actualizado");
  } else {
    if (state.participants.length >= 32) return toast("Solo se permiten 32 participantes");
    state.participants.push(data);
    toast("Participante agregado");
  }

  invalidateBracket();
  saveState();
  resetForm();
  renderAll();
});

el.cancelEditBtn.addEventListener("click", resetForm);
el.searchInput.addEventListener("input", renderParticipants);
el.generateBracketBtn.addEventListener("click", generateBracket);

el.shuffleBtn.addEventListener("click", () => {
  state.participants = shuffled(state.participants);
  invalidateBracket();
  saveState();
  renderAll();
  toast("Participantes mezclados");
});

el.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `torneo-free-fire-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("Torneo exportado");
});

el.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.participants)) throw new Error("Formato inválido");

    state.participants = data.participants.slice(0, 32).map(sanitizeParticipant);
    state.rounds = Array.isArray(data.rounds) ? data.rounds : [];
    state.generated = Boolean(data.generated && state.rounds.length);
    saveState();
    renderAll();
    toast("Torneo importado correctamente");
  } catch {
    toast("No se pudo importar el archivo");
  } finally {
    event.target.value = "";
  }
});

el.resetBtn.addEventListener("click", () => {
  if (!confirm("¿Reiniciar todo el torneo? Esta acción borrará los datos guardados.")) return;
  state.participants = [];
  state.rounds = [];
  state.generated = false;
  localStorage.removeItem(STORAGE_KEY);
  resetForm();
  renderAll();
  toast("Torneo reiniciado");
});

loadState();
renderAll();
