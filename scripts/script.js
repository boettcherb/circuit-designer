import { stage } from "./stage.js";
import { grid } from "./grid.js";
import { compManager } from "./compManager.js";
import { Battery, Capacitor, Resistor, Inductor } from "./comp.js";

grid.draw();
compManager.addComponent(new Resistor(2, 2));

// Handle key presses
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete') {
        compManager.deleteSelected();
    }
});

// Handle window resizing
window.addEventListener('resize', () => {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    grid.draw();
});

// Prevent the browser’s default context menu on right-click
stage.on('contextmenu', (e) => {
    e.evt.preventDefault();
});

// Deselect all components when the user clicks on the stage
let click = false;
stage.on('click', () => {
    if (click) {
        click = false;
        compManager.deselectAll();
    }
});

let lastMousePos = { x: 0, y: 0 };
stage.on('mousedown touchstart', () => {
    click = true;
    grid.isDragging = true;
    lastMousePos = stage.getPointerPosition();
});
stage.on('mousemove touchmove', () => {
    click = false;
    if (!grid.isDragging) {
        return;
    }
    
    const curMousePos = stage.getPointerPosition();
    const dx = curMousePos.x - lastMousePos.x;
    const dy = curMousePos.y - lastMousePos.y;
    lastMousePos = curMousePos;
    
    grid.updateOffset(dx, dy);
    grid.draw();
    compManager.repositionComps();
});
stage.on('mouseup touchend', () => {
    grid.isDragging = false;
});


// Scroll wheel event handler. Resize the grid squares (increase when zooming
// in, decrease when zooming out). This function is throttled to only run
// every 30 milliseconds to prevent scrolling too fast.
const GRIDSIZE_MIN = 5;
const GRIDSIZE_MAX = 200;
const GRID_RESIZE_TIMEOUT = 30;
let throttle = false;
stage.on('wheel', (e) => {
    e.evt.preventDefault();
    if (throttle) {
        return;
    }
    throttle = true;
    const oldGridSize = grid.gridSize;

    // update the origin of the grid so that the scroll happens relative
    // to the mouse position
    const oldOrigin = grid.setNewOrigin(stage.getPointerPosition());
    if (oldOrigin.oldX !== grid.offsetX || oldOrigin.oldY !== grid.offsetY) {
        // If the origin has changed, update all components' gw and gh values
        // (this will not actually move the components or update their positions
        // relative to the screen).
        compManager.handleGridOriginUpdate(oldOrigin);
    }

    // calculate the new grid size
    let ds = Math.ceil((e.evt.wheelDelta > 0 ? 1 : -1) * grid.gridSize / 6);
    grid.gridSize = grid.gridSize + ds;
    if (grid.gridSize < GRIDSIZE_MIN)
        grid.gridSize = GRIDSIZE_MIN;
    else if (grid.gridSize > GRIDSIZE_MAX)
        grid.gridSize = GRIDSIZE_MAX;

    // draw the new grid
    grid.draw();

    // reposition and scale the components
    compManager.repositionComps();
    compManager.scaleComps(oldGridSize);

    setTimeout(() => { throttle = false }, GRID_RESIZE_TIMEOUT);
});


// Add event listeners for the dropdown buttons on the left sidebar.
document.getElementById('io-dropdown-button').addEventListener('click', () => {
    toggleDropdown('io');
});
document.getElementById('basic-components-dropdown-button').addEventListener('click', () => {
    toggleDropdown('basic-components');
});
document.getElementById('logic-gates-dropdown-button').addEventListener('click', () => {
    toggleDropdown('logic-gates');
});


// The user just clicked on the dropdown with the given id. If this dropdown
// was already open, close it. Otherwise, open it.
function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
}


// If a component in the left sidebar is clicked, add it to the canvas.
document.getElementById('battery-dropdown-item').addEventListener('click', () => {
    compManager.addComponent(new Battery(2, 2));
});
document.getElementById('resistor-dropdown-item').addEventListener('click', () => {
    compManager.addComponent(new Resistor(2, 2));
});
document.getElementById('capacitor-dropdown-item').addEventListener('click', () => {
    compManager.addComponent(new Capacitor(2, 2));
});
document.getElementById('inductor-dropdown-item').addEventListener('click', () => {
    compManager.addComponent(new Inductor(2, 2));
});
