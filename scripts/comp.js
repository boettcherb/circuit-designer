import { stage } from "./stage.js"
import { grid } from "./grid.js";


// enum for component types
export const ComponentType = {
    BATTERY: 1000,
    GROUND: 1001,
    INPUT_BIT: 1002,
    OUTPUT_BIT: 1003,
    RESISTOR: 2000,
    CAPACITOR: 2001,
    INDUCTOR: 2002,
    AND_GATE: 3000,
    OR_GATE: 3001,
    NOT_GATE: 3002,
    XOR_GATE: 3003,
    NAND_GATE: 3004,
    NOR_GATE: 3005,
    XNOR_GATE: 3006,
};


// Node Types:
//  - BIDIRECTIONAL: Current can flow into and out of the component from this
//                   node.
//  - INPUT:         An input into a component. Current cannot flow out of the
//                   component from this node. Ex: inputs to logic gates
//  - OUTPUT:        An output from a component. Current cannot flow into a
//                   component from this node. Ex: output of logic gates
//  - WIRE:          A split in wires. Not tied to a component.
export const NodeType = {
    BIDIRECTIONAL: 3456,
    INPUT: 3457,
    OUTPUT: 3458,
    WIRE: 3459,
};


export class Wire {
    constructor(node, startX, startY) {
        this.startNode = node;
        this.endNode = null;
        this.line = new Konva.Line({
            points: [ startX, startY, startX, startY ],
            stroke: 'black',
            strokeWidth: grid.gridSize / 12,
            hitStrokeWidth: grid.gridSize / 2,
        })
    }
}


export class Node {
    constructor(type, gx, gy, comp, circuit) {
        if (comp === null && type !== NodeType.WIRE) throw new Error("Invalid node (1)");
        if (comp !== null && type === NodeType.WIRE) throw new Error("Invalid node (2)");
        this.type = type;
        this.gx = gx;
        this.gy = gy;
        this.comp = comp;
        this.connections = []; // wires connected to this node
        this.circuit = circuit;

        // If this node is tied to a component, then comp is not null and the offset of this node is
        // relative to the component. If this node is NOT tied to a component, then comp is null and
        // the offset is relative to the grid.
        this.circle = new Konva.Circle({
            x: type === NodeType.WIRE ? grid.offsetX + gx * grid.gridSize : (gx - comp.gx) * grid.gridSize,
            y: type === NodeType.WIRE ? grid.offsetY + gy * grid.gridSize : (gy - comp.gy) * grid.gridSize,
            fill: 'black',
            radius: grid.gridSize / 6,
        });

        // left click on node: create wire coming from node
        // right click on node: start dragging node
        this.circle.on('mousedown', (e) => {
            e.cancelBubble = true;
            if (e.evt.button === 2) { // right click
                if (this.comp !== null) {
                    this.comp.group.startDrag();
                } else {
                    this.circle.draggable(true);
                    this.circle.startDrag();
                }
            } else { // left click
                this.createWire(...this.getPos());
            }
        });

        // When a node is dragged, snap it to the grid and update connected wires.
        this.circle.on('dragmove', () => {
            const pos = grid.snapToGrid(this.circle.position());
            this.circle.position(pos);
            this.gx = (pos.x - grid.offsetX) / grid.gridSize;
            this.gy = (pos.y - grid.offsetY) / grid.gridSize;
            for (const wire of this.connections) {
                if (this === wire.startNode) {
                    wire.line.points()[0] = pos.x;
                    wire.line.points()[1] = pos.y;
                } else if (this === wire.endNode) {
                    wire.line.points()[2] = pos.x;
                    wire.line.points()[3] = pos.y;
                }
            }
            this.circuit.layer.draw();
        });

        this.circle.on('dragend', () => {
            this.circle.draggable(false);
            this.circuit.mergeNodesAt(this.gx, this.gy);
            this.circuit.update();
        })

        this.circle.on('mouseover', () => { document.body.style.cursor = 'pointer'; });
        this.circle.on('mouseout', () => { document.body.style.cursor = 'default'; });
    }
    
