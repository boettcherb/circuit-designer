import { grid } from "./grid.js";
import { stage } from "./stage.js";
import { Component, Wire, Node, NodeType } from "./comp.js";

export class Circuit {
    constructor(name, buildData = null) {
        this.name = name;
        this.updated = true;
        this.components = [];
        this.wires = [];
        this.nodes = []; // nodes not tied to components

        this.layer = new Konva.Layer();
        stage.add(this.layer);

        // Used for generating unique names for components.
        // Map storing the highest number currently used for a default component name.
        this.counts = new Map();

        // The first element (index 0) is the selected component.
        // The other elements (index > 0) are the wires and nodes
        // connected to (shorted to) the selected component.
        this.selected = [];

        // used for CTRL+Z and CTRL+Y
        this.history = [this.serialize()];
        this.historyIndex = 0;
        if (buildData !== null) this.build(buildData);
    }

    update() {
        this.updated = true;
        this.history = this.history.slice(0, ++this.historyIndex);
        this.history.push(this.serialize());
    }

    // Load a circuit from a JSON object.
    build(data) {
        this.clearAll(false);
        this.name = data.name;
        for (const comp of data.comps)
            this.addComponent(Component.createComponent(comp, this), false);
        for (const node of data.nodes)
            this.addNode(new Node(NodeType.WIRE, node.x, node.y, null, this), false);
        for (const wire of data.wires) {
            let startNode = Array.isArray(wire.s) ? this.components[wire.s[0]].terminals[wire.s[1]] : this.nodes[wire.s];
            let endNode = Array.isArray(wire.e) ? this.components[wire.e[0]].terminals[wire.e[1]] : this.nodes[wire.e];
            this.createWire(startNode, endNode, false);
        }
        this.history.push(data);
        this.historyIndex = this.history.length - 1;
        this.updated = true;
    }
    
    addComponent(component, saveUpdate = true) {
        if (!(component instanceof Component)) throw new Error("component is not a Component!");
        const group = component.group;

        group.on('dragmove', () => {
            const snapped = grid.snapToGrid(group.position());
            if (snapped.x === group.x() && snapped.y === group.y()) return;
            group.position(snapped);
            const old_gx = component.gx;
            const old_gy = component.gy;
            component.gx = (group.x() - grid.offsetX) / grid.gridSize;
            component.gy = (group.y() - grid.offsetY) / grid.gridSize;
            for (const terminal of component.terminals) {
                terminal.gx += component.gx - old_gx;
                terminal.gy += component.gy - old_gy;
                for (const wire of terminal.connections) {
                    wire.line.points([...wire.startNode.getPos(), ...wire.endNode.getPos()]);
                }
            }
            component.nameText.x(group.x() + component.nameOffset.x * grid.gridSize);
            component.nameText.y(group.y() + component.nameOffset.y * grid.gridSize);
            component.group.moveToTop();
            if (!component.hideName) component.nameText.moveToTop();
            this.layer.draw();
        });

        group.on('dragend', () => {
            // If the component is outside the stage, remove it
            const pos = group.position();
            if (pos.y + group.height() < 0 || pos.y > stage.height() ||
                pos.x + group.width() < 0 || pos.x > stage.width()) {
                this.deleteComponent(component);
                return;
            }
            // merge nodes at the new grid position of the component
            for (const terminal of component.terminals) {
                this.mergeNodesAt(terminal.gx, terminal.gy);
            }
            this.layer.draw();
            this.update();
        });

        component.nameText.on('dragend', () => {
            // If the name text is outside the stage, remove it
            const pos = component.nameText.position();
            if (pos.y + component.nameText.height() < 0 || pos.y > stage.height() ||
                pos.x + component.nameText.width() < 0 || pos.x > stage.width()) {
                component.nameText.x(group.x() + component.nameOffset.x * grid.gridSize);
                component.nameText.y(group.y() + component.nameOffset.y * grid.gridSize);
                component.setHideName(true);
                return;
            }
            component.nameOffset.x = (component.nameText.x() - group.x()) / grid.gridSize;
            component.nameOffset.y = (component.nameText.y() - group.y()) / grid.gridSize;
            this.layer.draw();
        });

        // Prevent grid from dragging when the user is dragging a component
        group.on('mousedown touchstart', (e) => { e.cancelBubble = true; });
        component.nameText.on('mousedown touchstart', (e) => { e.cancelBubble = true; });

        group.on('click', () => { this.select(component); });
        group.on('mouseover', () => { document.body.style.cursor = 'pointer'; });
        group.on('mouseout', () => { document.body.style.cursor = 'default'; });
        component.nameText.on('click', () => { this.select(component); });
        component.nameText.on('mouseover', () => { document.body.style.cursor = 'pointer'; });
        component.nameText.on('mouseout', () => { document.body.style.cursor = 'default'; });

        // if the component has a default name, increment the count
        if (component.hasDefaultName()) {
            const num = parseInt(component.name.slice(1), 10);
            if (isNaN(num)) throw new Error("Invalid default name!");
            if (!this.counts.has(component.type) || num > this.counts.get(component.type))
                this.counts.set(component.type, num);
        }

        this.components.push(component);
        this.layer.add(group);
        if (!component.hideName) this.layer.add(component.nameText);
        this.layer.draw();
        if (saveUpdate) this.update();
    }

