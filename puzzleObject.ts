import { hideHudItemWindow, makeHudItemWindow } from "./hud.js";
import { loadImage } from "./loader.js";
import { Thing } from "./main.js";
import { Room } from "./room.js";
import { Serializable } from "./serialization.js";

export interface PuzzleObject {
  name: string;
  description: string;
  inventoryImageUrl?: string;
  spawnerImageUrl?: string;
}

export const puzzleObjects: {[key: string]: PuzzleObject} = {
  'key': {
    name: 'Key',
    description: 'A plain key with a loop and a couple of teeth',
    inventoryImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/old-key_1f5dd-fe0f.png',
    spawnerImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/old-key_1f5dd-fe0f.png',
  },
  'small-key': {
    name: 'Small Key',
    description: 'This key has become really tiny! It looks like it\'s the right size to fit into a lockbox of some kind.',
    inventoryImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/old-key_1f5dd-fe0f.png',
    spawnerImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/old-key_1f5dd-fe0f.png',
  },
  'big-key': {
    name: 'Big Key',
    description: 'This key has become really tiny! It looks like it\'s the right size to fit into a lockbox of some kind.',
    inventoryImageUrl: 'https://static.wikia.nocookie.net/zelda/images/0/09/Boss_Key_%28Ocarina_of_Time%29.png',
    spawnerImageUrl: 'https://static.wikia.nocookie.net/zelda/images/0/09/Boss_Key_%28Ocarina_of_Time%29.png',
  },
  'radio': {
    name: 'Broken Radio',
    description: 'This radio is looking fine, but it won\'t play any tunes! It seems like it has been drained of power, and just needs some energy to start playing again.',
    inventoryImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/radio_1f4fb.png',
    spawnerImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/radio_1f4fb.png',
  },
  'gravity-stone': {
    name: 'Gravity Stone',
    description: 'This rock is made out of some very heavy minerals and metals! It’s also really slippery, and it feels like it might fall from your grasp. Watch your toes!',
    inventoryImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/rock_1faa8.png',
    spawnerImageUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/rock_1faa8.png',
  },
}

export function getPuzzleObjectType(puzzleObject: PuzzleObject) {
  const entry = Object.entries(puzzleObjects).find(([_, po]) => po === puzzleObject);
  if(!entry) {
    throw new Error(`PuzzleObject not found.`);
  }
  return entry![0];
}

export type PuzzleObjectType = keyof typeof puzzleObjects;

@Serializable('./puzzleObject.js')
export class PuzzleObjectSpawner implements Thing {
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
  room?: Room;

  constructor(readonly puzzleObject: PuzzleObject, readonly worldImage: HTMLImageElement, {x, y}: PuzzleObjectData) {
    this.x = x;
    this.y = y;
    this.width = worldImage.width;
    this.height = worldImage.height;
  }
  
  static async deserialize(data: PuzzleObjectData) {
    const puzzleObject = puzzleObjects[data.puzzleObjectType];
    if(!puzzleObject) throw new Error(`Cannot find puzzle object with name ${data.puzzleObjectType}`);
    const image = await loadImage(puzzleObject.spawnerImageUrl ?? puzzleObject.inventoryImageUrl ?? PLACEHOLDER_IMAGE_URL);
    return new PuzzleObjectSpawner(puzzleObject, image, data);
  }

  serialize(): PuzzleObjectData {
    const puzzleObjectType = Object.entries(puzzleObjects).find(([_key, value]) => value === this.puzzleObject)![0];
    return {
      x: this.x,
      y: this.y,
      puzzleObjectType,
    };
  }

  take() {
    this.room?.player?.takePuzzleObject(this.puzzleObject, false);
  }

  doClick(x: number, y: number) {
    if(!this.isUnderPointer(x, y)) {
      hideHudItemWindow();
      return false;
    }
    if (!this.isVisible()) return false;
    if(!this.room?.player?.canReach(this.x, this.y)) return false;
    const hudWindow = makeHudItemWindow({
      image: this.puzzleObject.inventoryImageUrl!,
      name: this.puzzleObject.name,
      traits: [],
      description: this.puzzleObject.description,
      onTake: () => this.take(),
    });
    hudWindow.x = this.x;
    hudWindow.y = this.y;
    hudWindow.visible = true;
    return true;
  }

  isUnderPointer(x: number, y: number) {
    return !(Math.abs(this.x - x) > this.width / 2 || Math.abs(this.y - y) > this.height / 2);
  }

  isVisible() {
    if (!this.room?.player) return false; 
    return !this.room?.player?.hasPuzzleObject(this.puzzleObject);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible()) return;
    ctx.drawImage(this.worldImage, this.x - this.width / 2, this.y - this.height/2);
  }
}

export interface PuzzleObjectData {
  x: number;
  y: number;
  puzzleObjectType: PuzzleObjectType;
}

const PLACEHOLDER_IMAGE_URL = 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/google/298/flag-switzerland_1f1e8-1f1ed.png';