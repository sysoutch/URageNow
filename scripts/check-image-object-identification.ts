import assert from "node:assert/strict";
import { parseIdentifiedImageObjects } from "../dashboard/src/server/messagingAndModel/imageObjectIdentification.js";

assert.deepEqual(parseIdentifiedImageObjects(
  '```json\n{"objects":[{"name":"Lamp","prompt":"red ceramic lamp"}]}\n```',
  5
), [{name: "Lamp", prompt: "red ceramic lamp"}]);

assert.deepEqual(parseIdentifiedImageObjects(
  'Model note {"objects":[{"name":"Chair","prompt":"wood chair"}]} extra {"ignored":true}',
  5
), [{name: "Chair", prompt: "wood chair"}]);

assert.deepEqual(parseIdentifiedImageObjects(
  '{"objects":[{"name":"Broken","prompt":"bad "quote""},{"name":"Bottle","prompt":"green glass bottle"}]}',
  5
), [{name: "Bottle", prompt: "green glass bottle"}]);

assert.deepEqual(parseIdentifiedImageObjects(
  '[{"name":"Cube","prompt":"blue cube"},{"name":"Cube","prompt":"blue cube"}]',
  5
), [{name: "Cube", prompt: "blue cube"}]);

assert.deepEqual(parseIdentifiedImageObjects(
  '{"objects":[{"name":"One","prompt":"first"},{"name":"Two","prompt":"second"}]}',
  1
), [{name: "One", prompt: "first"}]);

console.log("Image object identification parser validation passed.");