    deleteComponent(comp, saveUpdate = true) {
        if (!(comp instanceof Component)) throw new Error("comp is not a Component!");
        if (comp === this.selected[0]) this.deselectAll();
        const index = this.components.findIndex(item => item === comp);
        if (index == -1) throw new Error("comp not in this.components!");

        // remove wires attached to this component
        for (const terminal of comp.terminals) {
            for (const wire of terminal.connections) {
                this.deleteWire(wire, false);
            }
        }

        this.components.splice(index, 1);

        // if this component has a default name with the highest number, set the count
        // to the next highest number.
        if (comp.hasDefaultName()) {
            const num = parseInt(comp.name.slice(1), 10);
            if (num === this.counts.get(comp.type)) {
                let highest = 0;
                for (const comp of this.components) {
                    if (comp.type === comp.type && comp.hasDefaultName()) {
                        const n = parseInt(comp.name.slice(1), 10);
                        if (n > highest) highest = n;
                    }
                }
                this.counts.set(comp.type, highest);
            }
        }

        comp.group.destroy();
        comp.nameText.destroy();
        this.layer.draw();
        if (saveUpdate) this.update();
    }

    addWire(wire, saveUpdate = true) {
        if (!(wire instanceof Wire)) throw new Error("wire is not a Wire!");
        this.wires.push(wire);
        this.layer.add(wire.line);
        wire.line.moveToBottom();
        this.layer.draw();
        wire.line.on('mouseover', () => { document.body.style.cursor = 'pointer'; });
        wire.line.on('mouseout', () => { document.body.style.cursor = 'default'; });
        wire.line.on('click', (e) => {
            e.cancelBubble = true;
            this.select(wire);
        });
        if (saveUpdate) this.update();
    }

    createWire(startNode, endNode, saveUpdate = true) {
        if (!(startNode instanceof Node)) throw new Error("startNode is not a Node!");
        if (!(endNode instanceof Node)) throw new Error("endNode is not a Node!");
        if (startNode === endNode) throw new Error("startNode and endNode are the same!");
        if (startNode.hasWireTo(endNode)) throw new Error("Wire already exists between startNode and endNode!");

        const wire = new Wire(startNode, ...startNode.getPos());
        wire.line.points([wire.line.points()[0], wire.line.points()[1], ...endNode.getPos()]);
        wire.endNode = endNode;
        startNode.connections.push(wire);
        endNode.connections.push(wire);
        this.addWire(wire, false);
        if (saveUpdate) this.update();
    }

    deleteWire(wire, saveUpdate = true) {
        if (!(wire instanceof Wire)) throw new Error("wire is not a Wire!");
        if (wire === this.selected[0]) this.deselectAll();
        // Remove the wire from the connections of the start and end nodes
        if (wire.startNode !== null)
            wire.startNode.connections = wire.startNode.connections.filter(w => w !== wire)
        if (wire.endNode !== null)
            wire.endNode.connections = wire.endNode.connections.filter(w => w !== wire)
        // Remove the wire from the list of wires
        this.wires = this.wires.filter(w => w !== wire);
        wire.line.destroy();
        this.layer.draw();
        if (saveUpdate) this.update();
    }

    // Get a list of nodes at the grid position (gx, gy).
    getNodesAt(gx, gy) {
        const nodes = [];
        for (const node of this.nodes)
            if (node.gx === gx && node.gy === gy) nodes.push(node);
        for (const comp of this.components) {
            for (const terminal of comp.terminals) {
                if (terminal.gx === gx && terminal.gy === gy) nodes.push(terminal);
            }
        }
        return nodes;
    }

