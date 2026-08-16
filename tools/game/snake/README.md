# 🐍 Snake AI (HTML + Canvas)

A retro Snake game with multiple AI strategies ranging from simple greedy behavior to a mathematically perfect solution.

---

## 🎮 Features

- Classic Snake gameplay
- Toggleable AI control
- Multiple AI personalities
- Increasing speed difficulty
- Debug visualization

---

## 🤖 AI Modes

### 🟢 Greedy
- Uses shortest path (BFS) to food
- Fast but can trap itself

### 🟡 Safe
- Avoids traps using space detection
- More cautious than greedy

### 🔵 Balanced (Recommended)
- Mix of greedy + safety
- Best general performance

### 🟣 Survival
- Focuses on staying alive
- Follows tail and avoids tight spaces

### 🔴 Perfect (Hamiltonian Cycle)
- Guaranteed to never die
- Covers the entire grid systematically
- Takes safe shortcuts when possible

---

## 🧠 How It Works

### Pathfinding
- Breadth-First Search (BFS) for shortest paths

### Space Awareness
- Flood fill to measure available movement space

### Lookahead Simulation
- Simulates future steps to avoid traps

### Hamiltonian Cycle
- Precomputed path visiting every tile exactly once
- Ensures infinite survival

---

## 🎯 Controls

- Arrow keys → control snake
- 🤖 AI Mode → toggle AI
- MODE button → switch AI behavior

---

## 🚀 Run Locally

Just open:

```bash
index.html