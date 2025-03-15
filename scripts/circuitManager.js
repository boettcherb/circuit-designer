import { Circuit } from './circuit.js';

class CircuitManager {
    constructor() {
        this.circuits = [];
        this.selectedCircuit = null;
        this.loadCircuits();
    }

    loadCircuits() {
        const savedData = localStorage.getItem('circuits');
        if (savedData) {
            const circuits = JSON.parse(savedData);
            for (const c of circuits) {
                const circuit = new Circuit(c.name);
                circuit.build(c);
                this.circuits.push(circuit);
            }
        } else {
            this.circuits = [ new Circuit(this.getUnusedName()) ];
        }
        this.selectedCircuit = this.circuits[0];
    }

    saveCircuits() {
        const circuits = [];
        for (const circuit of this.circuits) {
            const map = new Map();
            const comps = [];
            const wires = [];
            const nodes = [];
            for (let i = 0; i < circuit.components.length; ++i)
                map.set(circuit.components[i], i);
            for (let i = 0; i < circuit.nodes.length; ++i)
                map.set(circuit.nodes[i], i);
            for (const comp of circuit.components) {
                comps.push({ t: comp.type, x: comp.gx, y: comp.gy });
            }
            for (const wire of circuit.wires) {
                if (wire.startNode === null || wire.endNode === null) continue;
                let s = map.get(wire.startNode);
                let e = map.get(wire.endNode);
                if (s === undefined) s = [map.get(wire.startNode.comp), wire.startNode.comp.getTerminalIndex(wire.startNode)];
                if (e === undefined) e = [map.get(wire.endNode.comp), wire.endNode.comp.getTerminalIndex(wire.endNode)];
                wires.push({ s: s, e: e });
            }
            for (const node of circuit.nodes) {
                nodes.push({ x: node.gx, y: node.gy });
            }
            circuits.push({ name: circuit.name, comps: comps, wires: wires, nodes: nodes });
        }
        localStorage.setItem('circuits', JSON.stringify(circuits));
    }

    getUnusedName() {
        let i = 1;
        while (this.circuits.some(circuit => circuit.name === `Unnamed-${i}`)) {
            ++i;
        }
        return `Unnamed-${i}`;
    }

    createCircuit() {
        const circuit = new Circuit(this.getUnusedName());
        this.circuits.push(circuit);
        this.saveCircuits();
    }

    deleteCircuit(circuit) {
        if (!(circuit instanceof Circuit)) throw new Error('circuit is not a Circuit');
        circuit.clearAll();
        const index = this.circuits.indexOf(circuit);
        if (index === -1) throw new Error('circuit not found');
        this.circuits.splice(index, 1);
        if (this.circuits.length === 0) {
            this.createCircuit();
        }
        if (this.selectedCircuit === circuit) {
            this.selectedCircuit = this.circuits[0];
        }
        this.saveCircuits();
    }
}

export const circuitManager = new CircuitManager();