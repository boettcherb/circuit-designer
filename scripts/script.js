import { stage } from "./stage.js";
import { grid } from "./grid.js";
import { circuitManager } from "./circuitManager.js";
import { Component, ComponentType } from "./comp.js";

grid.draw();

// Debounce function to limit the rate at which a function can fire
function debounce(callback, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback(...args), delay);
    };
}

// Throttle function to limit the rate at which a function can fire
function throttle(callback, delay) {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            callback(...args);
        }
    };
}

// Handle key presses
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent the browser’s default save dialog
        circuitManager.save();
    }
    // Ignore this event if the user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
        return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.shiftKey) circuitManager.circuit.deleteAllInSelected();
        else circuitManager.circuit.deleteSelected();
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
    if (!grid.isDragging) return;
    
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
stage.on('wheel', throttle((e) => {
    e.evt.preventDefault();
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
}, 30)); // throttle the scroll event to every 30 milliseconds

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

// If a component in the left sidebar is clicked, add it to the canvas.
// TODO: Find the gx and gy of the middle of the canvas and add the component there
// instead of placing each component at (2, 2).
document.getElementById('battery-di').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(Component.createComponent({ t: ComponentType.BATTERY, x: 2, y: 2 }, c));
});
document.getElementById('resistor-di').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(Component.createComponent({ t: ComponentType.RESISTOR, x: 2, y: 2 }, c));
});
document.getElementById('capacitor-di').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(Component.createComponent({ t: ComponentType.CAPACITOR, x: 2, y: 2 }, c));
});
document.getElementById('inductor-di').addEventListener('click', () => {
    const c = circuitManager.circuit;
    c.addComponent(Component.createComponent({ t: ComponentType.INDUCTOR, x: 2, y: 2 }, c));
});



// Handle modals

// Close a modal if the user clicks outside of it or on the close button
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-background')) {
        e.target.style.display = 'none';
    } else if (e.target.classList.contains('close-btn')) {
        e.target.parentElement.parentElement.parentElement.style.display = 'none';
    }
});

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


const compAttrModal = document.getElementById('comp-attributes-modal');
const compNameInput = document.getElementById('comp-name-input');
const compSizeInput = document.getElementById('comp-size-input');
const resetSizeInput = document.getElementById('reset-comp-size-btn');
const rotateLeftBtn = document.getElementById('rotate-left-btn');
const rotateRightBtn = document.getElementById('rotate-right-btn');
const hideNameInput = document.getElementById('hide-comp-name-input');
const hideTerminalsInput = document.getElementById('hide-comp-terminals-input');
const applySettingsToAllBtn = document.getElementById('apply-settings-to-all-btn');
const applyValuesToAllBtn = document.getElementById('apply-values-to-all-btn');
const deleteCompBtn = document.getElementById('delete-comp-btn');
const attrList = document.getElementById('comp-attributes-list');

let selectedComp = null;
function openComponentAttributesModal() {
    if (selectedComp === null) throw new Error('No component selected');
    const modal = compAttrModal;
    modal.style.display = 'block';
    const modalHeader = modal.firstElementChild;
    modalHeader.textContent = `${selectedComp.getComponentTypeName()} Attributes`;
    compNameInput.value = selectedComp.attributes.name;
    hideNameInput.checked = selectedComp.attributes.hideName;
    compSizeInput.value = selectedComp.attributes.size;
    applySettingsToAllBtn.textContent = `Apply these settings
        to all ${selectedComp.getComponentTypeName(true)}`;
    applyValuesToAllBtn.textContent = `Apply these values
        to all ${selectedComp.getComponentTypeName(true)}`;
    attrList.innerHTML = '';
    const { name, orientation, size, hideTerminals, hideName, ...rest } = selectedComp.attributes;
    for (const [key, value] of Object.entries(rest)) {
        const li = document.createElement('li');
        const label = document.createElement('label');
        label.textContent = `${key}: `;
        label.htmlFor = `attr-${key}`;
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `attr-${key}`;
        input.value = value;
        li.appendChild(label);
        li.appendChild(input);
        attrList.appendChild(li);
        input.addEventListener('input', debounce((e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && isFinite(val)) {
                selectedComp.setAttribute(key, val);
            }
        }, 1000)); // Debounce the input to save every second
    }
};


// Handle component attributes modal inputs
compNameInput.addEventListener('input', debounce((e) => {
    selectedComp.rename(e.target.value);
}, 1000)); // Debounce the input to save every second
hideNameInput.addEventListener('click', () => {
    selectedComp.hideName(hideNameInput.checked);
});
compSizeInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && isFinite(val))
        selectedComp.resize(Math.max(compSizeInput.min, Math.min(compSizeInput.max, val)));
});
resetSizeInput.addEventListener('click', () => {
    selectedComp.resize(selectedComp.constructor.defaults.size);
    compSizeInput.value = selectedComp.attributes.size;
});
rotateLeftBtn.addEventListener('click', () => {
    selectedComp.rotate(false);
});
rotateRightBtn.addEventListener('click', () => {
    selectedComp.rotate(true);
});
hideTerminalsInput.addEventListener('click', () => {
    selectedComp.hideTerminals(hideTerminalsInput.checked);
});
applySettingsToAllBtn.addEventListener('click', () => {
    console.log("Apply settings to all button pressed");
});
applyValuesToAllBtn.addEventListener('click', () => {
    console.log("Apply values to all button pressed");
});
deleteCompBtn.addEventListener('click', () => {
    circuitManager.circuit.deleteSelected();
    compAttrModal.style.display = 'none';
});


// Handle custom events to show/hide the component attributes modal
document.addEventListener('showCompAttrs', (e) => {
    selectedComp = e.detail.comp;
    openComponentAttributesModal();
});
document.addEventListener('hideCompAttrs', () => {
    selectedComp = null;
    compAttrModal.style.display = 'none';
});
