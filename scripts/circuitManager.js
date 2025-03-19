import { Circuit } from './circuit.js';

class CircuitManager {
    constructor() {
        this.circuitNames = [];
        this.circuit = null;
        const savedNames = localStorage.getItem('circuit_names');
        if (savedNames) {
            try {
                this.circuitNames = JSON.parse(savedNames);
            } catch (e) { // Error parsing circuit names, clear circuit_names from localStorage
                console.warn(e);
                localStorage.removeItem('circuit_names');
                this.newCircuit();
                return;
            }
            this.loadCircuit(this.circuitNames[0]);
        } else {
            this.newCircuit();
        }
    }

    // Load a circuit from localStorage with the given name. `name` should be in circuitNames. If
    // the circuit cannot be loaded, it is removed from localStorage and circuitNames and the next
    // name in the list is tried. If no circuits can be loaded, a new circuit is created.
    loadCircuit(nameToLoad) {
        const names = [nameToLoad, ...this.circuitNames.filter(name => name !== nameToLoad)];
        while (names.length > 0) {
            const name = names.shift();
            if (!this.circuitNames.includes(name)) throw new Error("Error: circuit name not in circuitNames");
            try {
                const savedData = localStorage.getItem(name);
                if (!savedData) throw new Error(`Circuit ${name} not in localStorage`);
                const savedCircuit = JSON.parse(savedData);
                if (this.circuit !== null) this.save();
                this.unloadCircuit();
                this.circuit = new Circuit(name, savedCircuit);
                this.save();
                return;
            } catch (e) { // Error loading circuit, remove it from localStorage and circuitNames
                console.warn(e);
                localStorage.removeItem(name);
                this.circuitNames.splice(this.circuitNames.indexOf(name), 1);
            }
        }
        this.newCircuit(); // If we get here, we couldn't load any circuits
    }

    save() {
        localStorage.setItem('circuit_names', JSON.stringify(this.circuitNames));
        if (this.circuit !== null && this.circuit.updated) {
            const jsonStr = JSON.stringify(this.circuit.history[this.circuit.historyIndex]);
            localStorage.setItem(this.circuit.name, jsonStr);
            this.circuit.updated = false;
        }
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
        this.circuit = new Circuit(this.getUnusedName());
        this.circuitNames.push(this.circuit.name);
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
