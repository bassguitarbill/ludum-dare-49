import {Serializable} from './serialization.js';
import {loadImage} from './loader.js';
import {Material, MaterialType, materials, getMaterialType} from './material.js';
import {HudItemHotbar, makeHudItemWindow} from './hud.js';
import {playSFX} from './audio.js';
import {Room} from './room.js';
import {Cauldron} from './cauldron.js';
import { toast } from './toast.js';
import { getPuzzleObjectType, PuzzleObject, puzzleObjects, PuzzleObjectType } from './puzzleObject.js';
import { Furnace } from './furnace.js';
import { Potion } from './potions.js';

@Serializable('./player.js')
export class Player {
  x: number;
  y: number;
  z = 1;
  targetX: number;
  room?: Room;

  private readonly hotbar = new HudItemHotbar();
  private materialInventorySize: number;
  private readonly heldMaterials: Material[] = [];
  private readonly heldPuzzleObjects: PuzzleObject[] = [];

  constructor({x, y, heldMaterials = [], materialInventorySize, heldPuzzleObjects = []}: PlayerData, private standingImage: HTMLImageElement, private walkingImage: HTMLImageElement) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.materialInventorySize = materialInventorySize ?? 5;
    this.hotbar.setCapacity(this.materialInventorySize);
    for(const mat of heldMaterials) this.takeMaterial(materials[mat], true);
    for(const po of heldPuzzleObjects) this.takePuzzleObject(puzzleObjects[po], true);
  }

  static async deserialize(playerData: PlayerData) {
    const standing = await loadImage('./sprites/player-forwards.png');
    const walking = await loadImage('./sprites/player-right.png');
    return new Player(playerData, standing, walking);
  }

  tick(dt: number) {
    const maxMovement = 500 * dt;
    if(this.x > this.targetX) {
      this.x = Math.max(this.x - maxMovement, this.targetX);
    } else if(this.x < this.targetX) {
      this.x = Math.min(this.x + maxMovement, this.targetX);
    }
  }

  canReach(x: number, _y: number) {
    return Math.abs(x - this.x) < 200;
  }

  moveToCursor(x: number) {
    this.targetX = x;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const image = this.targetX !== this.x ? this.walkingImage : this.standingImage;
    const width = image.width;
    const height = image.height;
    ctx.save();
    ctx.translate(this.x, this.y);
    if(this.targetX < this.x) ctx.scale(-1, 1);
    ctx.drawImage(image, -width/2, -height);
    ctx.restore();
  }

  serialize(): PlayerData {
    return {
      x: this.x,
      y: this.y,
      heldMaterials: this.heldMaterials.map(getMaterialType),
      heldPuzzleObjects: this.heldPuzzleObjects.map(getPuzzleObjectType),
      materialInventorySize: this.materialInventorySize,
    };
  }

  hasPuzzleObject(obj: PuzzleObject) {
    return this.heldPuzzleObjects.indexOf(obj) !== -1;
  }

  tossPuzzleObject(obj: PuzzleObject) {
    this.heldPuzzleObjects.splice(this.heldPuzzleObjects.indexOf(obj), 1);
    this.hotbar.removeItemByName(obj.name);
  }

  placePuzzleObject(obj: PuzzleObject) {
    if (this.room) {
      const furnaces = this.room?.getObjectsOfType(Furnace);
      if (furnaces[0]) {
        if (furnaces[0].putObjectIn(obj)) {
          this.tossPuzzleObject(obj);
        }
      }
      else toast('Nowhere to put it');
    }
  }

  takePuzzleObject(obj: PuzzleObject, isInitializing: boolean) {
    this.heldPuzzleObjects.push(obj);
    if(!isInitializing) {
      playSFX('chimes-002');
    }
    const imageUrl = obj.inventoryImageUrl ?? obj.spawnerImageUrl ?? PLACEHOLDER_IMAGE_URL;
    const hotbarItem = {
      imageUrl,
      name: obj.name,
      onActivate: () => {
        const hudItemWindow = makeHudItemWindow({
          image: imageUrl,
          name: obj.name,
          traits: [],
          description: obj.description,
          onToss: () => { this.tossPuzzleObject(obj) },
          onPlace: () => { this.placePuzzleObject(obj) },
        });
        const { height } = hudItemWindow.element.getBoundingClientRect();
        const { top, left } = this.hotbar._itemList.getBoundingClientRect();
        hudItemWindow.y = top - height - 20;
        hudItemWindow.x = left;
        hudItemWindow.visible = true;
      }
    };
    this.hotbar.addItem(hotbarItem);
    if(!isInitializing) {
      window.game!.save();
    }
  }

  hasMaterial(mat: Material): boolean {
    return this.heldMaterials.indexOf(mat) !== -1;
  }

  takeMaterial(mat: Material, isInitializing = false) {
    if(this.heldMaterials.length >= this.materialInventorySize) {
      playSFX('bad-job-4');
      toast('You can’t hold that many things.');
      return;
    }
    if(this.hasMaterial(mat)) {
      playSFX('bad-job-4');
      toast('You’ve already got one of those.');
      return;
    }
    if(!isInitializing) {
      playSFX('great-jearb-06');
    }
    this.heldMaterials.push(mat);
    const hotbarItem = {
      imageUrl: mat.inventoryImageUrl ?? mat.worldImageUrl ?? PLACEHOLDER_IMAGE_URL,
      name: mat.name,
      onActivate: () => {
        const [cauldron] = this.room!.getObjectsOfType(Cauldron);
        if(!cauldron) {
          toast('This goes in a cauldron');
          return;
        }

        if(!this.canReach(cauldron.x, cauldron.y)) {
          toast('You cannot reach that');
          return;
        }

        if(!cauldron.putItem(mat)) {
          return;
        }
        this.hotbar.removeItem(hotbarItem);
        this.heldMaterials.splice(this.heldMaterials.indexOf(mat), 1);
        window.game!.save();
      }
    };
    this.hotbar.addItem(hotbarItem);
    if(!isInitializing) {
      window.game!.save();
    }
  }

  applyPotion(potion: Potion): boolean {
    const { applyTo } = potion;
    const materialToApplyTo = this.heldMaterials.find(mat => getMaterialType(mat) === applyTo);
    const puzzleObjectToApplyTo = this.heldPuzzleObjects.find(po => getPuzzleObjectType(po) === applyTo);
    if (materialToApplyTo) {
      const { turnsInto } = potion;
      const newMaterial = materials[turnsInto as MaterialType];
      this.heldMaterials.splice(this.heldMaterials.indexOf(materialToApplyTo), 1, newMaterial);
      return true;
    } else if (puzzleObjectToApplyTo) {
      const { turnsInto } = potion;
      const newPuzzleObject = puzzleObjects[turnsInto as PuzzleObjectType];
      this.heldPuzzleObjects.splice(this.heldPuzzleObjects.indexOf(puzzleObjectToApplyTo), 1, newPuzzleObject);
      return true;
    }
    return false;
  }
}

interface PlayerData {
  x: number;
  y: number;
  heldMaterials: MaterialType[];
  heldPuzzleObjects: PuzzleObjectType[];
  materialInventorySize?: number;
}

const PLACEHOLDER_IMAGE_URL = "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/120/apple/285/large-blue-square_1f7e6.png";
