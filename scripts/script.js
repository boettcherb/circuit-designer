import { stage } from "./stage.js";
import { grid } from "./grid.js";
import { circuitManager } from "./circuitManager.js";
import { Battery, Capacitor, Resistor, Inductor } from "./comp.js";

grid.draw();

// Handle key presses
document.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Delete') circuitManager.circuit.deleteSelected();
    if (e.ctrlKey && e.key === 's') circuitManager.save();
});

// Save circuits to local storage every 10 seconds
setInterval(() => { circuitManager.save(); }, 10000);

// handle menu button presses
document.getElementById('clear-canvas-menu-btn').addEventListener('click', () => {
    circuitManager.circuit.clearAll();
});
document.getElementById('my-circuits-menu-btn').addEventListener('click', openCircuitsModal);
document.getElementById('close-my-circuits-btn').addEventListener('click', () => {
    document.getElementById('my-circuits-modal').style.display = 'none';
});

function openCircuitsModal() {
    const circuitList = document.getElementById('my-circuits-list');
    circuitList.innerHTML = '';
    for (const name of circuitManager.circuitNames) {
        const li = document.createElement('li');
        if (name === circuitManager.circuit.name)
            li.classList.add('selected-circuit');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.classList.add('circuit-name');
        li.appendChild(nameSpan);

        // TODO: select button
        // TODO: move up button
        // TODO: move down button
        // TODO: rename button

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('circuitlist-delete-btn');
        deleteButton.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete circuit "${name}"?`)) {
                circuitManager.deleteCircuit(name);
                openCircuitsModal();
            }
        });
        li.appendChild(deleteButton);

        circuitList.appendChild(li);
    }
    document.getElementById('my-circuits-modal').style.display = 'block';
}

document.getElementById('add-circuit-btn').addEventListener('click', () => {
    circuitManager.newCircuit();
    openCircuitsModal();
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
        circuitManager.circuit.deselectAll();
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
    circuitManager.circuit.repositionComps();
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
        circuitManager.circuit.handleGridOriginUpdate(oldOrigin);
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
    circuitManager.circuit.repositionComps();
    circuitManager.circuit.scaleComps(oldGridSize);

    setTimeout(() => { throttle = false }, GRID_RESIZE_TIMEOUT);
});

// Handle the sidebar dropdowns
for (const sidebarBtn of document.getElementsByClassName('sidebar-btn')) {
    sidebarBtn.addEventListener('click', (e) => {
        const dropdown = e.target.nextElementSibling;
        dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
    });
}

// If a component in the left sidebar is clicked, add it to the canvas.
document.getElementById('battery-dropdown-item').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(new Battery(2, 2, c));
});
document.getElementById('resistor-dropdown-item').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(new Resistor(2, 2, c));
});
document.getElementById('capacitor-dropdown-item').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(new Capacitor(2, 2, c));
});
document.getElementById('inductor-dropdown-item').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(new Inductor(2, 2, c));
});
