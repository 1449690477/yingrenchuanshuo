import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../../..');
const tmp = path.join(root, 'tmp/imagegen/moon-sugar');
const layerDir = path.join(root, 'public/assets/characters/modular/shop/moon-sugar');
const iconDir = path.join(root, 'public/assets/equipment/shop/moon-sugar');
const effectDir = path.join(root, 'public/assets/effects/boutique');

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const png = {
  compressionLevel: 9,
  palette: true,
  quality: 92,
  colors: 256,
  dither: 0.65,
};

async function trimmed(input) {
  return sharp(path.join(tmp, input)).trim({ background: transparent }).png().toBuffer();
}

async function paperLayer(input, output, width, height, left, top) {
  const item = await trimmed(input);
  const resized = await sharp(item)
    .resize(width, height, { fit: 'contain', background: transparent })
    .png()
    .toBuffer();

  await sharp({
    create: { width: 640, height: 960, channels: 4, background: transparent },
  })
    .composite([{ input: resized, left, top }])
    .png(png)
    .toFile(path.join(layerDir, output));
}

async function icon(input, output, maxWidth = 224, maxHeight = 224, rotate = 0) {
  const item = await trimmed(input);
  const oriented = rotate
    ? await sharp(item)
        .rotate(rotate, { background: transparent })
        .trim({ background: transparent })
        .png()
        .toBuffer()
    : item;
  const resized = await sharp(oriented)
    .resize(maxWidth, maxHeight, { fit: 'contain', background: transparent })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.floor((256 - (meta.width ?? maxWidth)) / 2);
  const top = Math.floor((256 - (meta.height ?? maxHeight)) / 2);

  await sharp({
    create: { width: 256, height: 256, channels: 4, background: transparent },
  })
    .composite([{ input: resized, left, top }])
    .png(png)
    .toFile(path.join(iconDir, output));
}

async function effect(input, output) {
  const item = await trimmed(input);
  const resized = await sharp(item)
    .resize(480, 480, { fit: 'contain', background: transparent })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.floor((512 - (meta.width ?? 480)) / 2);
  const top = Math.floor((512 - (meta.height ?? 480)) / 2);

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: transparent },
  })
    .composite([{ input: resized, left, top }])
    .png(png)
    .toFile(path.join(effectDir, output));
}

// Body layers: dimensions follow the existing R2 per-class anchor envelopes.
await paperLayer('alpha-swordsman-body.png', 'swordsman-body.png', 350, 390, 145, 145);
await paperLayer('alpha-witch-body.png', 'witch-body.png', 360, 385, 140, 150);
await paperLayer('alpha-shaman-body.png', 'shaman-body.png', 330, 355, 155, 175);

// Head layers retain the collection's veil while staying clear of the face.
await paperLayer('alpha-swordsman-head.png', 'swordsman-head.png', 205, 160, 220, 0);
await paperLayer('alpha-witch-head.png', 'witch-head.png', 190, 160, 225, 2);
await paperLayer('alpha-shaman-head.png', 'shaman-head.png', 200, 175, 220, 0);

// Footwear layers follow each base character's stance.
await paperLayer('alpha-swordsman-shoes.png', 'swordsman-shoes.png', 390, 175, 125, 752);
await paperLayer('alpha-witch-shoes.png', 'witch-shoes.png', 200, 160, 220, 755);
await paperLayer('alpha-shaman-shoes.png', 'shaman-shoes.png', 185, 160, 232, 740);

// Profession weapons use their own hand anchors.
await paperLayer('alpha-swordsman-weapon.png', 'swordsman-weapon.png', 170, 325, 25, 135);
await paperLayer('alpha-witch-weapon.png', 'witch-weapon.png', 145, 420, 130, 155);
await paperLayer('alpha-shaman-weapon.png', 'shaman-weapon.png', 180, 365, 220, 265);

// Ten storefront icons. Common wearable icons use the witch variant as the
// clearest compact front-view source; runtime paper-doll layers remain class-specific.
await icon('alpha-witch-body.png', 'body.png');
await icon('alpha-witch-head.png', 'head.png');
await icon('alpha-witch-shoes.png', 'shoes.png');
await icon('alpha-swordsman-weapon.png', 'weapon-swordsman.png');
await icon('alpha-witch-weapon.png', 'weapon-witch.png', 224, 224, -32);
await icon('alpha-shaman-weapon.png', 'weapon-shaman.png', 224, 224, -18);
await icon('alpha-necklace.png', 'necklace.png');
await icon('alpha-bracelet.png', 'bracelet.png');
await icon('alpha-ring.png', 'ring.png');
await icon('alpha-belt.png', 'belt.png');

await effect('alpha-effect-swordsman.png', 'moon-sugar-swordsman.png');
await effect('alpha-effect-witch.png', 'moon-sugar-witch.png');
await effect('alpha-effect-shaman.png', 'moon-sugar-shaman.png');