    createWire(startX, startY) {
        const wire = new Wire(this, startX, startY);
        // temporarily add wire to layer so we can see it as it is being drawn
        this.circuit.layer.add(wire.line);

        // Update wire endpoint on mousemove
        stage.on('mousemove.wire', () => {
            const pos = grid.snapToGrid(stage.getPointerPosition());
            wire.line.points([startX, startY, pos.x, pos.y]);
        });

        // Finalize wire on mouseup
        stage.on('mouseup.wire', () => {
            stage.off('mousemove.wire'); // Stop updating wire
            stage.off('mouseup.wire');   // Remove this listener
            const gx2 = this.gx + (wire.line.points()[2] - startX) / grid.gridSize;
            const gy2 = this.gy + (wire.line.points()[3] - startY) / grid.gridSize;
            // if the created wire is length 0, delete it
            if (this.gx == gx2 && this.gy == gy2) {
                wire.line.remove();
            } else {
                let endNode = this.circuit.getNodesAt(gx2, gy2)[0];
                if (endNode === undefined) {
                    endNode = new Node(NodeType.WIRE, gx2, gy2, null, this.circuit);
                    this.circuit.addNode(endNode, false);
                }
                wire.endNode = endNode;
                this.connections.push(wire);
                endNode.connections.push(wire);
                wire.line.remove();
                this.circuit.addWire(wire, startX, startY);
            }            
            this.circuit.reselect();
        });
    }

    hasWireTo(node) {
        for (const wire of this.connections) {
            if (wire.startNode === node || wire.endNode === node) return true;
        }
        return false;
    }

    getPos() {
        return [
            this.gx * grid.gridSize + grid.offsetX,
            this.gy * grid.gridSize + grid.offsetY,
        ];
    }
}


export class Component {
    constructor(type, gx, gy) {
        if (new.target === Component)
            throw new Error('Cannot instantiate abstract class Component directly');
        this.type = type;
        this.gx = gx;
        this.gy = gy;
        this.terminals = [];
        this.group = new Konva.Group({
            x: grid.offsetX + gx * grid.gridSize,
            y: grid.offsetY + gy * grid.gridSize,
            draggable: true,
        });
    }

    setup(data) {
        for (const shape of this.shapes)
            this.group.add(shape);
        for (const terminal of this.terminals) {
            this.group.add(terminal.circle);
            terminal.circle.on('click', (e) => {
                e.cancelBubble = true;
                circuit.select(this);
            });
        }
        if (data.s !== undefined) this.resize(data.s);
        if (data.o !== undefined) {
            for (let i = 0; i < data.o; i++) {
                this.rotate(true);
            }
        }
    }

    updateGridPosition(dx, dy) {
        this.gx += dx;
        this.gy += dy;
        for (const node of this.terminals) {
            node.gx += dx;
            node.gy += dy;
        }
    }

    getTerminalIndex(node) {
        const index = this.terminals.indexOf(node);
        if (index === -1) throw new Error('Node is not a terminal of this component');
        return index;
    }

    static createComponent(data, circuit) {
        switch (data.t) {
            case ComponentType.BATTERY: return new Battery(data, circuit);
            case ComponentType.RESISTOR: return new Resistor(data, circuit);
            case ComponentType.CAPACITOR: return new Capacitor(data, circuit);
            case ComponentType.INDUCTOR: return new Inductor(data, circuit);
            default:
                throw new Error('Invalid component type');
        }
    }

    rename(name) {
        this.attributes.name = name;
        this.circuit.update();
    }
    
    resize(size) {
        if (size === this.attributes.size || size < 1) return;
        const sizeChange = size / this.attributes.size;
        for (const shape of this.shapes) {
            if (shape instanceof Konva.Line) {
                shape.points(shape.points().map(point => point * sizeChange));
            } else if (shape instanceof Konva.Rect) {
                shape.x(shape.x() * sizeChange);
                shape.y(shape.y() * sizeChange);
                shape.width(shape.width() * sizeChange);
                shape.height(shape.height() * sizeChange);
            }
        }
        for (const terminal of this.terminals) {
            terminal.gx = this.gx + (terminal.gx - this.gx) * sizeChange;
            terminal.gy = this.gy + (terminal.gy - this.gy) * sizeChange;
            terminal.circle.x(terminal.circle.x() * sizeChange);
            terminal.circle.y(terminal.circle.y() * sizeChange);
            for (const wire of terminal.connections) {
                wire.line.points([...wire.startNode.getPos(), ...wire.endNode.getPos()]);
            }
        }
        this.attributes.size = size;
        this.circuit.update();
    }

    rotate(cw) {
        this.attributes.orientation = (this.attributes.orientation + (cw ? 1 : 3)) % 4;
        this.group.rotation(this.attributes.orientation * 90);
        const radians = this.attributes.orientation * Math.PI / 2;
        for (const terminal of this.terminals) {
            const cx = terminal.circle.x() * this.group.scaleX();
            const cy = terminal.circle.y() * this.group.scaleY();
            const r = Math.sqrt(cx * cx + cy * cy);
            const offset = Math.atan2(cy, cx);
            terminal.gx = this.gx + r * Math.cos(radians + offset) / grid.gridSize;
            terminal.gy = this.gy + r * Math.sin(radians + offset) / grid.gridSize;
            for (const wire of terminal.connections) {
                wire.line.points([...wire.startNode.getPos(), ...wire.endNode.getPos()]);
            }
        }
        this.circuit.update();
    }

