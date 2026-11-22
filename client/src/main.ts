import { RoomScene } from "./scenes/room";
import { StateMachine } from "./state-machine";
import { getLeaderboard } from "./api";

const container = document.getElementById("canvas-container")!;
const room = new RoomScene(container);
const machine = new StateMachine(room);

document.getElementById("new-game-btn")!.addEventListener("click", () => {
  document.getElementById("start-screen")!.style.display = "none";
  document.getElementById("hud")!.style.display = "flex";
  machine.start();
});

document.getElementById("how-to-btn")?.addEventListener("click", () => {
  document.getElementById("instructions-screen")!.style.display = "flex";
});
document.getElementById("instructions-close-btn")?.addEventListener("click", () => {
  document.getElementById("instructions-screen")!.style.display = "none";
});

document.getElementById("play-again-btn")!.addEventListener("click", () => {
  document.getElementById("end-screen")!.style.display = "none";
  document.getElementById("hud")!.style.display = "flex";
  machine.start();
});

// Leaderboard buttons (start screen + end screen)
async function showLeaderboard(): Promise<void> {
  const overlay = document.getElementById("leaderboard-screen")!;
  const list    = document.getElementById("leaderboard-list")!;
  list.innerHTML = "<li>Loading…</li>";
  overlay.style.display = "flex";

  const entries = await getLeaderboard().catch(() => []);
  if (entries.length === 0) {
    list.innerHTML = "<li>No scores yet. Be the first!</li>";
  } else {
    list.innerHTML = entries
      .map((e) => {
        const date = new Date(e.created_at).toLocaleDateString();
        return `<li><strong>#${e.rank}</strong> &nbsp; ${e.score.toLocaleString()} &nbsp; <span>${date}</span></li>`;
      })
      .join("");
  }
}

document.getElementById("leaderboard-btn")?.addEventListener("click", showLeaderboard);
document.getElementById("end-leaderboard-btn")?.addEventListener("click", showLeaderboard);
document.getElementById("leaderboard-back-btn")?.addEventListener("click", () => {
  document.getElementById("leaderboard-screen")!.style.display = "none";
});

let last = performance.now();
function animate(): void {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  room.update(dt);
  machine.update(dt);
}
animate();
