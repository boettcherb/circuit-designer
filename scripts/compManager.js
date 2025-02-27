import { grid } from "./grid.js";
import { stage } from "./stage.js";

class ComponentManager {
    constructor() {
        this.layer = new Konva.Layer();
        stage.add(this.layer);
        this.components = [];
        this.wires = [];
        this.nodes = []; // nodes not tied to components
    }
    
    addComponent(component) {
        const group = new Konva.Group({
            x: grid.offsetX + component.gx * grid.gridSize,
            y: grid.offsetY + component.gy * grid.gridSize,
            width: component.gw * grid.gridSize,
            height: component.gh * grid.gridSize,
            draggable: true,
        });

        // add all lines and terminals to the group
        for (const line of component.lines) {
            group.add(line);
        }
        for (const terminal of component.terminals) {
            group.add(terminal.circle);
        }

        group.on('dragmove', () => {
            group.position(grid.snapToGrid(group.position()));
            // update wire.line as the component is dragged
            for (const terminal of component.terminals) {
                for (const wire of terminal.connections) {
                    if (terminal === wire.startNode) {
                        wire.line.points()[0] = group.x() + terminal.circle.x() * group.scaleX();
                        wire.line.points()[1] = group.y() + terminal.circle.y() * group.scaleY();
                    } else {
                        // terminal === wire.endNode
                        wire.line.points()[2] = group.x() + terminal.circle.x() * group.scaleX();
                        wire.line.points()[3] = group.y() + terminal.circle.y() * group.scaleY();
                    }
                }
            }
            this.layer.draw();
        });

        group.on('dragend', () => {
            // If the component is outside the stage, remove it
            const pos = group.position();
            if (pos.y + group.height() < 0 || pos.y > stage.height()
                || pos.x + group.width() < 0 || pos.x > stage.width()) {
                const index = this.components.findIndex(item => item.group === group);
                if (index == -1) {
                    throw new Error("comp not in this.components!");
                }
                this.components.splice(index, 1);
                group.destroy();
                this.layer.draw();
                // TODO: remove wires attached to this component
                return;
            }

            // update gx and gy of this component and its terminals based on 
            // where it was dragged
            const old_gx = component.gx;
            const old_gy = component.gy;
            component.gx = (group.x() - grid.offsetX) / grid.gridSize;
            component.gy = (group.y() - grid.offsetY) / grid.gridSize;
            for (const terminal of component.terminals) {
                terminal.gx += component.gx - old_gx;
                terminal.gy += component.gy - old_gy;
            }
            this.layer.draw();
        });

        // Prevent grid from dragging when the user is dragging a component
        group.on('mousedown touchstart', (e) => {
            e.cancelBubble = true;
        });

        group.on('mouseover', () => {
            document.body.style.cursor = 'pointer';
        });

        group.on('mouseout', () => {
          document.body.style.cursor = 'default';
        });

        this.components.push(component);
        component.addGroup(group);
        this.layer.add(group);
        this.layer.draw();
    }

    addWire(wire) {
        this.wires.push(wire);
        this.layer.add(wire.line);
        wire.line.moveToBottom();
        this.layer.draw();
    }

    deleteWire(wire) {
        // Remove the wire from the connections of the start and end nodes
        if (wire.startNode !== null) {
            wire.startNode.connections = wire.startNode.connections.filter(w => w !== wire)
        }
        if (wire.endNode !== null) {
            wire.endNode.connections = wire.endNode.connections.filter(w => w !== wire)
        }
        // Remove the wire from the list of wires
        this.wires = this.wires.filter(w => w !== wire);
        wire.line.destroy();
        this.layer.draw();
    }

    // Get the node at the grid position (gx, gy). If no node exists at that
    // position, return null
    getNode(gx, gy) {
        for (const node of this.nodes) {
            if (node.gx === gx && node.gy === gy) {
                return node;
            }
        }
        for (const comp of this.components) {
            for (const terminal of comp.terminals) {
                if (terminal.gx === gx && terminal.gy === gy) {
                    return terminal;
                }
            }
        }
        return null;
    }

    addNode(node) {
        this.nodes.push(node);
        this.layer.add(node.circle);
        this.layer.draw();
    }
    
    // Ensure the position of every component is at a grid line intersection.
    // This is called whenever the grid is moved or scaled, or when
    // the comp's grid position (gx, gy) is updated.
    repositionComps() {
        for (const comp of this.components) {
            comp.group.x(grid.offsetX + comp.gx * grid.gridSize);
            comp.group.y(grid.offsetY + comp.gy * grid.gridSize);
        }
        for (const wire of this.wires) {
            const x1 = grid.offsetX + wire.startNode.gx * grid.gridSize;
            const y1 = grid.offsetY + wire.startNode.gy * grid.gridSize;
            const x2 = grid.offsetX + wire.endNode.gx * grid.gridSize;
            const y2 = grid.offsetY + wire.endNode.gy * grid.gridSize;
            wire.line.points([x1, y1, x2, y2]);
        }
        for (const node of this.nodes) {
            node.circle.x(grid.offsetX + node.gx * grid.gridSize);
            node.circle.y(grid.offsetY + node.gy * grid.gridSize);
        }
    }
    
    // Scale all components when the grid size is changed. This function is
    // called when the user scrolls the mouse wheel to zoom in or out.
    scaleComps(oldGridSize) {
        const scaleFactor = grid.gridSize / oldGridSize;
        for (const comp of this.components) {
            const sx = comp.group.scaleX();
            const sy = comp.group.scaleY();
            comp.group.scale({ x: sx * scaleFactor, y: sy * scaleFactor });
        }
        for (const wire of this.wires) {
            wire.line.strokeWidth(grid.gridSize / 12);
        }
        for (const node of this.nodes) {
            node.circle.radius(grid.gridSize / 6);
        }
    }

    // Update the grid position of all components when the grid origin is changed.
    handleGridOriginUpdate({ oldX, oldY }) {
        const dx = (oldX - grid.offsetX) / grid.gridSize;
        const dy = (oldY - grid.offsetY) / grid.gridSize;
        for (const comp of this.components) {
            comp.updateGridPosition(dx, dy);
        }
        for (const node of this.nodes) {
            node.gx += dx;
            node.gy += dy;
        }
        this.repositionComps();
    }
}

export const compManager = new ComponentManager();