    hideName(hide) {
        this.attributes.hideName = hide;
        // TODO: hide or show name
        this.circuit.update();
    }

    hideTerminals(hide) {
        this.attributes.hideTerminals = hide;
        // TODO: hide or show terminals
        this.circuit.update();
    }

    setAttribute(name, value) {
        if (this.attributes[name] === undefined) throw new Error('Invalid attribute name');
        this.attributes[name] = value;
        this.circuit.update();
    }
}


class Resistor extends Component {
    constructor(data, circuit) {
        if (data.x === undefined || data.y === undefined)
            throw new Error('Invalid resistor data');
        super(ComponentType.RESISTOR, data.x, data.y);
        this.circuit = circuit;
        this.attributes = {
            name: data.n ?? `R${circuit.getCount(ComponentType.RESISTOR) + 1}`,
            orientation: Resistor.defaults.orientation,
            size: Resistor.defaults.size,
            hideTerminals: data.ht ?? Resistor.defaults.hideTerminals,
            hideName: data.hn ?? Resistor.defaults.hideName,
            resistance: data.r ?? Resistor.defaults.resistance,
            powerRating: data.p ?? Resistor.defaults.powerRating,
        };
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.BIDIRECTIONAL, data.x, data.y, this, circuit),
            new Node(NodeType.BIDIRECTIONAL, data.x + 3, data.y, this, circuit),
        ];
        const sWidth = s / 12;
        this.shapes = [
            new Konva.Line({
                points: [
                    0, 0,
                    0.75 * s, 0,
                    0.875 * s, -0.5 * s,
                    1.125 * s, 0.5 * s,
                    1.375 * s, -0.5 * s,
                    1.625 * s, 0.5 * s,
                    1.875 * s, -0.5 * s,
                    2.125 * s, 0.5 * s,
                    2.25 * s, 0,
                    3 * s, 0
                ],
                stroke: 'black',
                strokeWidth: sWidth,
                lineCap: 'round',
                lineJoin: 'round',
            }),
            // hitbox
            new Konva.Rect({
                x: 0,
                y: -0.5 * s,
                width: 3 * s,
                height: s,
                fill: 'transparent',
                strokeWidth: 0,
            }),
        ];
        this.setup(data);
    }

    static get defaults() {
        return Object.freeze({
            orientation: 0,       // 0-4: 0, 90, 180, 270 degrees
            size: 3,              // length in grid units
            hideTerminals: false,
            hideName: true,
            resistance: 1000,     // Ohms
            powerRating: 0.25,    // Watts
        });
    }

    hasDefaultName() {
        return this.attributes.name.match(/^R\d+$/) !== null;
    }

    getComponentTypeName() {
        return "Resistor";
    }

    serialize() {
        const result = { t: this.type, x: this.gx, y: this.gy, n: this.attributes.name };
        if (this.attributes.orientation !== Resistor.defaults.orientation)     result.o = this.attributes.orientation;
        if (this.attributes.size !== Resistor.defaults.size)                   result.s = this.attributes.size;
        if (this.attributes.hideTerminals !== Resistor.defaults.hideTerminals) result.ht = this.attributes.hideTerminals;
        if (this.attributes.hideName !== Resistor.defaults.hideName)           result.hn = this.attributes.hideName;
        if (this.attributes.resistance !== Resistor.defaults.resistance)       result.r = this.attributes.resistance;
        if (this.attributes.powerRating !== Resistor.defaults.powerRating)     result.p = this.attributes.powerRating;
        return result;
    }
}


