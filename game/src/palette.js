// The look plan, in one place: dusk at an industrial foundry — ember orange against cold
// slate and concrete. Six values and one accent hue; the lighting makes every shade the game
// needs, so no other colour appears in the code. The same six names are the CSS custom
// properties in index.html.
export const PALETTE = {
  canvas: '#17130f',
  surface: '#221c16',
  hairline: '#3a3128',
  ink: '#f2ead9',
  muted: '#a89a83',
  accent: '#ff7a1a',
  danger: '#e5484d',
  ally: '#ffb454',
};

export function shade(name) {
  return PALETTE[name];
}
