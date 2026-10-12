/** iPhone screens that get a dedicated launch image (portrait, CSS pixels). */
export interface SplashDevice {
  name: string;
  width: number;
  height: number;
  dpr: number;
}

export const splashDevices: SplashDevice[] = [
  { name: 'iPhone 16/17 Pro Max', width: 440, height: 956, dpr: 3 },
  { name: 'iPhone Air', width: 420, height: 912, dpr: 3 },
  { name: 'iPhone 14 Pro Max, 15/16 Plus, 15 Pro Max', width: 430, height: 932, dpr: 3 },
  { name: 'iPhone 16/17 Pro, 17', width: 402, height: 874, dpr: 3 },
  { name: 'iPhone 14 Pro, 15, 15 Pro, 16', width: 393, height: 852, dpr: 3 },
  { name: 'iPhone 12/13 Pro Max, 14 Plus', width: 428, height: 926, dpr: 3 },
  { name: 'iPhone 12, 13, 14, 16e', width: 390, height: 844, dpr: 3 },
  { name: 'iPhone X, XS, 11 Pro, 12/13 mini', width: 375, height: 812, dpr: 3 },
  { name: 'iPhone XS Max, 11 Pro Max', width: 414, height: 896, dpr: 3 },
  { name: 'iPhone XR, 11', width: 414, height: 896, dpr: 2 },
  { name: 'iPhone 6–8 Plus', width: 414, height: 736, dpr: 3 },
  { name: 'iPhone SE, 6–8', width: 375, height: 667, dpr: 2 },
];

export const splashFile = (d: SplashDevice): string =>
  `splash/launch-${d.width * d.dpr}x${d.height * d.dpr}.png`;

export const splashMedia = (d: SplashDevice): string =>
  `(device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)`;
