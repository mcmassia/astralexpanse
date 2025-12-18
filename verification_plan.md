# Verification Plan: Advanced PKM RAG (4-Pillar)

## Objective
Verify that the new "Smart" RAG system can handle complex PKM queries by utilizing the Router, Filters, and Graph Traversal.

## Test Cases

### 1. The "Invisible Data" Test (Smart Serialization)
**Action**: Create a Person object named "John Doe" with Property `Role: Quantum Physicist`. (Leave content body empty).
**Query**: "Who is the quantum physicist?"
**Expected**: The AI should find John Doe based solely on the property value, proving that properties are now embedded/searchable.

### 2. The "Router" Test (Date & Type Filtering)
**Query**: "Resumen de las reuniones de la última semana" (Summary of meetings from last week).
**Expected**: 
- The Console should show the Router output: `filters: { type: 'meeting', dateRange: 'last_7_days' }`.
- The result should ONLY include Meeting objects from the last 7 days.

### 3. The "Graph" Test (Project Context)
**Query**: "Estado del proyecto Astral Expanse".
**Expected**:
- The AI should retrieve the "Astral Expanse" project object.
- **CRITICAL**: It must ALSO retrieve the *linked* tasks and phases (its "neighbors").
- The answer should be a synthesized summary of the project status AND its sub-components.

### 4. The "Recency" Test
**Action**: Retrieve a summary of a topic you have old (2020) and new (2025) notes on.
**Query**: "What is my current thinking on [Topic]?"
**Expected**: The AI should prioritize the newer note due to the Recency Decay algorithm.
