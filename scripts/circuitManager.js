import { Circuit } from './circuit.js';

class CircuitManager {
    constructor() {
        this.circuits = [];
        this.selectedCircuit = null;
        this.loadCircuits();
    }

    loadCircuits() {
        console.log("Loading circuits...");
        const savedData = localStorage.getItem('circuits');
        if (savedData) {
            this.circuits = JSON.parse(savedData);
        } else {
            console.log("No circuits found.");
            this.circuits = [ new Circuit(this.getUnusedName()) ];
            console.log("Creating new circuit with name: " + this.circuits[0].name);
        }
        this.selectedCircuit = this.circuits[0];
    }

    getUnusedName() {
        let i = 1;
        while (this.circuits.some(circuit => circuit.name === `Unnamed-${i}`)) {
            ++i;
        }
        return `Unnamed-${i}`;
    }
}

export const circuitManager = new CircuitManager();