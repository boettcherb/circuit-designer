import { stage } from "./stage.js"
import { grid } from "./grid.js";
import { compManager } from "./compManager.js"

// Class structure:
// 
// Component
// - Grid Position (gx, gy)
// - Grid Dimensions (gw, gh)
// - Image
// - Type (enum)
// - Terminals (array of Terminal)
//
// Wire extends Component
// 
// Resistor extends Component (gw = 3, gh = 2, Type = RESISTOR)
// - resistance (ohms)
// - power rating (watts)
// 
// Capacitor extends Component (gw = 4, gh = 2, Type = CAPACITOR)
// - capacitance (microfarads)
// - voltage rating (volts)
// 
// AndGate extends Component (gw = 5, gh = 4, Type = AND_GATE)
//
// ...

// enum for component types
export const ComponentType = {
    WIRE: 100,
    VOLTAGE_SOURCE: 1000,
    GROUND: 1001,
    RESISTOR: 2000,
    CAPACITOR: 2001,
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


class Node {
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
        this.circle.on('mousedown', (e) => {
            e.cancelBubble = true;
            const xpos = grid.offsetX + this.gx * grid.gridSize;
            const ypos = grid.offsetY + this.gy * grid.gridSize;
            this.createWire(xpos, ypos);
        });
        this.circle.on('mouseover', () => {
            document.body.style.cursor = 'pointer';
        });
        this.circle.on('mouseout', () => {
          document.body.style.cursor = 'default';
        });
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
            wire.gx2 = wire.gx + (wire.line.points()[2] - wire.line.points()[0]) / grid.gridSize;
            wire.gy2 = wire.gy + (wire.line.points()[3] - wire.line.points()[1]) / grid.gridSize;
            // if the created wire is length 0, delete it
            if (wire.gx == wire.gx2 && wire.gy == wire.gy2) {
                compManager.deleteWire(wire);
            } else {
                let endNode = compManager.getNode(wire.gx2, wire.gy2);
                if (endNode === null) {
                    endNode = new Node(NodeType.WIRE, wire.gx2, wire.gy2, null)
                    compManager.addNode(endNode);
                }
                wire.endNode = endNode;
                endNode.connections.push(wire);
            }
        });
    }
}

class Component {
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

class Wire extends Component {
    constructor(node, startX, startY) {
        super(ComponentType.WIRE, node.gx, node.gy, 0, 0);
        this.gx2 = node.gx;
        this.gy2 = node.gy;
        this.startNode = node;
        this.endNode = null;
        this.line = new Konva.Line({
            points: [ startX, startY, startX, startY ],
            stroke: 'black',
            strokeWidth: grid.gridSize / 12,
        })
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
            // first terminal
            new Konva.Circle({
                x: 0,
                y: s,
                fill: 'black',
                radius: s / 8,
            }),
            // second terminal
            new Konva.Circle({
                x: 3 * s,
                y: s,
                fill: 'black',
                radius: s / 8,
            }),
        ];
    }
}
