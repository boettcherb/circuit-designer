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
            if (this.circuitNames.length > 0) {
                this.loadCircuit(this.circuitNames[0]);
                return;
            }
        }
        this.newCircuit();
    }

    // Load a circuit from localStorage with the given name. `name` should be in circuitNames. If
    // the circuit cannot be loaded, it is removed from localStorage and circuitNames and the next
    // name in the list is tried. If no circuits can be loaded, a new circuit is created.
    loadCircuit(nameToLoad) {
        if (!this.circuitNames.includes(nameToLoad)) throw new Error("Error: circuit name not in circuitNames");
        if (this.circuit !== null && this.circuit.name === nameToLoad) return;
        const names = [nameToLoad, ...this.circuitNames.filter(name => name !== nameToLoad)];
        while (names.length > 0) {
            const name = names.shift();
            try {
                const savedData = localStorage.getItem(name);
                if (!savedData) throw new Error(`Circuit ${name} not in localStorage`);
                const savedCircuit = JSON.parse(savedData);
                if (this.circuit !== null) this.save();
                this.unloadCircuit();
                this.circuit = new Circuit(name, savedCircuit);
                this.updateDisplayedCircuit();
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

    // Create a new circuit with an unused name and switch to it
    newCircuit(name = this.getUnusedName()) {
        if (this.circuit !== null) this.save();
        this.unloadCircuit();
        this.circuit = new Circuit(name);
        this.updateDisplayedCircuit();
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

    updateDisplayedCircuit() {
        document.getElementById('current-circuit').textContent = `Current Circuit: ${this.circuit.name}`;
    }

    renameCircuit(oldName, newName) {
        if (!this.circuitNames.includes(oldName)) throw new Error(`Circuit ${oldName} not in circuitNames`);
        if (this.circuitNames.includes(newName)) throw new Error(`Circuit ${newName} already exists`);
        this.circuitNames[this.circuitNames.indexOf(oldName)] = newName;
        if (this.circuit.name === oldName) {
            this.circuit.name = newName;
            this.circuit.history = [this.circuit.serialize()];
            this.circuit.historyIndex = 0;
            this.circuit.updated = true;
            this.updateDisplayedCircuit();
        } else {
            try {
                const data = JSON.parse(localStorage.getItem(oldName));
                data.name = newName;
                localStorage.setItem(newName, JSON.stringify(data));
            } catch (e) {
                console.error("Failed to rename circuit in localStorage", e);
            }
        }
        localStorage.removeItem(oldName);
        this.save();
    }

    // Find an unused name for a new circuit
    getUnusedName() {
        let i = 1;
        while (this.circuitNames.some(name => name === `Unnamed-${i}`)) {
            ++i;
        }
        return `Unnamed-${i}`;
    }
}

export const circuitManager = new CircuitManager();
