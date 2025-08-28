export function randomNeonColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const light = 60;
  return `hsl(${hue}, 100%, ${light}%)`;
}

export function rollNeonColor(): string {
  return randomNeonColor();
}
