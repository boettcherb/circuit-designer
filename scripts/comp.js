import { stage } from "./stage.js"
import { grid } from "./grid.js";
import { compManager } from "./compManager.js"


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
    constructor(type, gx, gy, comp) {
        if (comp === null && type !== NodeType.WIRE) throw new Error("Invalid node (1)");
        if (comp !== null && type === NodeType.WIRE) throw new Error("Invalid node (2)");
        this.type = type;
        this.gx = gx;
        this.gy = gy;
        this.comp = comp;
        this.connections = []; // wires connected to this node

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
                const xpos = grid.offsetX + this.gx * grid.gridSize;
                const ypos = grid.offsetY + this.gy * grid.gridSize;
                this.createWire(xpos, ypos);
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
            compManager.layer.draw();
        });

        this.circle.on('dragend', () => {
            this.circle.draggable(false);
        })

        this.circle.on('mouseover', () => { document.body.style.cursor = 'pointer'; });
        this.circle.on('mouseout', () => { document.body.style.cursor = 'default'; });
    }
    
    createWire(startX, startY) {
        const wire = new Wire(this, startX, startY);
        this.connections.push(wire);
        compManager.addWire(wire, startX, startY);

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
                compManager.deleteWire(wire);
            } else {
                let endNode = compManager.getNode(gx2, gy2);
                if (endNode === null) {
                    endNode = new Node(NodeType.WIRE, gx2, gy2, null)
                    compManager.addNode(endNode);
                }
                wire.endNode = endNode;
                endNode.connections.push(wire);
            }            
            compManager.reselect();
        });
    }
}


export class Component {
    constructor(type, gx, gy, gw, gh) {
        this.type = type;
        this.gx = gx;
        this.gy = gy;
        this.gw = gw;
        this.gh = gh;
        this.group = null;
        this.terminals = [];
    }

    addGroup(group) {
        this.group = group;
    }

    updateGridPosition(dx, dy) {
        this.gx += dx;
        this.gy += dy;
        for (const node of this.terminals) {
            node.gx += dx;
            node.gy += dy;
        }
    }
}