    mergeNodesAt(gx, gy) {
        const nodes = this.getNodesAt(gx, gy);
        if (nodes.length < 2) return;
        let toDelete = null;
        for (const node of nodes) {
            if (node.comp === null) {
                toDelete = node;
                break;
            }
        }
        if (toDelete === null) {
            for (const n1 of nodes) {
                if (n1.comp === null) throw new Error("n1 should be tied to a component!");
                let isIsolated = true;
                for (const n2 of nodes) {
                    if (n1 !== n2 && n1.hasWireTo(n2)) {
                        isIsolated = false;
                        break;
                    }
                }
                if (isIsolated) {
                    this.createWire(n1, nodes[0] === n1 ? nodes[1] : nodes[0], false);
                    this.reselect();
                    return;
                }
            }
            return;
        }
        const otherNode = nodes[0] === toDelete ? nodes[1] : nodes[0];
        for (const wire of toDelete.connections) {
            if (wire.startNode === toDelete) wire.startNode = otherNode;
            else wire.endNode = otherNode;
            if (wire.startNode === wire.endNode) {
                this.deleteWire(wire, false);
                continue;
            }
            otherNode.connections.push(wire);
        }
        toDelete.connections = [];
        this.deleteNode(toDelete, false);
        this.reselect();
    }

    addNode(node, saveUpdate = true) {
        if (!(node instanceof Node)) throw new Error("node is not a Node!");
        this.nodes.push(node);
        this.layer.add(node.circle);
        this.layer.draw();
        node.circle.on('click', () => { this.select(node); });
        if (saveUpdate) this.update();
    }

    deleteNode(node, saveUpdate = true) {
        if (!(node instanceof Node)) throw new Error("node is not a Node!");
        if (node === this.selected[0]) this.deselectAll();
        if (node.comp !== null) {
            this.deleteComponent(node.comp, false);
            return;
        }
        const index = this.nodes.findIndex(item => item === node);
        if (index == -1) throw new Error("node not in this.nodes!");
        // remove wires attached to this node
        for (const wire of node.connections)
            this.deleteWire(wire, false);
        this.nodes.splice(index, 1);
        node.circle.destroy();
        this.layer.draw();
        if (saveUpdate) this.update();
    }

