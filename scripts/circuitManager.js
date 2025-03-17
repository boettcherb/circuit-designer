import { Circuit } from './circuit.js';

class CircuitManager {
    constructor() {
        this.circuitNames = [];
        this.circuit = null;
        const savedNames = localStorage.getItem('circuit_names');
        if (savedNames) {
            this.circuitNames = JSON.parse(savedNames);
            this.loadCircuit(this.circuitNames[0]);
        } else {
            this.newCircuit();
        }
    }

    loadCircuit(name) {
        if (this.circuit !== null) this.save();
        this.unloadCircuit();
        if (!this.circuitNames.includes(name)) throw new Error(`Circuit ${name} not in circuitNames`);
        const savedCircuit = JSON.parse(localStorage.getItem(name));
        if (!savedCircuit) throw new Error(`Circuit ${name} not in localStorage`);
        this.circuit = new Circuit(name);
        this.circuit.build(savedCircuit);
        this.save();
    }

    save() {
        localStorage.setItem('circuit_names', JSON.stringify(this.circuitNames));
        const map = new Map();
        const comps = [];
        const wires = [];
        const nodes = [];
        for (let i = 0; i < this.circuit.components.length; ++i)
            map.set(this.circuit.components[i], i);
        for (let i = 0; i < this.circuit.nodes.length; ++i)
            map.set(this.circuit.nodes[i], i);
        for (const comp of this.circuit.components)
            comps.push(comp.serialize());
        for (const node of this.circuit.nodes)
            nodes.push({ x: node.gx, y: node.gy });
        for (const wire of this.circuit.wires) {
            if (wire.startNode === null || wire.endNode === null) continue;
            let s = map.get(wire.startNode);
            let e = map.get(wire.endNode);
            if (s === undefined) s = [map.get(wire.startNode.comp), wire.startNode.comp.getTerminalIndex(wire.startNode)];
            if (e === undefined) e = [map.get(wire.endNode.comp), wire.endNode.comp.getTerminalIndex(wire.endNode)];
            wires.push({ s: s, e: e });
        }
        const obj = { name: this.circuit.name, comps: comps, wires: wires, nodes: nodes };
        localStorage.setItem(this.circuit.name, JSON.stringify(obj));
    }

    // Find an unused name for a new circuit
    getUnusedName() {
        let i = 1;
        while (this.circuitNames.some(name => name === `Unnamed-${i}`)) {
            ++i;
        }
        return `Unnamed-${i}`;
    }

    // Create a new circuit with an unused name and switch to it
    newCircuit() {
        if (this.circuit !== null) this.save();
        this.unloadCircuit();
        const circuit = new Circuit(this.getUnusedName());
        this.circuitNames.push(circuit.name);
        this.circuit = circuit;
        this.save();
    }

    deleteCircuit(name) {
        if (!this.circuitNames.includes(name)) throw new Error(`Circuit ${name} not in circuitNames`);
        localStorage.removeItem(name);
        this.circuitNames.splice(this.circuitNames.indexOf(name), 1);
        if (name !== this.circuit.name) {
            this.save();
            return;
        }
        this.unloadCircuit();
        if (this.circuitNames.length === 0)
            this.newCircuit();
        else
            this.loadCircuit(this.circuitNames[0]);
    }

    unloadCircuit() {
        if (this.circuit !== null) {
            this.circuit.clearAll();
            this.circuit.layer.destroy();
            this.circuit = null;
        }
    }
}

export const circuitManager = new CircuitManager();
