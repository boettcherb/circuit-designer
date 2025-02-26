import { stage } from "./stage.js";

class Grid {
    constructor(gridSize) {
        this.layer = new Konva.Layer();
        stage.add(this.layer);
        this.gridSize = gridSize;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
    }

    draw() {
        this.layer.destroyChildren();

        const { width, height } = stage.size();
        const startX = this.offsetX % this.gridSize;
        const startY = this.offsetY % this.gridSize;

        for (let x = startX; x < width; x += this.gridSize) {
            this.layer.add(new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#e9e9e9',
                strokeWidth: 1,
            }));
        }

        for (let y = startY; y < height; y += this.gridSize) {
            this.layer.add(new Konva.Line({
                points: [0, y, width, y],
                stroke: '#e9e9e9',
                strokeWidth: 1,
            }));
        }

        this.layer.draw();
    }

    snapToGrid(pos) {
        return {
            x: Math.round((pos.x - this.offsetX) / this.gridSize)
                * this.gridSize + this.offsetX,
            y: Math.round((pos.y - this.offsetY) / this.gridSize)
                * this.gridSize + this.offsetY,
        };
    }

    updateOffset(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
    }

    // Find the intersection point of the grid that is closest to the mouse
    // position. Set this as the new origin of the grid.
    setNewOrigin(mousePosition) {
        const { x, y } = this.snapToGrid(mousePosition);
        const oldX = this.offsetX;
        const oldY = this.offsetY;
        this.offsetX = x;
        this.offsetY = y;
        return { oldX, oldY };
    }
}

const DEFAULT_GRID_CELL_SIZE = 40;
export const grid = new Grid(DEFAULT_GRID_CELL_SIZE);