    // Ensure the position of every component is at a grid line intersection.
    // This is called whenever the grid is moved or scaled, or when
    // the comp's grid position (gx, gy) is updated.
    repositionComps() {
        for (const comp of this.components) {
            comp.group.x(grid.offsetX + comp.gx * grid.gridSize);
            comp.group.y(grid.offsetY + comp.gy * grid.gridSize);
            comp.nameText.x(comp.group.x() + comp.nameOffset.x * grid.gridSize);
            comp.nameText.y(comp.group.y() + comp.nameOffset.y * grid.gridSize);
        }
        for (const wire of this.wires) {
            wire.line.points([...wire.startNode.getPos(), ...wire.endNode.getPos()]);
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
            comp.nameText.x(comp.group.x() + comp.nameOffset.x * grid.gridSize);
            comp.nameText.y(comp.group.y() + comp.nameOffset.y * grid.gridSize);
            comp.nameText.fontSize(comp.nameText.fontSize() * scaleFactor);
        }
        for (const wire of this.wires) {
            wire.line.strokeWidth(grid.gridSize / 12);
            wire.line.hitStrokeWidth(grid.gridSize / 2);
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

    select(obj) {
        if (obj === null) throw new Error("obj is null!");
        if (this.selected.length > 0 && this.selected[0] === obj) {
            this.deselectAll();
            return;
        }
        this.deselectAll();
        this.selected.push(obj);
        let index = 0;
        let visited = new Set();
        visited.add(obj);
        // run BFS to find all wires/nodes connected to the selected component
        while (index < this.selected.length) {
            const o = this.selected[index++];
            if (o instanceof Wire) {
                if (o.startNode !== null && !visited.has(o.startNode)) {
                    this.selected.push(o.startNode);
                    visited.add(o.startNode);
                }
                if (o.endNode !== null && !visited.has(o.endNode)) {
                    this.selected.push(o.endNode);
                    visited.add(o.endNode);
                }
            } else if (o instanceof Node) {
                for (const wire of o.connections) {
                    if (!visited.has(wire)) {
                        this.selected.push(wire);
                        visited.add(wire);
                    }
                }
            } else if (o instanceof Component) {
                for (const terminal of o.terminals) {
                    visited.add(terminal);
                    for (const wire of terminal.connections) {
                        if (!visited.has(wire)) {
                            this.selected.push(wire);
                            visited.add(wire);
                        }
                    }
                }
            }
        }
        // highlight the main selected component red
        const selectedColor = '#FF3333';
        if (obj instanceof Component) {
            obj.group.find('Line').forEach(line => { line.stroke(selectedColor); });
            obj.group.find('Circle').forEach(circle => { circle.fill(selectedColor); });
        } else if (obj instanceof Wire) {
            obj.line.stroke(selectedColor);
        } else if (obj instanceof Node) {
            obj.circle.fill(selectedColor);
        }
        // highlight the other selected wires/nodes a darker red
        const otherColor = '#BB0000';
        for (let i = 1; i < this.selected.length; ++i) {
            const o = this.selected[i];
            if (o instanceof Wire) {
                o.line.stroke(otherColor);
            } else if (o instanceof Node) {
                o.circle.fill(otherColor);
            }
        }
        this.layer.draw();
        if (obj instanceof Component) {
            // send a custom event to open the component properties modal
            const event = new CustomEvent('showCompAttrs', { detail: { comp: obj } });
            document.dispatchEvent(event);
            // Color the component name text
            obj.nameText.fill(selectedColor);
        }
    }

    deselectAll() {
        for (const o of this.selected) {
            if (o instanceof Component) {
                o.group.find('Line').forEach(line => { line.stroke('black'); });
                o.group.find('Circle').forEach(circle => { circle.fill('black'); });
                o.nameText.fill('black');
            } else if (o instanceof Wire) {
                o.line.stroke('black');
            } else if (o instanceof Node) {
                o.circle.fill('black');
            }
        }
        this.selected = [];
        document.dispatchEvent(new CustomEvent('hideCompAttrs'));
    }

    // Deselect all components, and then reselect the main selected component.
    // This is used to update the selected array when the circuit changes.
    reselect() {
        if (this.selected.length === 0) return;
        const s = this.selected[0];
        this.deselectAll();
        this.select(s);
    }

    // Delete the selected component, wire, or node.
    deleteSelected() {
        if (this.selected.length === 0) return;
        const s = this.selected[0];
        if (s instanceof Component) this.deleteComponent(s);
        else if (s instanceof Wire) this.deleteWire(s);
        else if (s instanceof Node) this.deleteNode(s);
        this.deselectAll();
    }

    // Delete all components, wires, and nodes in the selected array (the
    // selected component and all wires and nodes connected to it).
    deleteAllInSelected() {
        for (const obj of this.selected) {
            if (obj instanceof Component) this.deleteComponent(obj, false);
            else if (obj instanceof Wire) this.deleteWire(obj, false);
            else if (obj instanceof Node && obj.comp === null) this.deleteNode(obj, false);
        }
        this.selected = [];
        this.update();
        document.dispatchEvent(new CustomEvent('hideCompAttrs'));
    }

    // Delete all components, wires, and nodes in the circuit.
    clearAll(saveUpdate = true) {
        this.layer.destroyChildren();
        this.components = [];
        this.wires = [];
        this.nodes = [];
        this.selected = [];
        this.counts.clear();
        this.layer.draw();
        if (saveUpdate) this.update();
        document.dispatchEvent(new CustomEvent('hideCompAttrs'));
    }
    
    serialize() {
        const map = new Map();
        const comps = [];
        const wires = [];
        const nodes = [];
        for (let i = 0; i < this.components.length; ++i)
            map.set(this.components[i], i);
        for (let i = 0; i < this.nodes.length; ++i)
            map.set(this.nodes[i], i);
        for (const comp of this.components)
            comps.push(comp.serialize());
        for (const node of this.nodes)
            nodes.push({ x: node.gx, y: node.gy });
        for (const wire of this.wires) {
            if (wire.startNode === null || wire.endNode === null) continue;
            let s = map.get(wire.startNode);
            let e = map.get(wire.endNode);
            if (s === undefined) s = [map.get(wire.startNode.comp), wire.startNode.comp.getTerminalIndex(wire.startNode)];
            if (e === undefined) e = [map.get(wire.endNode.comp), wire.endNode.comp.getTerminalIndex(wire.endNode)];
            wires.push({ s: s, e: e });
        }
        return { name: this.name, comps: comps, wires: wires, nodes: nodes };
    }

    undo() {
        if (this.historyIndex === 0) return;
        const historyCopy = structuredClone(this.history);
        const historyIndexCopy = this.historyIndex;
        this.build(this.history[this.historyIndex - 1]);
        this.history = historyCopy;
        this.historyIndex = historyIndexCopy - 1;
    }

    redo() {
        if (this.historyIndex === this.history.length - 1) return;
        const historyCopy = structuredClone(this.history);
        const historyIndexCopy = this.historyIndex;
        this.build(this.history[this.historyIndex + 1]);
        this.history = historyCopy;
        this.historyIndex = historyIndexCopy + 1;
    }

    getCount(type) {
        if (!this.counts.has(type)) this.counts.set(type, 0);
        return this.counts.get(type);
    }
}
