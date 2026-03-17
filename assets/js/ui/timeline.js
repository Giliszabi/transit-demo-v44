export function renderTimeline(containerId, eroforrasLista) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  eroforrasLista.forEach((eroforras) => {
    const div = document.createElement("div");
    div.className = "timeline-resource";
    div.innerHTML = `
      <div class="timeline-resource-name">
         ${eroforras.icon} ${eroforras.name}
      </div>
      <div class="timeline-bar"></div>
    `;
    container.appendChild(div);
  });
}
