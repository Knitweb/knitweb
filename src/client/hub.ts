// hub.ts — progressive enhancement for the field-kit hub (bundled by esbuild).
// Vanilla, dependency-free: a subtle lift on the hovered field card.
const cards = document.querySelectorAll<HTMLElement>(".field-card");
for (const card of cards) {
  card.addEventListener("pointerenter", () => {
    card.style.transform = "translateY(-2px)";
    card.style.transition = "transform .15s";
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
}
export {};