export class Resistor extends Component {
    constructor(gx, gy) {
        super(ComponentType.RESISTOR, gx, gy, 3, 2);
        this.resistance = 1000; // Ohms
        this.powerRating = 0.25; // Watts
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.BIDIRECTIONAL, gx, gy + 1, this),
            new Node(NodeType.BIDIRECTIONAL, gx + 3, gy + 1, this),
        ];
        const sWidth = s / 12;
        this.lines = [
            // first lead
            new Konva.Line({
                points: [
                    0, s,
                    0.75 * s, s
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // zigzags
            new Konva.Line({
                points: [
                    0.75 * s, s,
                    0.875 * s, 0.5 * s,
                    1.125 * s, 1.5 * s,
                    1.375 * s, 0.5 * s,
                    1.625 * s, 1.5 * s,
                    1.875 * s, 0.5 * s,
                    2.125 * s, 1.5 * s,
                    2.25 * s, s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
                lineCap: 'round',
                lineJoin: 'round',
            }),
            // second lead
            new Konva.Line({
                points: [
                    2.25 * s, s,
                    3 * s, s
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // hitbox
            new Konva.Rect({
                x: 0,
                y: 0.5 * s,
                width: 3 * s,
                height: s,
                fill: 'transparent',
                strokeWidth: 0,
            }),
        ];
    }
}


export class Capacitor extends Component {
    constructor(gx, gy) {
        super(ComponentType.CAPACITOR, gx, gy, 3, 2);
        this.capacitance = 1; // Microfarads
        this.voltageRating = 5; // Volts
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.BIDIRECTIONAL, gx, gy + 1, this),
            new Node(NodeType.BIDIRECTIONAL, gx + 3, gy + 1, this),
        ];
        const sWidth = s / 12;
        this.lines = [
            // first lead
            new Konva.Line({
                points: [
                    0, s,
                    1.2 * s, s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // first plate
            new Konva.Line({
                points: [
                    1.2 * s, 0.3 * s,
                    1.2 * s, 1.7 * s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // second plate
            new Konva.Line({
                points: [
                    1.8 * s, 0.3 * s,
                    1.8 * s, 1.7 * s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // second lead
            new Konva.Line({
                points: [
                    1.8 * s, s,
                    3 * s, s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // hitbox
            new Konva.Rect({
                x: 0,
                y: 0.5 * s,
                width: 3 * s,
                height: s,
                fill: 'transparent',
                strokeWidth: 0,
            }),
        ];
    }
}


export class Inductor extends Component {
    constructor(gx, gy) {
        super(ComponentType.INDUCTOR, gx, gy, 3, 2);
        this.inductance = 1; // Henries
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.BIDIRECTIONAL, gx, gy + 1, this),
            new Node(NodeType.BIDIRECTIONAL, gx + 3, gy + 1, this),
        ];
        const sWidth = s / 12;
        this.lines = [
            // First lead
            new Konva.Line({
                points: [0, s, 0.5 * s, s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // Coil
            new Konva.Line({
                points: [
                    0.5 * s, s,
                    0.825 * s, 0.5 * s,
                    1.15 * s, s,
                    1.05 * s, 1.3 * s,
                    0.95 * s, s,
                    1.275 * s, 0.5 * s,
                    1.6 * s, s,
                    1.5 * s, 1.3 * s,
                    1.4 * s, s,
                    1.725 * s, 0.5 * s,
                    2.05 * s, s,
                    1.95 * s, 1.3 * s,
                    1.85 * s, s,
                    2.175 * s, 0.5 * s,
                    2.5 * s, s,
                ],
                stroke: 'black',
                strokeWidth: sWidth,
                lineCap: 'round',
                lineJoin: 'round',
                tension: .5,
            }),
            // Second lead
            new Konva.Line({
                points: [2.5 * s, s, 3 * s, s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // Hitbox
            new Konva.Rect({
                x: 0,
                y: 0.5 * s,
                width: 3 * s,
                height: s,
                fill: 'transparent',
                strokeWidth: 0,
            }),
        ];
    }
}

export class Battery extends Component {
    constructor(gx, gy) {
        super(ComponentType.BATTERY, gx, gy, 4, 6);
        this.voltage = 5; // Volts
        this.maxCurrent = 0.5; // Amps
        const s = grid.gridSize;
        this.terminals = [
            new Node(NodeType.OUTPUT, gx + 2, gy, this),
            new Node(NodeType.INPUT, gx + 2, gy + 6, this),
        ];
        const sWidth = s / 12;
        this.lines = [
            // first lead
            new Konva.Line({
                points: [2 * s, 0, 2 * s, 0.8 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // hitbox
            new Konva.Rect({
                x: 0.8 * s,
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
                    0.8 * s, 0.8 * s,
                    0.8 * s, 5.2 * s,
                    3.2 * s, 5.2 * s,
                    3.2 * s, 0.8 * s,
                    0.8 * s, 0.8 * s,
                ],
                stroke: 'black',
                lineCap: 'round',
                lineJoin: 'round',
                strokeWidth: sWidth,
            }),
            // Plus sign
            new Konva.Line({
                points: [
                    1.5 * s, 1.6 * s,
                    2.5 * s, 1.6 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            new Konva.Line({
                points: [
                    2 * s, 1.1 * s,
                    2 * s, 2.1 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // Minus sign
            new Konva.Line({
                points: [
                    1.5 * s, 4.4 * s,
                    2.5 * s, 4.4 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
            // second lead
            new Konva.Line({
                points: [2 * s, 6 * s, 2 * s, 5.2 * s],
                stroke: 'black',
                strokeWidth: sWidth,
            }),
        ];
    }
}