class Capacitor extends Component {
    constructor(data, circuit) {
        if (data.x === undefined || data.y === undefined) throw new Error('Invalid capacitor data');
        super(ComponentType.CAPACITOR, data.x, data.y);
        this.circuit = circuit;
        this.attributes = {
            name: data.n ?? `C${circuit.getCount(ComponentType.CAPACITOR) + 1}`,
            orientation: Capacitor.defaults.orientation,
            size: Capacitor.defaults.size,
            hideTerminals: data.ht ?? Capacitor.defaults.hideTerminals,
            hideName: data.hn ?? Capacitor.defaults.hideName,
            capacitance: data.c ?? Capacitor.defaults.capacitance,
            voltageRating: data.v ?? Capacitor.defaults.voltageRating,
        };
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.BIDIRECTIONAL, data.x, data.y, this, circuit),
            new Node(NodeType.BIDIRECTIONAL, data.x + 3, data.y, this, circuit),
        ];
        const sWidth = s / 12;
        this.shapes = [
            // first lead
            new Konva.Line({
                points: [
                    0, 0,
                    1.2 * s, 0,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // first plate
            new Konva.Line({
                points: [
                    1.2 * s, -0.7 * s,
                    1.2 * s, 0.7 * s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // second plate
            new Konva.Line({
                points: [
                    1.8 * s, -0.7 * s,
                    1.8 * s, 0.7 * s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // second lead
            new Konva.Line({
                points: [
                    1.8 * s, 0,
                    3 * s, 0,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // hitbox
            new Konva.Rect({
                x: 0,
                y: -0.5 * s,
                width: 3 * s,
                height: s,
                fill: 'transparent',
                strokeWidth: 0,
            }),
        ];
        this.setup(data);
    }

    static get defaults() {
        return Object.freeze({
            orientation: 0,       // 0-4: 0, 90, 180, 270 degrees
            size: 3,              // length in grid units
            hideTerminals: false,
            hideName: true,
            capacitance: 1,       // Microfarads
            voltageRating: 5,     // Volts
        });
    }

    hasDefaultName() {
        return this.attributes.name.match(/^C\d+$/) !== null;
    }

    getComponentTypeName() {
        return "Capacitor";
    }

    serialize() {
        const result = { t: this.type, x: this.gx, y: this.gy, n: this.attributes.name };
        if (this.attributes.orientation !== Capacitor.defaults.orientation)     result.o = this.attributes.orientation;
        if (this.attributes.size !== Capacitor.defaults.size)                   result.s = this.attributes.size;
        if (this.attributes.hideTerminals !== Capacitor.defaults.hideTerminals) result.ht = this.attributes.hideTerminals;
        if (this.attributes.hideName !== Capacitor.defaults.hideName)           result.hn = this.attributes.hideName;
        if (this.attributes.capacitance !== Capacitor.defaults.capacitance)     result.c = this.attributes.capacitance;
        if (this.attributes.voltageRating !== Capacitor.defaults.voltageRating) result.v = this.attributes.voltageRating;
        return result;
    }
}


class Inductor extends Component {
    constructor(data, circuit) {
        if (data.x === undefined || data.y === undefined) throw new Error('Invalid inductor data');
        super(ComponentType.INDUCTOR, data.x, data.y);
        this.circuit = circuit;
        this.attributes = {
            name: data.n ?? `I${circuit.getCount(ComponentType.INDUCTOR) + 1}`,
            orientation: Inductor.defaults.orientation,
            size: Inductor.defaults.size,
            hideTerminals: data.ht ?? Inductor.defaults.hideTerminals,
            hideName: data.hn ?? Inductor.defaults.hideName,
            inductance: data.i ?? Inductor.defaults.inductance,
            maxCurrent: data.c ?? Inductor.defaults.maxCurrent,
        };
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.BIDIRECTIONAL, data.x, data.y, this, circuit),
            new Node(NodeType.BIDIRECTIONAL, data.x + 3, data.y, this, circuit),
        ];
        const sWidth = s / 12;
        this.shapes = [
            // First lead
            new Konva.Line({
                points: [0, 0, 0.5 * s, 0],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // Coil
            new Konva.Line({
                points: [
                    0.5 * s, 0,
                    0.825 * s, -0.5 * s,
                    1.15 * s, 0,
                    1.05 * s, 0.3 * s,
                    0.95 * s, 0,
                    1.275 * s, -0.5 * s,
                    1.6 * s, 0,
                    1.5 * s, 0.3 * s,
                    1.4 * s, 0,
                    1.725 * s, -0.5 * s,
                    2.05 * s, 0,
                    1.95 * s, 0.3 * s,
                    1.85 * s, 0,
                    2.175 * s, -0.5 * s,
                    2.5 * s, 0,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
                lineCap: 'round',
                lineJoin: 'round',
                tension: .5,
            }),
            // Second lead
            new Konva.Line({
                points: [2.5 * s, 0, 3 * s, 0],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // Hitbox
            new Konva.Rect({
                x: 0,
                y: -0.5 * s,
                width: 3 * s,
                height: s,
                fill: 'transparent',
                strokeWidth: 0,
            }),
        ];
        this.setup(data);
    }

    static get defaults() {
        return Object.freeze({
            orientation: 0,       // 0-4: 0, 90, 180, 270 degrees
            size: 3,              // length in grid units
            hideTerminals: false,
            hideName: true,
            inductance: 0.001,    // Henrys
            maxCurrent: 0.5,      // Amps
        });
    }

    hasDefaultName() {
        return this.attributes.name.match(/^I\d+$/) !== null;
    }

    getComponentTypeName() {
        return "Inductor";
    }

    serialize() {
        const result = { t: this.type, x: this.gx, y: this.gy, n: this.attributes.name };
        if (this.attributes.orientation !== Inductor.defaults.orientation)     result.o = this.attributes.orientation;
        if (this.attributes.size !== Inductor.defaults.size)                   result.s = this.attributes.size;
        if (this.attributes.hideTerminals !== Inductor.defaults.hideTerminals) result.ht = this.attributes.hideTerminals;
        if (this.attributes.hideName !== Inductor.defaults.hideName)           result.hn = this.attributes.hideName;
        if (this.attributes.inductance !== Inductor.defaults.inductance)       result.i = this.attributes.inductance;
        if (this.attributes.maxCurrent !== Inductor.defaults.maxCurrent)       result.c = this.attributes.maxCurrent;
        return result;
    }
}


class Battery extends Component {
    constructor(data, circuit) {
        if (data.x === undefined || data.y === undefined) throw new Error('Invalid battery data');
        super(ComponentType.BATTERY, data.x, data.y);
        this.circuit = circuit;
        this.attributes = {
            name: data.n ?? `B${circuit.getCount(ComponentType.BATTERY) + 1}`,
            orientation: Battery.defaults.orientation,
            size: Battery.defaults.size,
            hideTerminals: data.ht ?? Battery.defaults.hideTerminals,
            hideName: data.hn ?? Battery.defaults.hideName,
            voltage: data.v ?? Battery.defaults.voltage,
            maxCurrent: data.c ?? Battery.defaults.maxCurrent,
        }
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.OUTPUT, data.x, data.y, this, circuit),
            new Node(NodeType.INPUT, data.x, data.y + 6, this, circuit),
        ];
        const sWidth = s / 12;
        this.shapes = [
            // first lead
            new Konva.Line({
                points: [0, 0, 0, 0.8 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // hitbox
            new Konva.Rect({
                x: -1.2 * s,
                y: 0.8 * s,
                width: 2.4 * s,
                height: 4.4 * s,
                fill: 'white',
                stroke: 'black',
                strokeWidth: 0,
            }),
            // battery outline
            new Konva.Line({
                points: [
                    -1.2 * s, 0.8 * s,
                    -1.2 * s, 5.2 * s,
                    1.2 * s, 5.2 * s,
                    1.2 * s, 0.8 * s,
                    -1.2 * s, 0.8 * s,
                ],
                stroke: 'black',
                lineCap: 'round',
                lineJoin: 'round',
                strokeWidth: sWidth,
            }),
            // Plus sign
            new Konva.Line({
                points: [
                    -0.5 * s, 1.6 * s,
                    0.5 * s, 1.6 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            new Konva.Line({
                points: [
                    0, 1.1 * s,
                    0, 2.1 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // Minus sign
            new Konva.Line({
                points: [
                    -0.5 * s, 4.4 * s,
                    0.5 * s, 4.4 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // second lead
            new Konva.Line({
                points: [0, 6 * s, 0, 5.2 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
        ];
        this.setup(data);
    }

    static get defaults() {
        return Object.freeze({
            orientation: 0,       // 0-4: 0, 90, 180, 270 degrees
            size: 6,              // height in grid units
            hideTerminals: false,
            hideName: true,
            voltage: 5,           // Volts
            maxCurrent: 0.5,      // Amps
        });
    }

    hasDefaultName() {
        return this.attributes.name.match(/^B\d+$/) !== null;
    }

    getComponentTypeName() {
        return "Battery";
    }

    serialize() {
        const result = { t: this.type, x: this.gx, y: this.gy, n: this.attributes.name };
        if (this.attributes.orientation !== Battery.defaults.orientation)     result.o = this.attributes.orientation;
        if (this.attributes.size !== Battery.defaults.size)                   result.s = this.attributes.size;
        if (this.attributes.hideTerminals !== Battery.defaults.hideTerminals) result.ht = this.attributes.hideTerminals;
        if (this.attributes.hideName !== Battery.defaults.hideName)           result.hn = this.attributes.hideName;
        if (this.attributes.voltage !== Battery.defaults.voltage)             result.v = this.attributes.voltage;
        if (this.attributes.maxCurrent !== Battery.defaults.maxCurrent)       result.c = this.attributes.maxCurrent;
        return result;
    }
}
