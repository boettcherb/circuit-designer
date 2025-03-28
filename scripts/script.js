import { stage } from "./stage.js";
import { grid } from "./grid.js";
import { circuitManager } from "./circuitManager.js";
import { Battery, Capacitor, Resistor, Inductor } from "./comp.js";

grid.draw();

// Handle key presses
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.shiftKey) circuitManager.circuit.deleteAllInSelected();
        else circuitManager.circuit.deleteSelected();
    }
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent the browser’s default save dialog
        circuitManager.save();
    }
    if (e.ctrlKey && e.key === 'z') circuitManager.circuit.undo();
    if (e.ctrlKey && e.key === 'y') circuitManager.circuit.redo();
});

// Save circuits to local storage every 10 seconds
setInterval(() => { circuitManager.save(); }, 10000);

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

// handle menu button presses
document.getElementById('new-circuit-menu-btn').addEventListener('click', openNewCircuitModal);
document.getElementById('my-circuits-menu-btn').addEventListener('click', openMyCircuitsModal);
document.getElementById('clear-canvas-menu-btn').addEventListener('click', () => {
    circuitManager.circuit.clearAll();
});

// Handle the sidebar dropdowns
for (const sidebarBtn of document.getElementsByClassName('sidebar-btn')) {
    sidebarBtn.addEventListener('click', () => {
        const dropdown = sidebarBtn.nextElementSibling;
        const open = dropdown.style.display === 'flex';
        dropdown.style.display = open ? 'none' : 'flex';
        const icon = sidebarBtn.firstElementChild;
        icon.textContent = open ? 'keyboard_arrow_right' : 'keyboard_arrow_down';
    });
}

// Close a modal if user clicks outside of it or on the close button
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-background')) {
        e.target.style.display = 'none';
    } else if (e.target.classList.contains('close-btn')) {
        e.target.parentElement.parentElement.parentElement.style.display = 'none';
    }
});

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



// Handle modals

function openMyCircuitsModal() {
    const circuitList = document.getElementById('my-circuits-list');
    circuitList.innerHTML = '';
    for (const name of circuitManager.circuitNames) {
        const li = document.createElement('li');
        circuitList.appendChild(li);
        li.classList.add('circuit-name-li');
        li.addEventListener('click', () => {
            circuitManager.loadCircuit(name);
            openMyCircuitsModal();
        });
        if (name === circuitManager.circuit.name)
            li.classList.add('selected-circuit');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.classList.add('circuit-name');
        li.appendChild(nameSpan);

        const buttonDiv = document.createElement('div');
        li.appendChild(buttonDiv);

        const moveUpButton = document.createElement('button');
        const mvDownButton = document.createElement('button');
        const renameButton = document.createElement('button');
        const deleteButton = document.createElement('button');
        
        // Use Google icon classes for the icons
        moveUpButton.innerHTML = '<i class="material-icons md-24">keyboard_arrow_up</i>';
        mvDownButton.innerHTML = '<i class="material-icons md-24">keyboard_arrow_down</i>';
        renameButton.innerHTML = '<i class="material-icons md-24">edit</i>';
        deleteButton.innerHTML = '<i class="material-icons md-24">delete</i>';

        moveUpButton.classList.add('circuitlist-btn', 'circuitlist-move-btn');
        mvDownButton.classList.add('circuitlist-btn', 'circuitlist-move-btn');
        renameButton.classList.add('circuitlist-btn', 'circuitlist-rename-btn');
        deleteButton.classList.add('circuitlist-btn', 'circuitlist-delete-btn');

        buttonDiv.appendChild(moveUpButton);
        buttonDiv.appendChild(mvDownButton);
        buttonDiv.appendChild(renameButton);
        buttonDiv.appendChild(deleteButton);
        
        moveUpButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = circuitManager.circuitNames.indexOf(name);
            if (index > 0) {
                const temp = circuitManager.circuitNames[index - 1];
                circuitManager.circuitNames[index - 1] = name;
                circuitManager.circuitNames[index] = temp;
                openMyCircuitsModal();
            }
        });

        mvDownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = circuitManager.circuitNames.indexOf(name);
            if (index < circuitManager.circuitNames.length - 1) {
                const temp = circuitManager.circuitNames[index + 1];
                circuitManager.circuitNames[index + 1] = name;
                circuitManager.circuitNames[index] = temp;
                openMyCircuitsModal();
            }
        });
        
        renameButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('Enter a new name for the circuit:', name);
            if (newName === null) return;
            if (circuitManager.circuitNames.includes(newName)) {
                alert(`A circuit named "${newName}" already exists.`);
                return;
            }
            circuitManager.renameCircuit(name, newName);
            openMyCircuitsModal();
        });

        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete circuit "${name}"?
                This action cannot be undone.`)) {
                circuitManager.deleteCircuit(name);
                openMyCircuitsModal();
            }
        });
    }
    document.getElementById('my-circuits-modal').style.display = 'block';
}

document.getElementById('add-circuit-btn').addEventListener('click', () => {
    circuitManager.newCircuit();
    openMyCircuitsModal();
});

function openNewCircuitModal() {
    document.getElementById('new-circuit-modal').style.display = 'block';
    document.getElementById('new-circuit-error').textContent = '';
    const input = document.getElementById('new-circuit-name');
    input.value = '';
    input.focus();
}

document.getElementById('create-circuit-btn').addEventListener('click', () => {
    // TODO: Allow the Enter key to submit the form
    const modal = document.getElementById('new-circuit-modal');
    const nameInput = document.getElementById('new-circuit-name');
    const name = nameInput.value.trim();
    const validName = /^[A-Za-z0-9_-]{1,20}$/.test(name);
    if (validName) {
        circuitManager.newCircuit(name);
        modal.style.display = 'none';
        nameInput.value = '';
    } else {
        const p = document.getElementById('new-circuit-error');
        p.textContent = 'Invalid name.';
    }
});
