import assert from "node:assert/strict";
import {
  compileUserRegexPattern,
  compileWildcardPattern,
  normalizeRuleEntries,
  normalizeWildcardPatterns,
  validateUserRegexPatterns
} from "@urage/server/services/moderationRules";

// Rule entry normalization trims blanks, drops empty lines, and de-duplicates while preserving first-seen order.
assert.deepEqual(normalizeRuleEntries(["  block me ", "", "block me", "   ", "other"]), ["block me", "other"]);
assert.deepEqual(normalizeRuleEntries([]), []);

// Bare user regex patterns compile case-insensitive so moderation rules match user input casing.
const bareUserPattern = compileUserRegexPattern("spam");
assert.equal(bareUserPattern.flags, "i");
assert.ok(bareUserPattern.test("SPAM detected"));

// Slash-delimited patterns keep explicit flags: without i they stay case-sensitive.
const slashedPattern = compileUserRegexPattern("/Spam/");
assert.ok(slashedPattern.test("Spam"));
assert.ok(!slashedPattern.test("spam"), "slash pattern without i flag must remain case-sensitive");

// Empty user regex is rejected with a descriptive error.
assert.throws(() => compileUserRegexPattern(""), /Regex pattern cannot be empty\./);

// Wildcard patterns escape literal special characters and turn * into an any-run match, case-insensitive.
const wildcardPattern = compileWildcardPattern("image*.png");
assert.ok(wildcardPattern.test("IMAGE_FINAL.PNG"));
assert.ok(wildcardPattern.test("image.png"), "* must also match zero characters");

const literalDotPattern = compileWildcardPattern("file.txt");
assert.ok(literalDotPattern.test("FILE.TXT"));
assert.ok(!literalDotPattern.test("fileXtxt"), "unescaped special characters must stay literal in wildcards");

// Empty wildcard pattern is rejected with a descriptive error.
assert.throws(() => compileWildcardPattern(""), /Wildcard pattern cannot be empty\./);

// Validation helpers normalize and prove every entry compiles, rejecting malformed user regexes up front.
const validatedUserPatterns = validateUserRegexPatterns(["  /abc/i ", "", "abc", "/abc/i"]);
assert.deepEqual(validatedUserPatterns, ["/abc/i", "abc"]);
assert.throws(() => validateUserRegexPatterns(["("]), Error);

const normalizedWildcards = normalizeWildcardPatterns(["  image*.png ", "", "image*.png", "a.b"]);
assert.deepEqual(normalizedWildcards, ["image*.png", "a.b"]);
assert.deepEqual(validateUserRegexPatterns([]), []);
assert.deepEqual(normalizeWildcardPatterns(["   "]), []);

console.log("Moderation rule normalization and compilation validation passed.");